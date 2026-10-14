import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not forward rejected promises from async route handlers to the
 * error middleware -- they become unhandled rejections instead of a clean 500.
 * Wrap every async handler with this so thrown/rejected errors reach next(err).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
