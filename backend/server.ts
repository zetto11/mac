import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import { connectToDatabase, db } from "./config/db";
import { authenticateToken, isAdmin } from "./middleware/authMiddleware";
import authRoutes from "./routes/authRoutes";
import createCameraRouter from "./routes/cameraRoutes";
import alertRoutes from "./routes/alertRoutes";
import logRoutes from "./routes/logRoutes";
import systemRoutes from "./routes/systemRoutes";
import { getSystemStatus, getAccessPoints, getUsers } from "./controllers/systemController";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Database connection is non-blocking to ensure dev server starts even if DB is slow
  const isDbConnected = await connectToDatabase().catch(err => {
    console.error("Database connection failed during startup:", err.message);
    return false;
  });
  
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(cors());
  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    if (!req.url.startsWith('/@vite') && !req.url.startsWith('/src')) {
      console.log(`[API] ${req.method} ${req.url}`);
    }
    next();
  });

  // Basic Health Check
  app.get("/api/health", (req, res) => res.json({ 
    status: "alive", 
    dbConnected: isDbConnected 
  }));

  // Modern Modular Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/cameras", createCameraRouter(io));
  app.use("/api/alerts", alertRoutes);
  app.use("/api/logs", logRoutes);
  app.use("/api/system", systemRoutes);

  // --- LEGACY ROUTE MAPPING (For current frontend compatibility) ---
  app.use("/api", authRoutes); // Handles /api/login and /api/register
  app.get("/api/system-status", authenticateToken, getSystemStatus);
  app.get("/api/access-points", authenticateToken, getAccessPoints);
  app.get("/api/users", authenticateToken, isAdmin, getUsers);

  // --- SIMULATION ENGINE ---
  setInterval(async () => {
    try {
      const [cameras]: any = await db.execute("SELECT id, status FROM cameras");
      for (const cam of cameras) {
        if (Math.random() < 0.05) {
          const newStatus = cam.status === "online" ? "offline" : "online";
          await db.execute("UPDATE cameras SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?", [newStatus, cam.id]);
          io.emit("camera_update", { id: cam.id, status: newStatus });
          
          if (newStatus === "offline") {
            const [result]: any = await db.execute(
              "INSERT INTO alerts (type, severity, description, camera_id) VALUES (?, ?, ?, ?)",
              ["system", "high", `Security node CAM-${cam.id} lost connectivity`, cam.id]
            );
            
            io.emit("new_alert", { 
              id: result.insertId,
              type: "system", 
              severity: "high", 
              description: `Security node CAM-${cam.id} lost connectivity`,
              timestamp: new Date().toISOString(),
              is_acknowledged: false
            });
          }
        }
      }
    } catch (e) {
      // console.error("Sim error", e);
    }
  }, 5000);

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.resolve(__dirname, ".."), 
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n--- MODERNIZED SOC SINK ONLINE ---`);
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: ${isDbConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`----------------------------------\n`);
  });
}

startServer();
