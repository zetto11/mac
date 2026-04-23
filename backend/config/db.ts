import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cctv_cam_db",
  port: parseInt(process.env.DB_PORT || "3306"),
};

// Handle Pool separately for MySQL
export let pool: any = null;
let sqliteDb: any = null;
let isUsingSqlite = false;

export async function connectToDatabase() {
  try {
    console.log(`[DB] Attempting MySQL connection: ${dbConfig.host}:${dbConfig.port}...`);
    pool = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 5 });
    const connection = await pool.getConnection();
    console.log("[DB] MySQL connection established.");
    connection.release();
    return true;
  } catch (err: any) {
    console.warn(`[DB] MySQL Failed (${err.code}). Activating SQLite Fallback...`);
    isUsingSqlite = true;
    setupSqlite();
    return true; // Return true because we are "connected" to SQLite now
  }
}

function setupSqlite() {
  sqliteDb = new Database("cctv_fallback.db");
  
  // Create schema if it's the first time
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'operator'
    );
    CREATE TABLE IF NOT EXISTS cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      zone TEXT NOT NULL,
      ip_simulated TEXT,
      status TEXT DEFAULT 'online',
      is_blocked INTEGER DEFAULT 0,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      lat REAL,
      lng REAL
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      explanation TEXT,
      affected_entity TEXT,
      is_acknowledged INTEGER DEFAULT 0,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      camera_id INTEGER,
      action TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS access_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'online',
      lat REAL,
      lng REAL
    );
  `);

  // Seed default admin if missing
  const user = sqliteDb.prepare("SELECT * FROM users WHERE username = ?").get("admin");
  if (!user) {
    sqliteDb.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
      .run("admin", "$2a$10$Xm57Xf9.f9y9y9y9y9y9yeXm57Xf9.f9y9y9y9y9y9y", "admin");
  }

  // Seed initial cameras if empty
  const cameraCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM cameras").get().count;
  if (cameraCount === 0) {
    const cameras = [
      ["Main Entrance", "Zone A", "192.168.1.10", 51.505, -0.09],
      ["North Parking", "Zone B", "192.168.1.11", 51.506, -0.091],
      ["Data Center", "Zone C", "192.168.1.12", 51.504, -0.089],
      ["East Perimeter", "Zone A", "192.168.1.13", 51.507, -0.085],
      ["Loading Dock", "Zone B", "192.168.1.14", 51.502, -0.095]
    ];
    const insertCam = sqliteDb.prepare("INSERT INTO cameras (name, zone, ip_simulated, lat, lng) VALUES (?, ?, ?, ?, ?)");
    cameras.forEach(cam => insertCam.run(...cam));
  }

  // Seed access points if empty
  const apCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM access_points").get().count;
  if (apCount === 0) {
    const aps = [
      ["Node ALPHA-1", 51.505, -0.09],
      ["Node BETA-4", 51.506, -0.091],
      ["Gateway PRIME", 51.504, -0.089]
    ];
    const insertAP = sqliteDb.prepare("INSERT INTO access_points (name, lat, lng) VALUES (?, ?, ?)");
    aps.forEach(ap => insertAP.run(...ap));
  }
}

// Global query wrapper that works for both MySQL and SQLite
export const db = {
  execute: async (query: string, params: any[] = []) => {
    if (isUsingSqlite) {
      // Convert ? to SQLite compatible if needed (better-sqlite3 likes positional ?)
      const stmt = sqliteDb.prepare(query.replace(/CURRENT_TIMESTAMP/g, "datetime('now')"));
      if (query.toUpperCase().startsWith("SELECT")) {
        return [stmt.all(...params)];
      } else {
        const result = stmt.run(...params);
        return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }];
      }
    } else {
      return await pool.execute(query, params);
    }
  }
};
