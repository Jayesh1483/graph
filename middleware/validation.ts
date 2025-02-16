import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../utils/logger";

// Request validation schema
const querySchema = z.object({
  query: z.string().min(1).max(1000),
  threadId: z
    .string()
    .regex(
      /^thread_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    .optional(),
});

/**
 * Validates the request body against the defined schema
 */
export const validateRequestBody = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    querySchema.parse(req.body);
    next();
  } catch (error) {
    logger.warn("Request validation failed", { error });
    res.status(400).json({
      success: false,
      error: "Invalid request body",
      details: error,
    });
  }
};
