import jwt from "jsonwebtoken";
import { env } from "../env";

export type StaffTokenClaims = {
  kind: "staff";
  staffUserId: string;
  organizationId: string;
  role: "ADMIN" | "CLERK";
};

export type FarmerTokenClaims = {
  kind: "farmer";
  farmerId: string;
  organizationId: string;
};

export type TokenClaims = StaffTokenClaims | FarmerTokenClaims;

export function signToken(claims: TokenClaims): string {
  return jwt.sign(claims, env.jwtSecret, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenClaims {
  return jwt.verify(token, env.jwtSecret) as TokenClaims;
}
