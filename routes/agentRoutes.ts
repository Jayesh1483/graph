import express, { Router, Request, Response } from "express";
import { AgentController } from "../controllers/agentController";
import { validateRequestBody } from "../middleware/validation";
import { errorHandler } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

const router: Router = express.Router();

/**
 * @route POST /api/agent/query
 * @description Process a query through the AI agent
 * @access Public
 */
router.post(
  "/query",
  validateRequestBody,
  errorHandler(async (req: Request, res: Response): Promise<void> => {
    const { query } = req.body;
    const threadId = req.body.threadId || `thread_${uuidv4()}`;
    logger.info("Processing agent query", { threadId });

    try {
      const result = await AgentController.processQuery(query, threadId);
      logger.info("Query processed successfully", { threadId });
      res.status(200).json({
        success: true,
        data: result,
        threadId,
      });
    } catch (error) {
      logger.error("Error processing query", { error, threadId });
      throw error;
    }
  })
);

export default router;
