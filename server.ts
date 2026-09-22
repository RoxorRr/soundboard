import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import statusHandler from "./api/status";
import scanStickerHandler from "./api/scan-sticker";
import ttsHandler from "./api/tts";
import creditsHandler from "./api/credits";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support image payloads up to 20MB for camera captures
  app.use(express.json({ limit: "20mb" }));

  // Mount API endpoints shared with Vercel serverless functions
  app.get("/api/status", (req, res) => statusHandler(req, res));
  app.get("/api/credits", (req, res) => creditsHandler(req, res));
  app.post("/api/credits", (req, res) => creditsHandler(req, res));
  app.post("/api/scan-sticker", (req, res) => scanStickerHandler(req, res));
  app.post("/api/tts", (req, res) => ttsHandler(req, res));

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pelham Pelicans Hockey Tracker running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
