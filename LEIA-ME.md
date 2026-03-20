import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from dist/public
const publicPath = path.join(__dirname, "../dist/public");
app.use(express.static(publicPath));

// Register API routes
registerRoutes(app);

// Fallback to index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
