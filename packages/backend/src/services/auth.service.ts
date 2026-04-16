/**
 * Auth Service
 * JWT token generation, verification, and password hashing
 */

import crypto from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { createLogger } from "../utils/logger.js";
import env from "../config/env.js";

const logger = createLogger("AuthService");

// Polyfill for crypto.scrypt (for password hashing)
const scrypt = promisify(crypto.scrypt);

interface TokenPayload {
  admin_id: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export class AuthService {
  /**
   * Hash password using Node.js built-in crypto.scrypt
   * scrypt: OWASP-recommended password hashing algorithm
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");

    // scrypt: N=16384, r=8, p=1 (standard parameters)
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

    // Format: salt$derivedkey
    return `${salt}$${derivedKey.toString("hex")}`;
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    try {
      const [salt, key] = hash.split("$");
      if (!salt || !key) return false;

      const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
      return crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
    } catch (error) {
      logger.error("Error verifying password", error);
      return false;
    }
  }

  /**
   * Sign JWT access token
   * Expires in 12 hours (configurable via ACCESS_TOKEN_EXPIRES_IN)
   * Uses industry-standard jsonwebtoken library with HS256 algorithm
   */
  static signAccessToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
    try {
      const token = jwt.sign(payload, env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
      });
      return token;
    } catch (error) {
      logger.error("Error signing access token", error);
      throw new Error("Failed to sign access token");
    }
  }

  /**
   * Sign JWT refresh token
   * Expires in 7 days (configurable via REFRESH_TOKEN_EXPIRES_IN)
   * Uses industry-standard jsonwebtoken library with HS256 algorithm
   */
  static signRefreshToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
    try {
      const token = jwt.sign(payload, env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
      });
      return token;
    } catch (error) {
      logger.error("Error signing refresh token", error);
      throw new Error("Failed to sign refresh token");
    }
  }

  /**
   * Verify JWT token
   * Validates signature, expiry, and returns decoded payload
   * Returns null if token is invalid or expired
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ["HS256"],
      }) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn("Token has expired", { expiredAt: error.expiredAt });
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn("Invalid token", { error: error.message });
      } else {
        logger.error("Error verifying token", error);
      }
      return null;
    }
  }
}
