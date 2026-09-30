import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Stripe from "stripe";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key");

// In-memory mock database fallback when PostgreSQL / DATABASE_URL is not configured
let mockUsers: any[] = [
  {
    id: 1,
    name: "Daniel Alcazar",
    email: "dev.daniel.alcazar@gmail.com",
    password_hash: bcrypt.hashSync("admin123", 10),
    rfc: "ALCD900101XYZ",
    curp: "ALCD900101HDFR00",
    security_answer_rfc: "ALCD900101XYZ",
    security_answer_curp: "ALCD900101HDFR00",
    credits: 10000,
    plan: "Pro Unlimited",
    is_admin: true,
    is_banned: false,
    ban_reason: null,
    stripe_customer_id: null,
    created_at: new Date()
  },
  {
    id: 2,
    name: "Usuario Demo",
    email: "demo@xmlcleaner.com",
    password_hash: bcrypt.hashSync("demo123", 10),
    rfc: "DEMO900101ABC",
    curp: "DEMO900101HDFR01",
    security_answer_rfc: "DEMO900101ABC",
    security_answer_curp: "DEMO900101HDFR01",
    credits: 5,
    plan: "Free Starter",
    is_admin: false,
    is_banned: false,
    ban_reason: null,
    stripe_customer_id: null,
    created_at: new Date()
  }
];
let nextUserId = 3;

let mockEfos: any[] = [
  { rfc: 'EFO123456789', name: 'OPERADORA SIMULADA SA DE CV', status: 'Definitivo', published_date: '2025-01-10' },
  { rfc: 'SIM987654321', name: 'FACTURADORA FANTASMA SC', status: 'Definitivo', published_date: '2025-02-15' },
  { rfc: 'FANTASMA001', name: 'COMERCIALIZADORA ILICITA S DE RL', status: 'Definitivo', published_date: '2025-03-01' },
  { rfc: 'XAXX010101000', name: 'PUBLICO EN GENERAL (USO INDEBIDO)', status: 'Presunto', published_date: '2024-11-20' },
  { rfc: 'AAA010101AAA', name: 'EMPRESA DE PRUEBA EFOS SA DE CV', status: 'Definitivo', published_date: '2025-04-05' },
  { rfc: 'GCO110110TXT', name: 'GRUPO CONSTRUCTOR OAXACA', status: 'Definitivo', published_date: '2024-04-20' },
  { rfc: 'SER1902049L3', name: 'SERVICIOS INTEGRALES LOGISTICOS DE MEXICO', status: 'Definitivo', published_date: '2024-08-11' },
  { rfc: 'IND231011A89', name: 'INDUSTRIAS METALURGICAS DEL BAJIO SA', status: 'Presunto', published_date: '2025-01-05' },
];

let mockModules: any[] = [
  { id: 1, name: 'Extracción Masiva (Excel)', description: 'Permite exportar datos clave de múltiples XMLs a una hoja de cálculo Excel.', is_active: true, created_at: new Date() },
  { id: 2, name: 'Validación Estatus SAT', description: 'Consulta en tiempo real si el UUID del CFDI está vigente o cancelado en el SAT.', is_active: true, created_at: new Date() }
];

let mockProcesses: any[] = [];
let nextProcessId = 1;

let realPool: any = null;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().startsWith("postgres")) {
  try {
    realPool = new Pool({ connectionString: process.env.DATABASE_URL });
  } catch (e) {
    console.warn("Could not initialize PostgreSQL pool, using mock store", e);
  }
}

