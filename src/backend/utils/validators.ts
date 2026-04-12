import { ERROR_CODES, ERROR_MESSAGES } from "../config/constants";

export interface ValidationError {
  code: string;
  message: string;
}

/**
 * Validate RFID ID format
 */
export function validateRFIDId(rfidId: string): ValidationError | null {
  if (!rfidId || typeof rfidId !== "string") {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "RFID ID must be a non-empty string",
    };
  }

  if (rfidId.trim().length === 0) {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "RFID ID cannot be empty",
    };
  }

  return null;
}

/**
 * Validate batch request
 */
export function validateBatchRequest(batch: any[]): ValidationError | null {
  if (!Array.isArray(batch)) {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Batch must be an array",
    };
  }

  if (batch.length === 0) {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Batch cannot be empty",
    };
  }

  // Check for duplicates within batch
  const rfidIds = batch.map((item) => item.rfid_id);
  const uniqueRfidIds = new Set(rfidIds);

  if (uniqueRfidIds.size < rfidIds.length) {
    return {
      code: ERROR_CODES.DUPLICATE_IN_BATCH,
      message: ERROR_MESSAGES[ERROR_CODES.DUPLICATE_IN_BATCH],
    };
  }

  return null;
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function validateDateFormat(dateStr: string): ValidationError | null {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Date must be in YYYY-MM-DD format",
    };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Invalid date",
    };
  }

  return null;
}
