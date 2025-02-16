import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Async error handler wrapper for route handlers
 */
export const errorHandler = (fn: Function) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
        return;
      }

      logger.error("Unexpected error", { error });

      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };
};
