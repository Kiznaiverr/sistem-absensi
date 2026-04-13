/**
 * RFID Form Component
 * Handles RFID reader input and smart batch submission (Opsi B: Hybrid Smart Batch)
 */

import { ApiService } from "../services/api";
import { FrontendCacheService } from "../services/cache";
import { TimezoneService } from "../services/timezone";
import type { AttendanceCheckIn } from "../services/cache";

interface RFIDFormOptions {
  containerId: string;
  onSuccess?: (record: AttendanceCheckIn) => void;
  onError?: (error: any) => void;
}

interface BatchError {
  rfid_id: string;
  error_code: string;
  error: string;
  shift?: string;
}

export class RFIDFormComponent {
  private containerId: string;
  private batchQueue: Array<{
    rfid_id: string;
    shift: "siang" | "malam";
    timestamp: number;
  }> = [];
  private rfidBuffer: string = "";
  private batchTimeout: NodeJS.Timeout | null = null;
  private selectedShift: "siang" | "malam" | null = null;
  private onSuccess?: (record: AttendanceCheckIn) => void;
  private onError?: (error: any) => void;
  private keypressHandler: ((e: KeyboardEvent) => void) | null = null;
  private lastScanTime: number = 0;
  private errors: BatchError[] = [];
  private isProcessing: boolean = false;

  // Constants
  private readonly MIN_BATCH_TIMEOUT = 500; // ms
  private readonly SCAN_GAP_THRESHOLD = 2000; // ms

  constructor(options: RFIDFormOptions) {
    this.containerId = options.containerId;
    this.onSuccess = options.onSuccess;
    this.onError = options.onError;
  }

  /**
   * Initialize component
   */
  init(): void {
    this.render();
    this.setupShiftButtons();
    this.setupKeyboardListener();
  }

  /**
   * Render component
   */
  private render(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const detectShift = TimezoneService.detectShift();

    container.innerHTML = `
      <div class="space-y-3">
        
        <!-- Shift Selector -->
        <div>
          <label class="block text-sm font-medium text-gray-900 mb-2">Pilih Shift Absensi</label>
          <div class="flex gap-2">
            <button 
              class="flex-1 btn ${
                this.selectedShift === "siang" ? "btn-primary" : "btn-secondary"
              }" 
              data-shift="siang">
              Siang (13:00-16:00)
            </button>
            <button 
              class="flex-1 btn ${
                this.selectedShift === "malam" ? "btn-primary" : "btn-secondary"
              }" 
              data-shift="malam">
              Malam (18:00-21:00)
            </button>
          </div>
          <div class="mt-1 text-xs text-gray-600">
            ${
              !this.selectedShift && detectShift
                ? `<p>Shift ${detectShift === "siang" ? "Siang" : "Malam"} terdeteksi otomatis</p>`
                : ""
            }
            ${
              !detectShift
                ? `<p class="text-peach-600">Diluar jam absensi, pilih shift secara manual</p>`
                : ""
            }
          </div>
        </div>

        <!-- RFID Input -->
        <div>
          <label class="block text-sm font-medium text-gray-900 mb-2">Scan Kartu RFID</label>
          <input 
            type="text" 
            id="rfid-input"
            class="input-field text-base text-center font-mono tracking-widest" 
            placeholder="Letakkan kartu RFID di reader..."
            autocomplete="off"
            readonly>
          <p class="text-xs text-gray-500 mt-1">RFID reader akan secara otomatis mengetik ID</p>
        </div>

        <!-- Notification Container -->
        <div id="notification-container" class="relative"></div>

        <!-- Queue & Status Info -->
        <div class="bg-peach-50 rounded-lg p-3 border border-peach-200/50">
          <p class="text-sm font-semibold text-gray-900">
            Status: <span id="status-text">Siap</span>
          </p>
          <p class="text-xs text-gray-600 mt-1">
            Queue: <span id="queue-count">0</span> scan
          </p>
        </div>

        <!-- Error Sidebar (Expandable) -->
        <div class="error-sidebar">
          <div id="error-header" class="error-header">
            <span id="error-icon">[v]</span>
            <span>Errors (<span id="error-count">0</span>)</span>
            <button id="error-clear" class="error-clear-btn" style="display:none;">
              Clear
            </button>
          </div>
          <div id="error-list" class="error-list" style="display:none;">
            <!-- Error items will be inserted here -->
          </div>
        </div>

      </div>
    `;

    // Setup error sidebar listeners
    this.setupErrorSidebarListeners();
  }

