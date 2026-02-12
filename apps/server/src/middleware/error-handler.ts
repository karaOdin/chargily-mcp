/**
 * Global error handling middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log error
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      code: (error as AppError).code,
    },
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
    },
  }, 'Request error');

  // Handle known errors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code || 'error',
        message: error.message,
        details: error.details,
      },
    });
  }

  // Handle validation errors (Zod)
  if (error.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request data',
        details: (error as any).errors,
      },
    });
  }

  // Handle unknown errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: isDevelopment ? error.message : 'Internal server error',
      stack: isDevelopment ? error.stack : undefined,
    },
  });
}

// 404 Not Found handler
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `Route ${req.method} ${req.url} not found`,
    },
  });
}
