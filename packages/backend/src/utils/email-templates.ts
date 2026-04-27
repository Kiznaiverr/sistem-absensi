import { format, parseISO } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { ArchiveResult } from "../services/archive.service.js";
import { ExportResult } from "../services/storage-export.service.js";

const TIMEZONE = "Asia/Jakarta";

interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * Format date to readable string in Jakarta timezone
 */
function formatDateJakarta(date: Date | string): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const jakartaDate = utcToZonedTime(dateObj, TIMEZONE);
  return format(jakartaDate, "dd MMM yyyy HH:mm:ss zzz");
}

/**
 * Archive Success Email Template
 */
export function archiveSuccessTemplate(result: ArchiveResult): EmailTemplate {
  const now = new Date();
  const timestamp = formatDateJakarta(now);

  return {
    subject: "Archive Job Completed Successfully",
    html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Archive Job Completed</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Status: SUCCESS</p>
        </div>

        <!-- Content -->
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: #166534; font-weight: 500;">Archive job completed successfully</p>
            </div>

            <!-- Statistics -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Summary</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Records Archived</p>
                        <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #10b981;">${result.archived}</p>
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Records Deleted</p>
                        <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #10b981;">${result.deleted}</p>
                    </div>
                </div>

                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Duration</p>
                    <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #374151;">${result.duration}ms</p>
                </div>
            </div>

            <!-- Details -->
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Details</h3>
                <table style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Executed at:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 500; color: #1f2937;">${timestamp}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Next run:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 500; color: #1f2937;">02:00 AM (Asia/Jakarta)</td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f3f4f6; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0;">This is an automated email from Archive System</p>
            <p style="margin: 4px 0 0 0;">Do not reply to this email</p>
        </div>
    </div>
</body>
</html>
    `,
  };
}

/**
 * Archive Failure Email Template
 */
export function archiveFailureTemplate(
  error: Error,
  context?: { duration?: number; threshold?: string },
): EmailTemplate {
  const now = new Date();
  const timestamp = formatDateJakarta(now);

  return {
    subject: "Archive Job Failed - Action Required",
    html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Archive Job Failed</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Status: FAILED</p>
        </div>

        <!-- Content -->
        <div style="background: #fafafa; padding: 30px; border: 1px solid #e5e7eb;">
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-weight: 500;">Archive job failed during execution</p>
            </div>

            <!-- Error Information -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Error Details</h3>
                
                <div style="background: #fff5f5; padding: 16px; border-radius: 6px; border: 1px solid #fecaca; font-family: 'Courier New', monospace; font-size: 12px; overflow-x: auto;">
                    <p style="margin: 0; color: #7f1d1d; word-break: break-word;">
                        <strong>Message:</strong><br>
                        ${error.message || "Unknown error"}
                    </p>
                </div>
            </div>

            <!-- Context Information -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Context</h3>
                <table style="width: 100%; font-size: 13px; background: white; border: 1px solid #e5e7eb; border-radius: 6px;">
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px; color: #6b7280; font-weight: 500;">Failed at:</td>
                        <td style="padding: 12px; text-align: right; color: #1f2937;">${timestamp}</td>
                    </tr>
                    ${
                      context?.duration
                        ? `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px; color: #6b7280; font-weight: 500;">Duration:</td>
                        <td style="padding: 12px; text-align: right; color: #1f2937;">${context.duration}ms</td>
                    </tr>
                    `
                        : ""
                    }
                    ${
                      context?.threshold
                        ? `
                    <tr>
                        <td style="padding: 12px; color: #6b7280; font-weight: 500;">Threshold Date:</td>
                        <td style="padding: 12px; text-align: right; color: #1f2937;">${context.threshold}</td>
                    </tr>
                    `
                        : ""
                    }
                </table>
            </div>

            <!-- Recommended Actions -->
            <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; border-radius: 4px;">
                <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #0c4a6e;">Recommended Actions</h4>
                <ul style="margin: 0; padding-left: 20px; color: #0c4a6e; font-size: 13px;">
                    <li style="margin: 4px 0;">Check database logs for integrity issues</li>
                    <li style="margin: 4px 0;">Verify database connectivity</li>
                    <li style="margin: 4px 0;">Review system resources (disk space, memory)</li>
                    <li style="margin: 4px 0;">Contact system administrator if issue persists</li>
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f3f4f6; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0;">This is an automated email from Archive System</p>
            <p style="margin: 4px 0 0 0;">Do not reply to this email</p>
        </div>
    </div>
</body>
</html>
    `,
  };
}

