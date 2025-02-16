import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import agentRoutes from "./routes/agentRoutes";
import { logger } from "./utils/logger";

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// MongoDB Connection
async function connectDB() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI as string);
    await client.db("admin").command({ ping: 1 });
    logger.info("Successfully connected to MongoDB!");
    return client;
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

// Routes
app.use("/api/agent", agentRoutes);

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error", { error: err });
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
);

const PORT = process.env.PORT || 3000;

// Start server with DB connection
connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
});
