import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Stripe from "stripe";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/user/credits", async (req, res) => {
    const { userId } = req.query;
    try {
      const result = await pool.query("SELECT credits, plan FROM users WHERE id = $1", [userId]);
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.json({ credits: 5, plan: "Free Starter" });
      }
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/user/history", async (req, res) => {
    const { userId } = req.query;
    try {
      const result = await pool.query(
        "SELECT filename, status, created_at FROM processes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/admin/metrics", async (req, res) => {
    try {
      const usersCount = await pool.query("SELECT COUNT(*) FROM users");
      const processesCount = await pool.query("SELECT COUNT(*) FROM processes WHERE created_at >= CURRENT_DATE");
      const revenue = await pool.query("SELECT SUM(amount) as total FROM (SELECT 29 as amount FROM users WHERE plan = 'Pro Unlimited') as sub");
      
      res.json({
        totalUsers: parseInt(usersCount.rows[0].count),
        dailyRevenue: parseFloat(revenue.rows[0].total || "0") / 30, // Rough estimate
        processedToday: parseInt(processesCount.rows[0].count),
        anomalyRate: 0.72
      });
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, name, email, plan, credits, created_at as joined FROM users ORDER BY created_at DESC"
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/admin/users/update-credits", async (req, res) => {
    const { userId, credits } = req.body;
    try {
      await pool.query("UPDATE users SET credits = $1 WHERE id = $2", [credits, userId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Error updating credits" });
    }
  });

  app.post("/api/admin/users/upgrade-pro", async (req, res) => {
    const { userId } = req.body;
    try {
      await pool.query(
        "UPDATE users SET credits = 10000, plan = 'Pro Unlimited' WHERE id = $1",
        [userId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Error upgrading user to Pro" });
    }
  });

  // Stripe Checkout Session
  app.post("/api/billing/create-checkout-session", async (req, res) => {
    try {
      const { planId, userId } = req.body;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        client_reference_id: userId?.toString(),
        line_items: [
          {
            price: planId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${process.env.APP_URL}/dashboard?success=true`,
        cancel_url: `${process.env.APP_URL}/dashboard?canceled=true`,
      });
      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auth & Recovery Logic
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, rfc, curp } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO users (name, email, password_hash, rfc, curp, security_answer_rfc, security_answer_curp) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [name, email, hashedPassword, rfc || null, curp || null, rfc || null, curp || null]
      );
      res.json({ success: true, message: "Usuario registrado correctamente" });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(400).json({ error: "El correo ya está registrado" });
      }
      res.status(500).json({ error: "Error al registrar usuario" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }
      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email,
          isAdmin: user.is_admin || false
        } 
      });
    } catch (err) {
      res.status(500).json({ error: "Error en el servidor" });
    }
  });

  app.post("/api/auth/recover", async (req, res) => {
    const { email, rfc, curp, newPassword } = req.body;
    try {
      let query = "SELECT * FROM users WHERE email = $1";
      let params = [email];
      
      if (rfc && curp) {
        query += " AND (rfc = $2 OR curp = $3)";
        params.push(rfc, curp);
      } else if (rfc) {
        query += " AND rfc = $2";
        params.push(rfc);
      } else if (curp) {
        query += " AND curp = $2";
        params.push(curp);
      } else {
        return res.status(400).json({ error: "Se requiere RFC o CURP para la recuperación" });
      }

      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Datos de recuperación incorrectos" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [hashedPassword, email]);
      res.json({ success: true, message: "Contraseña restablecida" });
    } catch (err) {
      res.status(500).json({ error: "Error al restablecer contraseña" });
    }
  });

  app.post("/api/process/log", async (req, res) => {
    const { userId, filename, status, warnings } = req.body;
    try {
      // Start transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Insert process log
        await client.query(
          "INSERT INTO processes (user_id, filename, status, warnings) VALUES ($1, $2, $3, $4)",
          [userId, filename, status, JSON.stringify(warnings)]
        );

        // Decrement credits
        await client.query(
          "UPDATE users SET credits = GREATEST(0, credits - 1) WHERE id = $1",
          [userId]
        );

        await client.query('COMMIT');
        res.json({ success: true });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al registrar proceso" });
    }
  });

  app.get("/api/admin/logs", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT p.*, u.name as user_name, u.plan as user_plan 
        FROM processes p 
        JOIN users u ON p.user_id = u.id 
        ORDER BY p.created_at DESC 
        LIMIT 50
      `);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // Stripe Webhook Handler
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
      if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
      }
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as any;
          const userId = session.client_reference_id;
          const customerId = session.customer;
          const customerEmail = session.customer_details?.email;
          
          if (userId) {
            await pool.query(
              "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
              [customerId, userId]
            );
          } else if (customerEmail) {
            // Fallback: Link by email if reference ID is missing
            await pool.query(
              "UPDATE users SET stripe_customer_id = $1 WHERE email = $2",
              [customerId, customerEmail]
            );
          }
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          const subscription = event.data.object as any;
          const subCustomerId = subscription.customer;
          const status = subscription.status;

          if (status === 'active') {
            // Grant 10,000 credits for active subscription
            await pool.query(
              "UPDATE users SET credits = 10000, plan = 'Pro Unlimited' WHERE stripe_customer_id = $1",
              [subCustomerId]
            );
          }
          break;
        case 'customer.subscription.deleted':
          const deletedSub = event.data.object as any;
          const delCustomerId = deletedSub.customer;
          // Reset to free plan
          await pool.query(
            "UPDATE users SET credits = 5, plan = 'Free Starter' WHERE stripe_customer_id = $1",
            [delCustomerId]
          );
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
