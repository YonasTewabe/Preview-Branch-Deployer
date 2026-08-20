import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import githubRoutes from "./routes/github.js";
import buildRoutes from "./routes/build.js";
import jenkinsRoutes from "./routes/jenkins.js";
import nodesSampleFileRoutes from "./routes/nodesSampleFileRoutes.js";
import projectsRoutes from "./routes/projects.js";
import usersRoutes from "./routes/users.js";
import nodesRoutes from "./routes/nodes.js";
import authRoutes from "./routes/auth.js";
import emailRoutes from "./routes/emails.js";
import environmentsRoutes from "./routes/environments.js";
import statsRoutes from "./routes/stats.js";
import configurationRoutes from "./routes/configuration.js";
import trashRoutes from "./routes/trash.js";

import { testConnection } from "./config/database.js";
import { initAssociations, syncDatabase } from "./models/index.js";
import { scheduleStalePreviewNodeCleanup } from "./jobs/stalePreviewNodeCleanup.js";
import { scheduleTrashCleanup } from "./jobs/trashCleanup.js";

dotenv.config();
const app = express();

// ✅ Dynamic CORS configuration
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((u) => u.trim())
  : [];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.use("/api/nodes", nodesRoutes);

app.use("/api/github", githubRoutes);
app.use("/api", buildRoutes);
app.use("/api/jenkins", jenkinsRoutes);
app.use("/api/nodes-static-json", nodesSampleFileRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/users", usersRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api", environmentsRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/configuration", configurationRoutes);
app.use("/api/trash", trashRoutes);

// ✅ Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// ✅ Initialize associations and DB connection before routes execute
const startServer = async () => {
  try {
    initAssociations();

    await testConnection();

    try {
      await syncDatabase();
      console.warn("✅ Database synchronized successfully");
    } catch (syncError) {
      console.warn("⚠️  Database sync warning:", syncError.message);
    }

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.warn(`🚀 Server is running on port ${PORT}`);
      scheduleStalePreviewNodeCleanup();
      scheduleTrashCleanup();
    });
  } catch (error) {
    console.error("❌ Startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
