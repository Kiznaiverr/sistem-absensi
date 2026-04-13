/**
 * Auth Service
 * JWT token generation, verification, and password hashing
 */

import crypto from "crypto";
import { promisify } from "util";
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
   */
  static signAccessToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + env.ACCESS_TOKEN_EXPIRES_IN;

    const tokenPayload: TokenPayload = {
      ...payload,
      iat,
      exp,
    };

    return this.encodeToken(tokenPayload);
  }

  /**
   * Sign JWT refresh token
   * Expires in 7 days (configurable via REFRESH_TOKEN_EXPIRES_IN)
   */
  static signRefreshToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + env.REFRESH_TOKEN_EXPIRES_IN;

    const tokenPayload: TokenPayload = {
      ...payload,
      iat,
      exp,
    };

    return this.encodeToken(tokenPayload);
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = this.decodeToken(token);

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp < now) {
        return null; // Token expired
      }

      return decoded;
    } catch (error) {
      logger.error("Error verifying token", error);
      return null;
    }
  }

  /**
   * Encode token using HMAC-SHA256 manually
   * Format: base64(header).base64(payload).signature
   */
  private static encodeToken(payload: TokenPayload): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const encodedPayload = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const message = `${header}.${encodedPayload}`;

    const signature = crypto
      .createHmac("sha256", env.JWT_SECRET)
      .update(message)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    return `${message}.${signature}`;
  }

  /**
   * Decode token manually
   */
  private static decodeToken(token: string): TokenPayload {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const [header, encodedPayload, signature] = parts;

    // Verify signature
    const message = `${header}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac("sha256", env.JWT_SECRET)
      .update(message)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSignature) {
      throw new Error("Invalid token signature");
    }

    // Decode payload
    const payloadJson = Buffer.from(encodedPayload + "==", "base64").toString(
      "utf-8",
    );
    return JSON.parse(payloadJson);
  }
}
