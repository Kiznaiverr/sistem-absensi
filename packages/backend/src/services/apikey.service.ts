/**
 * API Key Service
 * Validates API key for third-party applications
 */

import env from "../config/env.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ApiKeyService");

export class ApiKeyService {
  /**
   * Validate provided API key against configured API key
   * Uses constant-time comparison to prevent timing attacks
   */
  static validateApiKey(providedKey: string): boolean {
    // If API key not configured or disabled
    if (!env.API_KEY_ENABLED || !env.API_KEY) {
      return false;
    }

    // Use timingSafeEqual-like comparison (Node.js crypto)
    try {
      // Ensure both strings are same length to prevent timing attacks
      const configuredKey = env.API_KEY;

      if (providedKey.length !== configuredKey.length) {
        return false;
      }

      let result = 0;
      for (let i = 0; i < providedKey.length; i++) {
        result |= providedKey.charCodeAt(i) ^ configuredKey.charCodeAt(i);
      }

      return result === 0;
    } catch (error) {
      logger.error("Error validating API key", error);
      return false;
    }
  }

  /**
   * Check if API key authentication is enabled
   */
  static isEnabled(): boolean {
    return env.API_KEY_ENABLED && !!env.API_KEY;
  }
}