  /**
   * Setup shift button listeners (call after each render)
   */
  private setupShiftButtons(): void {
    document.querySelectorAll("[data-shift]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const shift = (e.target as HTMLElement).getAttribute("data-shift") as
          | "siang"
          | "malam";
        this.selectedShift = shift;
        this.render();
        this.setupShiftButtons();
        this.setupKeyboardListener();
        this.setupErrorSidebarListeners();
      });
    });

    // Auto-focus RFID input
    const rfidInput = document.getElementById("rfid-input") as HTMLInputElement;
    if (rfidInput) {
      rfidInput.focus();
    }
  }

  /**
   * Setup error sidebar listeners (with proper cleanup)
   */
  private setupErrorSidebarListeners(): void {
    const errorHeader = document.getElementById("error-header");

    if (errorHeader) {
      // Remove all existing listeners by cloning and replacing
      const newErrorHeader = errorHeader.cloneNode(true) as HTMLElement;
      errorHeader.parentNode?.replaceChild(newErrorHeader, errorHeader);

      // Toggle collapse/expand on header click
      newErrorHeader.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;

        // Don't toggle when clicking clear button
        if (target.classList.contains("error-clear-btn")) {
          return;
        }

        e.preventDefault();
        const errorListEl = document.getElementById("error-list");
        if (!errorListEl) return;

        const isHidden = errorListEl.style.display === "none";
        errorListEl.style.display = isHidden ? "block" : "none";

        const icon = document.getElementById("error-icon");
        if (icon) {
          icon.textContent = isHidden ? "[^]" : "[v]";
        }
      });

      // Setup clear button listener on new header element
      const clearBtn = newErrorHeader.querySelector(
        ".error-clear-btn",
      ) as HTMLElement;
      if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.errors = [];
          this.renderErrorSidebar();
        });
      }
    }
  }

  /**
   * Setup keyboard listener (global - works anywhere on page)
   */
  private setupKeyboardListener(): void {
    // Remove old listener if exists
    if (this.keypressHandler) {
      document.removeEventListener("keypress", this.keypressHandler);
    }

    // Create new handler - listen globally for RFID input
    this.keypressHandler = (e: KeyboardEvent) => {
      // Listen globally regardless of focus
      // (RFID reader acts like keyboard, not dependent on focus)
      this.rfidBuffer += String.fromCharCode(e.charCode);

      // RFID reader usually sends Enter at the end
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleRFIDInput(this.rfidBuffer.trim());
        this.rfidBuffer = "";
      }
    };

    // Add listener once
    document.addEventListener("keypress", this.keypressHandler);
  }

  /**
   * Handle RFID input with smart batch timing
   */
  private async handleRFIDInput(rfidId: string): Promise<void> {
    if (!rfidId) return;

    // Determine shift
    let shift = this.selectedShift;
    if (!shift) {
      const detected = TimezoneService.detectShift();
      if (!detected) {
        this.showError("Diluar jam absensi. Pilih shift terlebih dahulu");
        return;
      }
      shift = detected;
    }

    // Calculate gap from last scan
    const currentTime = Date.now();
    const gapFromLastScan = currentTime - this.lastScanTime;
    this.lastScanTime = currentTime;

    // Add to queue
    this.batchQueue.push({
      rfid_id: rfidId,
      shift,
      timestamp: currentTime,
    });

    // Update UI
    this.updateQueueCount();
    this.updateStatus();

    // Show feedback
    const santri = FrontendCacheService.getSantriByRFID(rfidId);
    if (santri) {
      this.showPending(santri.name, shift);
    } else {
      this.showError(`RFID ${rfidId} tidak ditemukan`);
    }

    // Clear previous timer
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Gap detection: if gap > threshold, user finished scanning
    if (
      gapFromLastScan > this.SCAN_GAP_THRESHOLD &&
      this.batchQueue.length > 0
    ) {
      await this.submitBatchNow();
      return;
    }

    // Set timer for max 500ms wait
    this.batchTimeout = setTimeout(() => {
      this.submitBatchNow();
    }, this.MIN_BATCH_TIMEOUT);
  }

  /**
   * Submit batch now (smart batch timing)
   */
  private async submitBatchNow(): Promise<void> {
    if (this.batchQueue.length === 0) return;
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.updateStatus();

    try {
      const batchToSubmit = [...this.batchQueue];
      this.batchQueue = [];
      this.updateQueueCount();

      const response = await ApiService.submitAttendanceBatch({
        batch: batchToSubmit,
        date: TimezoneService.getCurrentDateString(),
      });

      // Process successes
      for (const item of response.success) {
        const record: AttendanceCheckIn = {
          rfid_id: item.rfid_id,
          santri_id: item.santri_id,
          name: item.name,
          class_name: item.class_name,
          school_type: item.school_type,
          shift: item.shift,
          checked_in_at: Date.now(),
          status: "success",
        };

        FrontendCacheService.addAttendanceRecord(record);

        if (this.onSuccess) {
          this.onSuccess(record);
        }

        this.showSuccess(item.name, item.shift);
      }

      // Accumulate errors
      if (response.errors.length > 0) {
        const errors: BatchError[] = response.errors.map((e: any) => ({
          rfid_id: e.rfid_id,
          error_code: e.error_code,
          error: e.error,
          shift: e.shift,
        }));
        this.errors = [...this.errors, ...errors];
        this.renderErrorSidebar();

        // Also call error callback for integration
        for (const error of response.errors) {
          if (this.onError) {
            this.onError(error);
          }
        }
      }

      // Show batch summary
      if (response.success.length > 0) {
        let message: string;
        if (response.success.length === 1) {
          // Single person - show their name
          message = ` ${response.success[0].name} - Absensi tercatat`;
        } else {
          // Multiple people - show count
          message = `${response.success.length} santri - Batch processed`;
        }
        this.showNotification(message, "success");
      }
    } catch (error) {
      console.error("Failed to submit batch", error);
      this.showError("Gagal submit batch. Coba lagi");
      // Re-queue on failure
      this.batchQueue = [...this.batchQueue];
      this.updateQueueCount();
    } finally {
      this.isProcessing = false;
      this.updateStatus();
    }
  }

  /**
   * Stop timer and cleanup listeners
   */
  destroy(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    if (this.keypressHandler) {
      document.removeEventListener("keypress", this.keypressHandler);
      this.keypressHandler = null;
    }
  }

  /**
   * Update queue count display
   */
  private updateQueueCount(): void {
    const counter = document.getElementById("queue-count");
    if (counter) {
      counter.textContent = this.batchQueue.length.toString();
    }
  }

  /**
   * Update status display
   */
  private updateStatus(): void {
    const statusText = document.getElementById("status-text");
    if (!statusText) return;

    if (this.isProcessing) {
      statusText.textContent = "Processing...";
    } else if (this.batchQueue.length > 0) {
      statusText.textContent = `Queue: ${this.batchQueue.length} scan`;
    } else {
      statusText.textContent = "Siap";
    }
  }

  /**
   * Render error sidebar
   */
  private renderErrorSidebar(): void {
    const errorCount = document.getElementById("error-count");
    const errorList = document.getElementById("error-list");
    const clearBtn = document.getElementById("error-clear");

    if (errorCount) {
      errorCount.textContent = this.errors.length.toString();
    }

    if (clearBtn) {
      clearBtn.style.display = this.errors.length > 0 ? "block" : "none";
    }

    if (errorList) {
      if (this.errors.length === 0) {
        errorList.innerHTML = "";
        errorList.style.display = "none";
        const icon = document.getElementById("error-icon");
        if (icon) icon.textContent = "[v]";
      } else {
        errorList.innerHTML = this.errors
          .map((error) => {
            const santri = FrontendCacheService.getSantriByRFID(error.rfid_id);
            const name = santri ? santri.name : error.rfid_id;
            return `<div class="error-item">
                <p class="error-name">${name}</p>
                <p class="error-msg">${error.error}</p>
                ${error.shift ? `<p class="error-shift">Shift: ${error.shift}</p>` : ""}
                <p class="error-code">Code: ${error.error_code}</p>
              </div>`;
          })
          .join("");
      }
    }
  }

  /**
   * Show success message
   */
  private showSuccess(name: string, _shift: "siang" | "malam"): void {
    this.showNotification(
      `${name} - ${_shift === "siang" ? "Siang" : "Malam"}`,
      "success",
    );
  }

  /**
   * Show pending message
   */
  private showPending(name: string, _shift: "siang" | "malam"): void {
    this.showNotification(`${name} menunggu...`, "info");
  }

  /**
   * Show error message
   */
  private showError(message: string, rfidId?: string): void {
    this.showNotification(`${message}${rfidId ? ` (${rfidId})` : ""}`, "error");
  }

  /**
   * Show notification inline in form
   */
  private showNotification(
    message: string,
    type: "success" | "error" | "info",
  ): void {
    const notificationContainer = document.getElementById(
      "notification-container",
    );
    if (!notificationContainer) return;

    // Remove previous notification if exists
    const existing = notificationContainer.querySelector(
      ".notification-inline",
    );
    if (existing) existing.remove();

    const notificationClass = {
      success: "notification-inline notification-inline-success",
      error: "notification-inline notification-inline-error",
      info: "notification-inline notification-inline-info",
    }[type];

    const notification = document.createElement("div");
    notification.className = notificationClass;
    notification.textContent = message;
    notificationContainer.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}
