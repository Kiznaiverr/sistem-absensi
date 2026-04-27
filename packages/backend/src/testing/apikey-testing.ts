/**
 * API Key Testing Utility
 * Tests multiple endpoints using API Key authentication
 * Verifies that third-party applications can access API with X-API-Key header
 *
 * Run directly: npx ts-node src/testing/apikey-testing.ts
 * Or with npm: npm run test:apikey
 */

import { createLogger } from "../utils/logger.js";
import { pathToFileURL } from "url";
import env from "../config/env.js";

const logger = createLogger("ApiKeyTesting");

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  response: unknown;
  error?: string;
  duration: number;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  passed: number;
  failed: number;
}

const BASE_URL = `http://localhost:5000`;
const API_KEY = env.API_KEY;

/**
 * Helper function to make API requests with API Key
 */
async function makeRequest(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<TestResult> {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    return {
      endpoint,
      method,
      status: response.status,
      success:
        response.ok && (data as Record<string, unknown>).success === true,
      response: data,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      response: null,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

/**
 * Test 1: Health Check (No auth required)
 */
async function testHealthCheck(): Promise<TestSuite> {
  logger.info("Testing: Health Check Endpoint (No Auth Required)");

  const url = `${BASE_URL}/health`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    // Health check returns { status: "ok" } not { success: true }
    const testPassed =
      response.ok && (data as Record<string, unknown>).status === "ok";

    const result: TestResult = {
      endpoint: "/health",
      method: "GET",
      status: response.status,
      success: testPassed,
      response: data,
      duration,
    };

    return {
      name: "Health Check",
      results: [result],
      passed: testPassed ? 1 : 0,
      failed: testPassed ? 0 : 1,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      name: "Health Check",
      results: [
        {
          endpoint: "/health",
          method: "GET",
          status: 0,
          success: false,
          response: null,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
      ],
      passed: 0,
      failed: 1,
    };
  }
}

/**
 * Test 2: Get Classes with API Key
 */
async function testGetClasses(): Promise<TestSuite> {
  logger.info("Testing: Get Classes with API Key");

  const result = await makeRequest("GET", "/api/classes");

  return {
    name: "Get Classes",
    results: [result],
    passed: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
  };
}

/**
 * Test 3: Get Today's Attendance Summary with API Key
 */
async function testGetTodaySummary(): Promise<TestSuite> {
  logger.info("Testing: Get Today's Attendance Summary with API Key");

  const result = await makeRequest("GET", "/api/attendance/today");

  return {
    name: "Get Today Summary",
    results: [result],
    passed: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
  };
}

/**
 * Test 4: Batch RFID Attendance with API Key
 * This is the main endpoint for third-party integrations
 */
async function testBatchAttendance(): Promise<TestSuite> {
  logger.info("Testing: Batch RFID Attendance with API Key");

  const today = new Date().toISOString().split("T")[0];

  // Using dummy RFID for testing
  const body = {
    batch: [
      {
        rfid_id: "test_rfid_001",
        shift: "siang" as const,
      },
      {
        rfid_id: "test_rfid_002",
        shift: "malam" as const,
      },
    ],
    date: today,
  };

  const result = await makeRequest("POST", "/api/attendance/batch", body);

  return {
    name: "Batch RFID Attendance",
    results: [result],
    passed: result.success ? 1 : 0,
    failed: result.success ? 0 : 1,
  };
}

/**
 * Test 5: Invalid API Key (should fail)
 */
async function testInvalidApiKey(): Promise<TestSuite> {
  logger.info("Testing: Invalid API Key (Expected to Fail)");

  const url = `${BASE_URL}/api/classes`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": "invalid_api_key_xxx",
        "Content-Type": "application/json",
      },
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    // Test PASSED if request was rejected (401)
    const testPassed =
      response.status === 401 &&
      (data as Record<string, unknown>).success === false;

    const result: TestResult = {
      endpoint: "/api/classes",
      method: "GET",
      status: response.status,
      success: testPassed,
      response: data,
      duration,
    };

    return {
      name: "Invalid API Key Rejection",
      results: [result],
      passed: testPassed ? 1 : 0,
      failed: testPassed ? 0 : 1,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      name: "Invalid API Key Rejection",
      results: [
        {
          endpoint: "/api/classes",
          method: "GET",
          status: 0,
          success: false,
          response: null,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
      ],
      passed: 0,
      failed: 1,
    };
  }
}

/**
 * Test 6: Missing API Key (should fail)
 */
async function testMissingApiKey(): Promise<TestSuite> {
  logger.info("Testing: Missing API Key (Expected to Fail)");

  const url = `${BASE_URL}/api/classes`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    // Test PASSED if request was rejected (401)
    const testPassed =
      response.status === 401 &&
      (data as Record<string, unknown>).success === false;

    const result: TestResult = {
      endpoint: "/api/classes",
      method: "GET",
      status: response.status,
      success: testPassed,
      response: data,
      duration,
    };

    return {
      name: "Missing API Key Rejection",
      results: [result],
      passed: testPassed ? 1 : 0,
      failed: testPassed ? 0 : 1,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      name: "Missing API Key Rejection",
      results: [
        {
          endpoint: "/api/classes",
          method: "GET",
          status: 0,
          success: false,
          response: null,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
      ],
      passed: 0,
      failed: 1,
    };
  }
}

/**
 * Format test results for console output
 */
function formatTestResults(suites: TestSuite[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("API KEY AUTHENTICATION TEST RESULTS");
  console.log("=".repeat(80) + "\n");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    const status = suite.failed === 0 ? "PASSED" : "FAILED";
    console.log(`${status} - ${suite.name}`);

    for (const result of suite.results) {
      const methodColor = result.method === "GET" ? "" : "";
      console.log(`  ${methodColor} ${result.method} ${result.endpoint}`);
      console.log(`    Status: ${result.status || "ERROR"}`);
      console.log(`    Duration: ${result.duration}ms`);

      if (result.error) {
        console.log(`    Error: ${result.error}`);
      } else if (result.response) {
        const response = result.response as Record<string, unknown>;
        if (response.error_code) {
          console.log(`    Error Code: ${response.error_code}`);
        }
        if (response.error && typeof response.error === "string") {
          console.log(`    Message: ${response.error}`);
        }
      }
    }

    totalPassed += suite.passed;
    totalFailed += suite.failed;
    console.log();
  }

  console.log("=".repeat(80));
  console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed`);
  console.log("=".repeat(80) + "\n");

  if (totalFailed === 0) {
    console.log(
      "All tests passed! API Key authentication is working correctly.\n",
    );
  } else {
    console.log(
      `${totalFailed} test(s) failed. Please check the errors above.\n`,
    );
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  // Validate API Key is configured
  if (!env.API_KEY_ENABLED) {
    console.error("API_KEY_ENABLED is false. Enable it in .env");
    process.exit(1);
  }

  if (!env.API_KEY) {
    console.error("API_KEY is not configured in .env");
    process.exit(1);
  }

  console.log("\nStarting API Key Testing...");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(
    `API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 10)}\n`,
  );

  const suites: TestSuite[] = [];

  try {
    // Run all tests
    suites.push(await testHealthCheck());
    suites.push(await testGetClasses());
    suites.push(await testGetTodaySummary());
    suites.push(await testBatchAttendance());
    suites.push(await testInvalidApiKey());
    suites.push(await testMissingApiKey());

    // Format and display results
    formatTestResults(suites);

    // Exit with appropriate code
    const totalFailed = suites.reduce((sum, s) => sum + s.failed, 0);
    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (error) {
    logger.error("Test suite error", error);
    console.error("Unexpected error during testing:", error);
    process.exit(1);
  }
}

/**
 * Main execution
 */
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await runAllTests();
}
