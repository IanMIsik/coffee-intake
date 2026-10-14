import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { verifyToken, type StaffTokenClaims, type TokenClaims } from "./jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenClaims;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }
  let claims: TokenClaims;
  try {
    claims = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (claims.kind !== "staff") {
    req.auth = claims;
    return next();
  }

  // The token's role can be up to 30 days stale, so staff are re-checked against the
  // database on every request: deleted accounts are locked out immediately, and a
  // promotion or demotion applies without waiting for the next login.
  prisma.staffUser
    .findUnique({
      where: { id: claims.staffUserId },
      select: { role: true, deletedAt: true, organizationId: true, passwordChangedAt: true },
    })
    .then((staff) => {
      if (!staff || staff.deletedAt || staff.organizationId !== claims.organizationId) {
        return res.status(401).json({ error: "This account no longer has access" });
      }
      // `iat` is in whole seconds; a token issued before the last password change
      // belongs to a session that used the old password.
      const issuedAt = (claims as { iat?: number }).iat ?? 0;
      if (staff.passwordChangedAt && issuedAt < Math.floor(staff.passwordChangedAt.getTime() / 1000)) {
        return res.status(401).json({ error: "Your password was changed. Please sign in again." });
      }
      req.auth = { ...claims, role: staff.role };
      next();
    })
    .catch(next);
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.kind !== "staff") {
    return res.status(403).json({ error: "Staff account required" });
  }
  next();
}

export function requireFarmer(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.kind !== "farmer") {
    return res.status(403).json({ error: "Farmer account required" });
  }
  next();
}

export function requireRole(...roles: StaffTokenClaims["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.kind !== "staff" || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

/** Convenience getter: the organizationId of whoever is authenticated, staff or farmer. */
export function authOrgId(req: Request): string {
  if (!req.auth) throw new Error("authOrgId called without auth middleware");
  return req.auth.organizationId;
}
