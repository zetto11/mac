import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { db } from "../config/db";

export const getAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await db.execute("SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 50");
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const acknowledgeAlert = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await db.execute("UPDATE alerts SET is_acknowledged = 1 WHERE id = ?", [id]);
    await db.execute(
      "INSERT INTO access_logs (user_id, action) VALUES (?, ?)",
      [req.user?.id, `ACKNOWLEDGE_ALERT_${id}`]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const acknowledgeAllAlerts = async (req: AuthRequest, res: Response) => {
  try {
    await db.execute("UPDATE alerts SET is_acknowledged = 1 WHERE is_acknowledged = 0");
    await db.execute(
      "INSERT INTO access_logs (user_id, action) VALUES (?, ?)",
      [req.user?.id, "ACKNOWLEDGE_ALL_ALERTS"]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