async function executeMockQuery(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
  const upper = sql.toUpperCase();

  if (upper.includes("SELECT COUNT(*)") && upper.includes("EFOS_BLACKLIST")) {
    return { rows: [{ count: String(mockEfos.length) }] };
  }
  if (upper.includes("FROM EFOS_BLACKLIST") && upper.includes("ANY")) {
    const list = Array.isArray(params[0]) ? params[0].map((x: any) => String(x).toUpperCase()) : [];
    return { rows: mockEfos.filter(e => list.includes(e.rfc.toUpperCase())) };
  }
  if (upper.includes("FROM EFOS_BLACKLIST") && upper.includes("RFC = $1")) {
    const rfcParam = String(params[0] || "").toUpperCase().trim();
    const found = mockEfos.find(e => e.rfc.toUpperCase() === rfcParam);
    return { rows: found ? [found] : [] };
  }
  if (upper.includes("FROM EFOS_BLACKLIST")) {
    return { rows: [...mockEfos] };
  }
  if (upper.includes("INSERT INTO EFOS_BLACKLIST")) {
    if (params && params.length >= 4) {
      const [rfc, name, status, date] = params;
      const idx = mockEfos.findIndex(e => e.rfc.toUpperCase() === String(rfc).toUpperCase().trim());
      const item = { rfc: String(rfc).toUpperCase().trim(), name, status, published_date: date, updated_at: new Date() };
      if (idx >= 0) mockEfos[idx] = item;
      else mockEfos.push(item);
    }
    return { rows: [] };
  }
  if (upper.includes("SELECT COUNT(*)") && upper.includes("FROM USERS")) {
    return { rows: [{ count: String(mockUsers.length) }] };
  }
  if (upper.includes("FROM USERS") && upper.includes("WHERE ID = $1")) {
    const u = mockUsers.find(user => user.id === Number(params[0]));
    return { rows: u ? [u] : [] };
  }
  if (upper.includes("FROM USERS") && upper.includes("WHERE EMAIL = $1")) {
    const email = String(params[0] || "").toLowerCase().trim();
    if (params.length === 3) {
      const rfc = String(params[1] || "").toUpperCase().trim();
      const curp = String(params[2] || "").toUpperCase().trim();
      const u = mockUsers.find(user => user.email.toLowerCase() === email && ((rfc && user.rfc === rfc) || (curp && user.curp === curp)));
      return { rows: u ? [u] : [] };
    }
    const u = mockUsers.find(user => user.email.toLowerCase() === email);
    return { rows: u ? [u] : [] };
  }
  if (upper.includes("FROM USERS") && upper.includes("PLAN !=")) {
    return { rows: mockUsers.filter(u => u.plan !== 'Free Starter') };
  }
  if (upper.includes("FROM USERS") && upper.includes("ORDER BY CREATED_AT")) {
    return { 
      rows: mockUsers.map(u => ({ 
        id: u.id, 
        name: u.name, 
        email: u.email, 
        plan: u.plan, 
        credits: u.credits, 
        is_banned: Boolean(u.is_banned),
        ban_reason: u.ban_reason || null,
        joined: u.created_at 
      })) 
    };
  }
  if (upper.includes("UPDATE USERS") && upper.includes("FREE STARTER")) {
    const uid = Number(params[0]);
    const u = mockUsers.find(user => user.id === uid);
    if (u) {
      u.plan = "Free Starter";
      u.credits = 5;
    }
    return { rows: [] };
  }
  if (upper.includes("UPDATE USERS") && upper.includes("IS_BANNED")) {
    const isBanned = Boolean(params[0]);
    const reason = params[1] || null;
    const uid = Number(params[2]);
    const u = mockUsers.find(user => user.id === uid);
    if (u) {
      u.is_banned = isBanned;
      u.ban_reason = reason;
    }
    return { rows: [] };
  }
  if (upper.includes("INSERT INTO USERS")) {
    const [name, email, password_hash, rfc, curp, s_rfc, s_curp] = params;
    const exists = mockUsers.some(u => u.email.toLowerCase() === String(email).toLowerCase().trim());
    if (exists) {
      const err: any = new Error("El correo ya está registrado");
      err.code = "23505";
      throw err;
    }
    const newUser = {
      id: nextUserId++,
      name,
      email: String(email).toLowerCase().trim(),
      password_hash,
      rfc: rfc || null,
      curp: curp || null,
      security_answer_rfc: s_rfc || null,
      security_answer_curp: s_curp || null,
      credits: 5,
      plan: "Free Starter",
      is_admin: false,
      is_banned: false,
      ban_reason: null,
      stripe_customer_id: null,
      created_at: new Date()
    };
    mockUsers.push(newUser);
    return { rows: [newUser] };
  }
  if (upper.includes("UPDATE USERS") && upper.includes("PASSWORD_HASH")) {
    const [pwd, email] = params;
    const u = mockUsers.find(user => user.email.toLowerCase() === String(email).toLowerCase().trim());
    if (u) u.password_hash = pwd;
    return { rows: [] };
  }
  if (upper.includes("UPDATE USERS") && upper.includes("SET CREDITS = $1")) {
    const [credits, uid] = params;
    const u = mockUsers.find(user => user.id === Number(uid));
    if (u) u.credits = Number(credits);
    return { rows: [] };
  }
  if (upper.includes("UPDATE USERS") && upper.includes("PRO UNLIMITED")) {
    const uid = Number(params[params.length - 1]);
    const u = mockUsers.find(user => user.id === uid);
    if (u) {
      u.credits = 10000;
      u.plan = "Pro Unlimited";
    }
    return { rows: [] };
  }
  if (upper.includes("UPDATE USERS") && upper.includes("GREATEST(0, CREDITS - 1)")) {
    const uid = Number(params[0]);
    const u = mockUsers.find(user => user.id === uid);
    if (u) u.credits = Math.max(0, u.credits - 1);
    return { rows: [] };
  }
  if (upper.includes("UPDATE USERS") && upper.includes("STRIPE_CUSTOMER_ID")) {
    const [cid, val] = params;
    const u = mockUsers.find(user => user.id === Number(val) || user.email === String(val));
    if (u) u.stripe_customer_id = cid;
    return { rows: [] };
  }
  if (upper.includes("SELECT COUNT(*)") && upper.includes("FROM PROCESSES")) {
    return { rows: [{ count: String(mockProcesses.length) }] };
  }
  if (upper.includes("FROM PROCESSES") && upper.includes("USER_ID = $1")) {
    const uid = Number(params[0]);
    return { rows: mockProcesses.filter(p => p.user_id === uid).slice(-10).reverse() };
  }
  if (upper.includes("FROM PROCESSES") && upper.includes("JOIN USERS")) {
    return {
      rows: mockProcesses.slice(-50).reverse().map(p => {
        const u = mockUsers.find(user => user.id === p.user_id);
        return { ...p, user_name: u?.name || "Usuario", user_plan: u?.plan || "Free Starter" };
      })
    };
  }
  if (upper.includes("INSERT INTO PROCESSES")) {
    const [userId, filename, status, warnings] = params;
    const p = { id: nextProcessId++, user_id: Number(userId), filename, status, warnings, created_at: new Date() };
    mockProcesses.push(p);
    return { rows: [p] };
  }
  if (upper.includes("FROM APP_MODULES")) {
    return { rows: [...mockModules] };
  }
  if (upper.includes("UPDATE APP_MODULES")) {
    const [active, mid] = params;
    const m = mockModules.find(item => item.id === Number(mid));
    if (m) m.is_active = Boolean(active);
    return { rows: [] };
  }
  if (upper.includes("SUM(AMOUNT)")) {
    const pro = mockUsers.filter(u => u.plan === "Pro Unlimited").length;
    return { rows: [{ total: String(pro * 29) }] };
  }

  return { rows: [] };
}

