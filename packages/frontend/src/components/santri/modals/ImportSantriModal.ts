/**
 * Import Santri Modal Component
 * Handles Excel file upload and import process with loading state
 */

import { ApiService } from "../../../services/api";
import type { Class } from "../SantriPage";

interface ImportSantriModalProps {
  containerId: string;
  classes: Class[];
  onImportSuccess: () => void;
  onCancel: () => void;
}

interface ImportError {
  row: number;
  data: {
    name: string;
    rfid_id: string;
    class_name: string;
  };
  error_type: string;
  message: string;
  severity: "error" | "warning";
}

interface ImportResult {
  success: boolean;
  summary: {
    total_rows: number;
    imported: number;
    skipped: number;
    imported_at: string;
  };
  errors: ImportError[];
}

export class ImportSantriModal {
  private props: ImportSantriModalProps;
  private isVisible = false;
  private importResult: ImportResult | null = null;
  private selectedFile: File | null = null;
  private isProcessing = false;

  constructor(props: ImportSantriModalProps) {
    this.props = props;
  }

  /**
   * Show toast notification
   */
  private showToast(
    message: string,
    type: "error" | "warning" | "success" = "error",
  ): void {
    const toastId = `toast-${Date.now()}`;
    const bgColor =
      type === "error"
        ? "bg-red-50 border-red-200"
        : type === "warning"
          ? "bg-amber-50 border-amber-200"
          : "bg-green-50 border-green-200";
    const textColor =
      type === "error"
        ? "text-red-800"
        : type === "warning"
          ? "text-amber-800"
          : "text-green-800";
    const borderColor =
      type === "error"
        ? "border-l-4 border-l-red-500"
        : type === "warning"
          ? "border-l-4 border-l-amber-500"
          : "border-l-4 border-l-green-500";

    const toast = document.createElement("div");
    toast.id = toastId;
    toast.className = `fixed top-4 right-4 max-w-md p-4 rounded-lg border ${bgColor} ${borderColor} ${textColor} text-sm shadow-lg z-[60] animate-fade-in`;
    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-1">${message}</div>
        <button onclick="document.getElementById('${toastId}')?.remove()" class="text-gray-400 hover:text-gray-600 flex-shrink-0">
          ✕
        </button>
      </div>
    `;

    document.body.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      const elem = document.getElementById(toastId);
      if (elem) {
        elem.style.animation = "fade-out 0.3s ease-out forwards";
        setTimeout(() => elem.remove(), 300);
      }
    }, 5000);
  }

  /**
   * Show modal
   */
  show(): void {
    this.isVisible = true;
    this.selectedFile = null;
    this.importResult = null;
    this.render();
  }

  /**
   * Hide modal
   */
  hide(): void {
    this.isVisible = false;
    const container = document.getElementById(this.props.containerId);
    if (container) container.innerHTML = "";
  }

  /**
   * Render modal
   */
  private render(): void {
    const container = document.getElementById(this.props.containerId);
    if (!container || !this.isVisible) return;

    if (this.importResult) {
      this.renderResultView(container);
    } else {
      this.renderUploadView(container);
    }
  }

  /**
   * Render upload view
   */
  private renderUploadView(container: HTMLElement): void {
    const html = `
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" id="modal-backdrop">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="border-b border-gray-200 px-6 py-4 sticky top-0 bg-white">
            <h3 class="text-lg font-bold text-gray-900">Import Data Santri dari Excel</h3>
          </div>

          <!-- Content -->
          <div class="px-6 py-6 space-y-6">
            <!-- Instructions -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p class="text-sm text-gray-700">
                Pilih file Excel berisi data santri untuk diimpor. Pastikan format sesuai dengan template.
              </p>
            </div>

            <!-- Download Template Button -->
            <div>
              <button 
                id="btn-download-template"
                class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                Download Template
              </button>
            </div>

            <!-- File Upload -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Pilih File Excel</label>
              <div class="relative">
                <input 
                  type="file"
                  id="file-input"
                  accept=".xlsx,.xls"
                  class="hidden"
                >
                <button 
                  id="btn-choose-file"
                  class="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-amber-500 transition-colors cursor-pointer">
                  <span class="text-gray-600" id="file-label">Klik untuk memilih file atau drag & drop</span>
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2">Format: .xlsx, .xls | Ukuran max: 25MB</p>
            </div>

            <!-- File Selected Info -->
            <div id="file-info" class="hidden bg-green-50 border border-green-200 rounded-lg p-3">
              <p class="text-sm text-gray-700">
                File: <span id="file-name" class="font-medium"></span>
              </p>
            </div>

            <!-- Progress Bar (hidden initially) -->
            <div id="progress-container" class="hidden space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-gray-700" id="progress-label">Memproses file...</p>
                <span id="progress-text" class="text-sm text-gray-600 font-medium">0%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  id="progress-bar"
                  class="bg-amber-600 h-2 rounded-full transition-all duration-300"
                  style="width: 0%">
                </div>
              </div>
              <p class="text-xs text-gray-600" id="progress-message"></p>
            </div>
          </div>

          <!-- Footer -->
          <div class="border-t border-gray-200 px-6 py-4 sticky bottom-0 bg-white flex justify-end gap-2">
            <button 
              id="btn-cancel"
              class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm">
              Batal
            </button>
            <button 
              id="btn-import"
              class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled>
              Impor
            </button>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.setupUploadViewEventListeners();
  }