/**
 * Storage Export Success Email Template
 */
export function storageExportSuccessTemplate(
  result: ExportResult,
): EmailTemplate {
  const now = new Date();
  const timestamp = formatDateJakarta(now);

  return {
    subject: "Monthly Attendance Export Completed Successfully",
    html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Export Completed</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Status: SUCCESS</p>
        </div>

        <!-- Content -->
        <div style="background: #f0f9fb; padding: 30px; border: 1px solid #cffafe;">
            <div style="background: #ecfdf5; border-left: 4px solid #06b6d4; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: #164e63; font-weight: 500;">Monthly attendance data exported successfully to R2</p>
            </div>

            <!-- Statistics -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Summary</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Exported</p>
                        <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #06b6d4;">${result.exported}</p>
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Failed</p>
                        <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: ${result.failed > 0 ? "#dc2626" : "#06b6d4"};">${result.failed}</p>
                    </div>
                </div>

                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Duration</p>
                    <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #374151;">${result.duration}ms</p>
                </div>
            </div>

            <!-- Details -->
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Details</h3>
                <table style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Executed at:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 500; color: #1f2937;">${timestamp}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Location:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 500; color: #1f2937;">Cloudflare R2</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Next export:</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 500; color: #1f2937;">1st of next month at 03:00 AM</td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f3f4f6; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0;">This is an automated email from Storage Export System</p>
            <p style="margin: 4px 0 0 0;">Do not reply to this email</p>
        </div>
    </div>
</body>
</html>
    `,
  };
}

/**
 * Storage Export Failure Email Template
 */
export function storageExportFailureTemplate(context: {
  error: string;
  timestamp: string;
}): EmailTemplate {
  return {
    subject: "Monthly Attendance Export Failed - Action Required",
    html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Export Failed</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Status: FAILED</p>
        </div>

        <!-- Content -->
        <div style="background: #fafafa; padding: 30px; border: 1px solid #e5e7eb;">
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-weight: 500;">Monthly attendance export failed during execution</p>
            </div>

            <!-- Error Information -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Error Details</h3>
                
                <div style="background: #fff5f5; padding: 16px; border-radius: 6px; border: 1px solid #fecaca; font-family: 'Courier New', monospace; font-size: 12px; overflow-x: auto;">
                    <p style="margin: 0; color: #7f1d1d; word-break: break-word;">
                        <strong>Message:</strong><br>
                        ${context.error}
                    </p>
                </div>
            </div>

            <!-- Context Information -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #6b7280;">Context</h3>
                <table style="width: 100%; font-size: 13px; background: white; border: 1px solid #e5e7eb; border-radius: 6px;">
                    <tr>
                        <td style="padding: 12px; color: #6b7280; font-weight: 500;">Failed at:</td>
                        <td style="padding: 12px; text-align: right; color: #1f2937;">${context.timestamp}</td>
                    </tr>
                </table>
            </div>

            <!-- Recommended Actions -->
            <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; border-radius: 4px;">
                <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #0c4a6e;">Recommended Actions</h4>
                <ul style="margin: 0; padding-left: 20px; color: #0c4a6e; font-size: 13px;">
                    <li style="margin: 4px 0;">Verify R2 credentials in environment configuration</li>
                    <li style="margin: 4px 0;">Check R2 bucket availability and permissions</li>
                    <li style="margin: 4px 0;">Verify database connectivity</li>
                    <li style="margin: 4px 0;">Contact system administrator if issue persists</li>
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div style="background: #f3f4f6; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin: 0;">This is an automated email from Storage Export System</p>
            <p style="margin: 4px 0 0 0;">Do not reply to this email</p>
        </div>
    </div>
</body>
</html>
    `,
  };
}
