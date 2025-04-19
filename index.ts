import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import agentRoutes from "./routes/agentRoutes";
import { logger } from "./utils/logger";
import cron from 'node-cron';
import { runScheduledAgentTask } from './agent';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// MongoDB Connection
let mongoClient: MongoClient;
async function connectDB() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI as string);
    await client.db("admin").command({ ping: 1 });
    logger.info("Successfully connected to MongoDB!");
    mongoClient = client;
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

// Start server and initialize scheduler AFTER DB connection
connectDB().then(() => {
  if (!mongoClient) {
    logger.error("MongoDB client not initialized. Scheduler cannot start.");
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);

    // Initialize Scheduler
    logger.info('Initializing Tweet Bot Scheduler...');
    // Schedule task to run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      logger.info('Running scheduled Twitter content generation job (every 5 mins)...');
      try {
        // Define the high-level task for content generation
        const taskQuery = "Generate and post original, humorous, engaging content promoting Asynchronus (@asynchronus_ai) and its value in the AI/DeFi/Decentralized AI space.";

        // Trigger the agent execution using the established MongoDB client
        const result = await runScheduledAgentTask(mongoClient, taskQuery);

        logger.info('Scheduled Twitter content generation job finished.', { result });
      } catch (error) {
        logger.error('Error executing scheduled content generation job:', { error });
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    logger.info('Tweet Bot Scheduler initialized and running every 5 minutes (content generation).');

    // Immediate trigger on startup remains enabled
    logger.info('Triggering initial Twitter content generation task immediately after startup...');
    runScheduledAgentTask(mongoClient, "Generate and post one initial, humorous tweet promoting Asynchronus (@asynchronus_ai).")
      .then(result => {
        logger.info('Initial Twitter content generation job finished.', { result });
      })
      .catch(error => {
        logger.error('Error executing initial content generation job:', { error });
      });

  });
});