  /**
   * Render result view
   */
  private renderResultView(container: HTMLElement): void {
    if (!this.importResult) return;

    const { summary, errors } = this.importResult;
    const hasErrors = errors.length > 0;

    const html = `
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" id="modal-backdrop">
        <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="border-b border-gray-200 px-6 py-4 sticky top-0 bg-white">
            <h3 class="text-lg font-bold text-gray-900">Hasil Import</h3>
          </div>

          <!-- Content -->
          <div class="px-6 py-6 space-y-6">
            <!-- Summary -->
            <div class="space-y-2">
              <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <p class="text-sm font-medium text-green-900">
                  Berhasil mengimpor <span class="font-bold">${summary.imported}</span> dari <span class="font-bold">${summary.total_rows}</span> santri
                </p>
              </div>
              
              ${
                hasErrors
                  ? `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p class="text-sm font-medium text-red-900">
                    <span class="font-bold">${errors.length}</span> baris gagal (lihat detail di bawah)
                  </p>
                </div>
              `
                  : ""
              }
            </div>

            <!-- Error Details (if any) -->
            ${
              hasErrors
                ? `
              <div>
                <h4 class="text-sm font-bold text-gray-900 mb-3">Detail Error</h4>
                <div class="overflow-x-auto border border-gray-200 rounded-lg">
                  <table class="min-w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th class="px-4 py-2 text-left font-medium text-gray-700">Baris</th>
                        <th class="px-4 py-2 text-left font-medium text-gray-700">Nama</th>
                        <th class="px-4 py-2 text-left font-medium text-gray-700">RFID ID</th>
                        <th class="px-4 py-2 text-left font-medium text-gray-700">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${errors
                        .map(
                          (err) => `
                        <tr class="border-b border-gray-100 hover:bg-gray-50">
                          <td class="px-4 py-2 font-medium text-gray-900">${err.row}</td>
                          <td class="px-4 py-2 text-gray-700 max-w-xs truncate">${err.data.name}</td>
                          <td class="px-4 py-2 text-gray-700 max-w-xs truncate">${err.data.rfid_id}</td>
                          <td class="px-4 py-2 text-red-700">
                            <span class="inline-block bg-red-50 px-2 py-1 rounded text-xs">
                              ${err.message}
                            </span>
                          </td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            `
                : ""
            }

            <!-- Import Time -->
            <div class="text-xs text-gray-500">
              Diimpor pada: ${new Date(summary.imported_at).toLocaleString("id-ID")}
            </div>
          </div>

          <!-- Footer -->
          <div class="border-t border-gray-200 px-6 py-4 sticky bottom-0 bg-white flex justify-end gap-2">
            <button 
              id="btn-close"
              class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm">
              Tutup
            </button>
            ${
              summary.imported > 0
                ? `
              <button 
                id="btn-refresh-table"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm">
                Refresh Tabel
              </button>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.setupResultViewEventListeners();
  }

  /**
   * Setup event listeners for upload view
   */
  private setupUploadViewEventListeners(): void {
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    const chooseFileBtn = document.getElementById("btn-choose-file");
    const downloadTemplateBtn = document.getElementById(
      "btn-download-template",
    ) as HTMLButtonElement;
    const importBtn = document.getElementById(
      "btn-import",
    ) as HTMLButtonElement;
    const cancelBtn = document.getElementById(
      "btn-cancel",
    ) as HTMLButtonElement;
    const backdrop = document.getElementById("modal-backdrop");

    // File input change
    if (fileInput) {
      fileInput.addEventListener("change", (e) => this.handleFileSelect(e));
    }

    // Choose file button
    if (chooseFileBtn) {
      chooseFileBtn.addEventListener("click", () => {
        fileInput?.click();
      });
    }

    // Drag and drop
    if (chooseFileBtn) {
      chooseFileBtn.addEventListener("dragover", (e) => {
        e.preventDefault();
        chooseFileBtn.classList.add("bg-amber-50", "border-amber-500");
      });

      chooseFileBtn.addEventListener("dragleave", () => {
        chooseFileBtn.classList.remove("bg-amber-50", "border-amber-500");
      });

      chooseFileBtn.addEventListener("drop", (e) => {
        e.preventDefault();
        chooseFileBtn.classList.remove("bg-amber-50", "border-amber-500");

        const files = (e as DragEvent).dataTransfer?.files;
        if (files && files.length > 0) {
          fileInput.files = files;
          this.handleFileSelect({ target: fileInput } as any);
        }
      });
    }

    // Download template
    if (downloadTemplateBtn) {
      downloadTemplateBtn.addEventListener("click", async () => {
        try {
          downloadTemplateBtn.disabled = true;
          downloadTemplateBtn.style.opacity = "0.7";
          downloadTemplateBtn.textContent = "Mengunduh...";
          await ApiService.downloadSantriTemplate();
        } catch (error) {
          console.error("Failed to download template", error);
          this.showToast("Gagal mengunduh template", "error");
        } finally {
          downloadTemplateBtn.disabled = false;
          downloadTemplateBtn.style.opacity = "1";
          downloadTemplateBtn.textContent = "Download Template";
        }
      });
    }

    // Import button
    if (importBtn) {
      importBtn.addEventListener("click", () => this.handleImport());
    }

    // Cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.hide());
    }

    // Backdrop click
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          this.hide();
        }
      });
    }
  }

  /**
   * Setup event listeners for result view
   */
  private setupResultViewEventListeners(): void {
    const closeBtn = document.getElementById("btn-close");
    const refreshBtn = document.getElementById("btn-refresh-table");
    const backdrop = document.getElementById("modal-backdrop");

    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.hide();
        this.props.onImportSuccess();
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          this.hide();
        }
      });
    }
  }

  /**
   * Handle file selection
   */
  private handleFileSelect(e: any): void {
    const files = e.target.files as FileList;
    if (files && files.length > 0) {
      this.selectedFile = files[0];

      // Validate file type
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];

      if (!validTypes.includes(this.selectedFile.type)) {
        this.showToast("File harus format Excel (.xlsx atau .xls)", "error");
        this.selectedFile = null;
        return;
      }

      // Validate file size (25MB)
      if (this.selectedFile.size > 25 * 1024 * 1024) {
        this.showToast("Ukuran file terlalu besar (max 25MB)", "error");
        this.selectedFile = null;
        return;
      }

      // Update UI
      const fileInfo = document.getElementById("file-info");
      const fileLabel = document.getElementById("file-label");
      const fileNameSpan = document.getElementById("file-name");
      const importBtn = document.getElementById(
        "btn-import",
      ) as HTMLButtonElement;

      if (fileInfo && fileLabel && fileNameSpan) {
        fileLabel.textContent = this.selectedFile.name;
        fileNameSpan.textContent = this.selectedFile.name;
        fileInfo.classList.remove("hidden");
        if (importBtn) {
          importBtn.disabled = false;
        }
      }
    }
  }

  /**
   * Handle import with real-time SSE progress
   */
  private async handleImport(): Promise<void> {
    if (!this.selectedFile || this.isProcessing) return;

    this.isProcessing = true;
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar") as HTMLElement;
    const progressText = document.getElementById("progress-text");
    const progressLabel = document.getElementById("progress-label");
    const progressMessage = document.getElementById("progress-message");
    const importBtn = document.getElementById(
      "btn-import",
    ) as HTMLButtonElement;

    // Disable buttons during import
    if (importBtn) {
      importBtn.disabled = true;
    }

    try {
      // Show progress
      if (progressContainer) {
        progressContainer.classList.remove("hidden");
      }

      // Generate unique session ID for this import
      const sessionId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Start import with SSE progress tracking
      const { promise } = ApiService.importSantriWithProgress(
        this.selectedFile,
        sessionId,
        (event) => {
          // Update progress bar and percentage
          if (event.percentage !== undefined) {
            if (progressBar) {
              progressBar.style.width = `${event.percentage}%`;
            }
            if (progressText) {
              progressText.textContent = `${event.percentage}%`;
            }
          }

          // Update label based on stage
          if (event.stage && progressLabel) {
            const stageLabel: Record<string, string> = {
              parsing: "📁 Membaca file Excel...",
              validating: "✓ Validasi data...",
              checking_db: "🔍 Cek duplikat di database...",
              inserting: "💾 Menyimpan ke database...",
              completed: "✓ Selesai!",
              error: "❌ Terjadi kesalahan",
            };
            progressLabel.textContent =
              stageLabel[event.stage] || "Memproses...";
          }

          // Update detailed message
          if (event.message && progressMessage) {
            progressMessage.textContent = event.message;
          }

          // Log progress stages
          if (event.stage && event.message) {
            console.log(`[${event.stage}] ${event.message}`);
          }
        },
      );

      // Wait for import to complete
      const result = await promise;

      // Store result and show result view
      this.importResult = result;
      this.render();
    } catch (error) {
      console.error("Import failed", error);
      const errorMessage =
        error instanceof Error ? error.message : "Gagal mengimpor data";
      this.showToast(`${errorMessage}. Silakan coba lagi.`, "error");

      // Reset progress bar on error
      const progressBar = document.getElementById(
        "progress-bar",
      ) as HTMLElement;
      if (progressBar) {
        progressBar.style.width = "0%";
      }
      const progressText = document.getElementById("progress-text");
      if (progressText) {
        progressText.textContent = "0%";
      }
    } finally {
      this.isProcessing = false;
      if (importBtn) {
        importBtn.disabled = false;
      }
    }
  }
}
