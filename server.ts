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
    try {
      const result = await pool.query("SELECT credits, plan FROM users LIMIT 1");
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.json({ credits: 5, plan: "Free Starter" });
      }
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/admin/metrics", async (req, res) => {
    try {
      const usersCount = await pool.query("SELECT COUNT(*) FROM users");
      const processesCount = await pool.query("SELECT COUNT(*) FROM processes WHERE created_at >= CURRENT_DATE");
      
      res.json({
        totalUsers: parseInt(usersCount.rows[0].count),
        dailyRevenue: 0,
        processedToday: parseInt(processesCount.rows[0].count),
        anomalyRate: 0.72
      });
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // Stripe Checkout Session
  app.post("/api/billing/create-checkout-session", async (req, res) => {
    try {
      const { planId } = req.body;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
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
      res.json({ id: session.id });
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
        [name, email, hashedPassword, rfc, curp, rfc, curp]
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
      const result = await pool.query(
        "SELECT * FROM users WHERE email = $1 AND rfc = $2 AND curp = $3",
        [email, rfc, curp]
      );
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
    const { filename, status, warnings } = req.body;
    try {
      await pool.query(
        "INSERT INTO processes (user_id, filename, status, warnings) VALUES ((SELECT id FROM users LIMIT 1), $1, $2, $3)",
        [filename, status, JSON.stringify(warnings)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Error al registrar proceso" });
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