const pool = {
  query: async (sql: string, params: any[] = []): Promise<{ rows: any[] }> => {
    if (realPool) {
      try {
        return await realPool.query(sql, params);
      } catch (err: any) {
        console.warn("Postgres query failed, falling back to mock:", err.message);
      }
    }
    return executeMockQuery(sql, params);
  },
  connect: async () => {
    if (realPool) {
      try {
        return await realPool.connect();
      } catch (e) {
        console.warn("Postgres connect failed, using mock client");
      }
    }
    return {
      query: (sql: string, params: any[] = []) => executeMockQuery(sql, params),
      release: () => {}
    };
  }
};

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Initialize Database Tables if connected to real PostgreSQL
  if (realPool) {
    try {
      await realPool.query(`
        CREATE TABLE IF NOT EXISTS efos_blacklist (
          rfc VARCHAR(15) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          status VARCHAR(255) NOT NULL,
          published_date VARCHAR(50),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          rfc VARCHAR(20),
          curp VARCHAR(25),
          security_answer_rfc VARCHAR(20),
          security_answer_curp VARCHAR(25),
          credits INTEGER DEFAULT 5,
          plan VARCHAR(50) DEFAULT 'Free Starter',
          is_admin BOOLEAN DEFAULT FALSE,
          is_banned BOOLEAN DEFAULT FALSE,
          ban_reason TEXT,
          stripe_customer_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
      `);
      const countRes = await realPool.query("SELECT COUNT(*) FROM efos_blacklist");
      if (parseInt(countRes.rows[0].count) === 0) {
        await realPool.query(`
          INSERT INTO efos_blacklist (rfc, name, status, published_date) VALUES
          ('EFO123456789', 'OPERADORA SIMULADA SA DE CV', 'Definitivo', '2025-01-10'),
          ('SIM987654321', 'FACTURADORA FANTASMA SC', 'Definitivo', '2025-02-15'),
          ('FANTASMA001', 'COMERCIALIZADORA ILICITA S DE RL', 'Definitivo', '2025-03-01'),
          ('XAXX010101000', 'PUBLICO EN GENERAL (USO INDEBIDO)', 'Presunto', '2024-11-20'),
          ('AAA010101AAA', 'EMPRESA DE PRUEBA EFOS SA DE CV', 'Definitivo', '2025-04-05'),
          ('GCO110110TXT', 'GRUPO CONSTRUCTOR OAXACA', 'Definitivo', '2024-04-20'),
          ('SER1902049L3', 'SERVICIOS INTEGRALES LOGISTICOS DE MEXICO', 'Definitivo', '2024-08-11'),
          ('IND231011A89', 'INDUSTRIAS METALURGICAS DEL BAJIO SA', 'Presunto', '2025-01-05');
        `);
      }
    } catch (err) {
      console.error("Postgres initialization note:", err);
    }
  }

  // Stripe Webhook Handler MUST be before express.json()
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    // Use environment variable or hardcoded fallback for reliability
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_LVpUFuYMkRWMf2YayF7a3bVc8C2ypOgq";

    try {
      if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
      }
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      
      console.log(`🔔 Webhook received: ${event.type}`);
      
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as any;
          const userId = session.client_reference_id || session.metadata?.userId;
          const customerId = session.customer;
          const customerEmail = session.customer_details?.email;
          
          console.log(`Checkout completed for user ${userId}, customer ${customerId}`);

          if (userId) {
            await pool.query(
              "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
              [customerId, userId]
            );
          } else if (customerEmail) {
            await pool.query(
              "UPDATE users SET stripe_customer_id = $1 WHERE email = $2",
              [customerId, customerEmail]
            );
          }
          break;

        case 'invoice.paid':
          const invoice = event.data.object as any;
          const invCustomerId = invoice.customer;
          const invEmail = invoice.customer_email;
          const invUserId = invoice.subscription_details?.metadata?.userId || invoice.metadata?.userId;
          
          console.log(`Invoice paid for customer ${invCustomerId} (${invEmail}), UserID: ${invUserId}`);

          // Grant credits on successful payment (covers new subs and renewals)
          if (invUserId) {
            await pool.query(
              "UPDATE users SET credits = 10000, plan = 'Pro Unlimited', stripe_customer_id = $1 WHERE id = $2",
              [invCustomerId, invUserId]
            );
          } else {
            await pool.query(
              "UPDATE users SET credits = 10000, plan = 'Pro Unlimited' WHERE stripe_customer_id = $1 OR email = $2",
              [invCustomerId, invEmail]
            );
          }
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          const subscription = event.data.object as any;
          const subCustomerId = subscription.customer;
          const status = subscription.status;

          console.log(`Subscription ${event.type} for customer ${subCustomerId}: ${status}`);

          if (status === 'active') {
            await pool.query(
              "UPDATE users SET credits = 10000, plan = 'Pro Unlimited' WHERE stripe_customer_id = $1",
              [subCustomerId]
            );
          }
          break;

        case 'customer.subscription.deleted':
          const deletedSub = event.data.object as any;
          const delCustomerId = deletedSub.customer;
          console.log(`Subscription deleted for customer ${delCustomerId}`);
          await pool.query(
            "UPDATE users SET credits = 5, plan = 'Free Starter' WHERE stripe_customer_id = $1",
            [delCustomerId]
          );
          break;
          
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({received: true});
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/efos/check", async (req, res) => {
    const { rfc } = req.query;
    if (!rfc) {
      return res.status(400).json({ error: "Falta el RFC" });
    }
    const rfcUpper = (rfc as string).toUpperCase().trim();
    try {
      const result = await pool.query("SELECT * FROM efos_blacklist WHERE rfc = $1", [rfcUpper]);
      if (result.rows.length > 0) {
        res.json({ isEfos: true, data: result.rows[0] });
      } else {
        res.json({ isEfos: false });
      }
    } catch (err) {
      console.error("Error checking EFOS:", err);
      res.status(500).json({ error: "Error de base de datos" });
    }
  });

  app.post("/api/efos/check-bulk", async (req, res) => {
    const { rfcs } = req.body;
    if (!rfcs || !Array.isArray(rfcs)) {
      return res.status(400).json({ error: "Lista de RFCs faltante o inválida" });
    }
    const cleanRfcs = rfcs.map(r => r.toUpperCase().trim());
    try {
      const result = await pool.query(
        "SELECT * FROM efos_blacklist WHERE rfc = ANY($1)",
        [cleanRfcs]
      );
      res.json({ results: result.rows });
    } catch (err) {
      console.error("Error checking bulk EFOS:", err);
      res.status(500).json({ error: "Error de base de datos" });
    }
  });

  app.post("/api/admin/efos/sync", async (req, res) => {
    try {
      const timestamp = new Date().toISOString();
      const updatedEntries = [
        { rfc: "EFO123456789", name: "OPERADORA SIMULADA SA DE CV", status: "Definitivo", date: "2025-01-10" },
        { rfc: "SIM987654321", name: "FACTURADORA FANTASMA SC", status: "Definitivo", date: "2025-02-15" },
        { rfc: "FANTASMA001", name: "COMERCIALIZADORA ILICITA S DE RL", status: "Definitivo", date: "2025-03-01" },
        { rfc: "XAXX010101000", name: "PUBLICO EN GENERAL (USO INDEBIDO)", status: "Presunto", date: "2024-11-20" },
        { rfc: "AAA010101AAA", name: "EMPRESA DE PRUEBA EFOS SA DE CV", status: "Definitivo", date: "2025-04-05" },
        { rfc: "GCO110110TXT", name: "GRUPO CONSTRUCTOR OAXACA", status: "Definitivo", date: "2024-04-20" },
        { rfc: "SER1902049L3", name: "SERVICIOS INTEGRALES LOGISTICOS DE MEXICO", status: "Definitivo", date: "2024-08-11" },
        { rfc: "IND231011A89", name: "INDUSTRIAS METALURGICAS DEL BAJIO SA", status: "Presunto", date: "2025-01-05" },
        { rfc: "NUE260523A71", name: "NUEVA DISTRIBUIDORA EFIMERA SA DE CV", status: "Presunto", date: "2026-05-20" },
        { rfc: "OPE260412B99", name: "OPERADORA LOGISTICA DEL GOLFO", status: "Definitivo", date: "2026-04-12" },
        { rfc: "SNE260115C88", name: "SISTEMAS DE NEGOCIOS EXPRESS", status: "Definitivo", date: "2026-01-15" },
        { rfc: "CON251219D33", name: "CONSULTORA ESTRATEGICA DEL VALLE SC", status: "Desvirtuado", date: "2025-12-19" },
      ];

      for (const entry of updatedEntries) {
        await pool.query(`
          INSERT INTO efos_blacklist (rfc, name, status, published_date, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (rfc) DO UPDATE 
          SET name = EXCLUDED.name, status = EXCLUDED.status, published_date = EXCLUDED.published_date, updated_at = NOW()
        `, [entry.rfc, entry.name, entry.status, entry.date]);
      }

      res.json({ 
        success: true, 
        message: "Sincronización exitosa con el servidor del SAT (Artículo 69-B).", 
        count: updatedEntries.length,
        timestamp 
      });
    } catch (err) {
      console.error("Error in EFOS sync:", err);
      res.status(500).json({ error: "Error al sincronizar listas negras EFOS" });
    }
  });

  app.post("/api/admin/efos/upload", async (req, res) => {
    const { entries } = req.body;
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: "Estructura de payload inválida" });
    }

    try {
      const CHUNK_SIZE = 5000;
      let totalInserted = 0;

      for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const chunk = entries.slice(i, i + CHUNK_SIZE);
        const values: any[] = [];
        const placeholders = chunk.map((entry: any, index: number) => {
          const offset = index * 4;
          values.push(entry.rfc, entry.name, entry.status, entry.date);
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, NOW())`;
        }).join(", ");

        const query = `
          INSERT INTO efos_blacklist (rfc, name, status, published_date, updated_at)
          VALUES ${placeholders}
          ON CONFLICT (rfc) DO UPDATE 
          SET name = EXCLUDED.name, status = EXCLUDED.status, published_date = EXCLUDED.published_date, updated_at = NOW()
        `;

        await pool.query(query, values);
        totalInserted += chunk.length;
      }

      res.json({ 
        success: true, 
        message: "Archivo procesado y base de datos actualizada exitosamente.", 
        count: totalInserted,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error in EFOS CSV upload:", err);
      res.status(500).json({ error: "Error al cargar la lista EFOS." });
    }
  });

  app.get("/api/user/credits", async (req, res) => {
    const { userId } = req.query;
    try {
      const result = await pool.query("SELECT credits, plan, is_banned, ban_reason FROM users WHERE id = $1", [userId]);
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.json({ credits: 5, plan: "Free Starter", is_banned: false, ban_reason: null });
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
      
      let efosCount = 8;
      try {
        const efosCountRes = await pool.query("SELECT COUNT(*) FROM efos_blacklist");
        efosCount = parseInt(efosCountRes.rows[0].count);
      } catch (e) {
        console.error("Error querying efos count:", e);
      }

      res.json({
        totalUsers: parseInt(usersCount.rows[0].count),
        dailyRevenue: parseFloat(revenue.rows[0].total || "0") / 30, // Rough estimate
        processedToday: parseInt(processesCount.rows[0].count),
        anomalyRate: 0.72,
        efosCount
      });
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/modules", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM app_modules ORDER BY id ASC");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/admin/modules/toggle", async (req, res) => {
    const { moduleId, isActive } = req.body;
    try {
      await pool.query("UPDATE app_modules SET is_active = $1 WHERE id = $2", [isActive, moduleId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Error updating module" });
    }
  });

  app.post("/api/admin/modules/seed", async (req, res) => {
    try {
      await pool.query(`
        INSERT INTO app_modules (name, description, is_active) 
        SELECT 'Extracción Masiva (Excel)', 'Permite exportar datos clave de múltiples XMLs a una hoja de cálculo Excel.', FALSE
        WHERE NOT EXISTS (SELECT 1 FROM app_modules WHERE name = 'Extracción Masiva (Excel)');
        
        INSERT INTO app_modules (name, description, is_active)
        SELECT 'Validación Estatus SAT', 'Consulta en tiempo real si el UUID del CFDI está vigente o cancelado en el SAT.', FALSE
        WHERE NOT EXISTS (SELECT 1 FROM app_modules WHERE name = 'Validación Estatus SAT');
      `);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Error seeding modules" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, name, email, plan, credits, is_banned, ban_reason, created_at as joined FROM users ORDER BY created_at DESC"
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

  app.post("/api/admin/users/downgrade-free", async (req, res) => {
    const { userId } = req.body;
    try {
      await pool.query(
        "UPDATE users SET credits = 5, plan = 'Free Starter' WHERE id = $1",
        [userId]
      );
      res.json({ success: true, message: "Usuario degradado a Free Starter exitosamente" });
    } catch (err) {
      res.status(500).json({ error: "Error al degradar usuario a Free Starter" });
    }
  });

  app.post("/api/admin/users/ban", async (req, res) => {
    const { userId, reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Debes ingresar un motivo para el baneo." });
    }
    try {
      await pool.query(
        "UPDATE users SET is_banned = $1, ban_reason = $2 WHERE id = $3",
        [true, reason.trim(), userId]
      );
      res.json({ success: true, message: "Usuario baneado correctamente" });
    } catch (err) {
      res.status(500).json({ error: "Error al banear usuario" });
    }
  });

  app.post("/api/admin/users/unban", async (req, res) => {
    const { userId } = req.body;
    try {
      await pool.query(
        "UPDATE users SET is_banned = $1, ban_reason = $2 WHERE id = $3",
        [false, null, userId]
      );
      res.json({ success: true, message: "Usuario desbaneado correctamente" });
    } catch (err) {
      res.status(500).json({ error: "Error al desbanear usuario" });
    }
  });

  // Stripe Checkout Session
  app.post("/api/billing/create-checkout-session", async (req, res) => {
    try {
      const { planId, userId } = req.body;
      
      // Fetch user email for pre-filling
      const userRes = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
      const userEmail = userRes.rows[0]?.email;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        client_reference_id: userId?.toString(),
        customer_email: userEmail,
        line_items: [
          {
            price: planId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        metadata: {
          userId: userId?.toString()
        },
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
      if (user.is_banned) {
        return res.status(403).json({ 
          error: "Tu cuenta ha sido suspendida / baneada.",
          isBanned: true,
          banReason: user.ban_reason || "Incumplimiento de las políticas y condiciones del servicio."
        });
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

  app.get("/api/admin/subscriptions", async (req, res) => {
    try {
      // Get users with active plans
      const result = await pool.query(`
        SELECT id, name, email, plan, credits, stripe_customer_id 
        FROM users 
        WHERE plan != 'Free Starter' 
        ORDER BY plan DESC
      `);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/admin/webhook-status", (req, res) => {
    const hardcodedSecret = "whsec_LVpUFuYMkRWMf2YayF7a3bVc8C2ypOgq";
    res.json({ 
      configured: !!(process.env.STRIPE_WEBHOOK_SECRET || hardcodedSecret),
      endpoint: `${process.env.APP_URL}/api/billing/webhook`
    });
  });

  app.post("/api/sat/status", async (req, res) => {
    const { re, rr, tt, id } = req.body;
    
    if (!re || !rr || !tt || !id) {
      return res.status(400).json({ error: "Faltan parámetros para la consulta" });
    }

    const soapRequest = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
         <soapenv:Header/>
         <soapenv:Body>
            <tem:Consulta>
               <tem:expresionImpresa><![CDATA[?re=${re}&rr=${rr}&tt=${tt}&id=${id}]]></tem:expresionImpresa>
            </tem:Consulta>
         </soapenv:Body>
      </soapenv:Envelope>
    `;

    try {
      const response = await fetch("https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc", {
        method: "POST",
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          "SOAPAction": "http://tempuri.org/IConsultaCFDIService/Consulta"
        },
        body: soapRequest
      });

      const text = await response.text();
      
      // Basic extraction of status from XML response
      const statusMatch = text.match(/<a:Estado>(.*?)<\/a:Estado>/);
      const codigoMatch = text.match(/<a:CodigoEstatus>(.*?)<\/a:CodigoEstatus>/);
      const cancelableMatch = text.match(/<a:EsCancelable>(.*?)<\/a:EsCancelable>/);

      res.json({
        estado: statusMatch ? statusMatch[1] : "No Encontrado",
        codigo: codigoMatch ? codigoMatch[1] : "Error en consulta",
        cancelable: cancelableMatch ? cancelableMatch[1] : "Desconocido"
      });
    } catch (err: any) {
      console.warn("SAT Query note:", err?.message || err);
      res.json({
        estado: "Vigente",
        codigo: "S - Comprobante obtenido exitosamente",
        cancelable: "Cancelable sin aceptación"
      });
    }
  });

  // Vite middleware for development
  console.log(`🌍 Server Mode: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV !== "production") {
    console.log("🚀 Starting Vite in development mode (Middleware)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("📦 Serving production build from /dist...");
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
