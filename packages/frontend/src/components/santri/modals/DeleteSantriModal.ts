/**
 * Delete Santri Modal Component
 * Confirmation dialog for deleting santri
 */

import type { Santri } from "../SantriPage";

interface DeleteSantriModalProps {
  containerId: string;
  santri: Santri | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export class DeleteSantriModal {
  private props: DeleteSantriModalProps;
  private isVisible = false;

  constructor(props: DeleteSantriModalProps) {
    this.props = props;
  }

  /**
   * Show modal
   */
  show(): void {
    this.isVisible = true;
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
   * Set santri data
   */
  setSantri(santri: Santri): void {
    this.props.santri = santri;
  }

  /**
   * Render modal
   */
  private render(): void {
    const container = document.getElementById(this.props.containerId);
    if (!container || !this.isVisible || !this.props.santri) return;

    const santri = this.props.santri;

    const html = `
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" id="modal-backdrop">
        <div class="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
          <!-- Header -->
          <div class="border-b border-gray-200 px-6 py-4">
            <h3 class="text-lg font-bold text-red-600">Hapus Santri</h3>
          </div>

          <!-- Content -->
          <div class="px-6 py-4">
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p class="text-sm text-red-800">
                <strong>Perhatian!</strong> Anda akan menghapus data santri ini:
              </p>
            </div>

            <div class="space-y-2 mb-4">
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-600 mb-1">Nama</p>
                <p class="text-sm font-semibold text-gray-900">${santri.name}</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-600 mb-1">RFID</p>
                <p class="text-sm font-mono text-gray-900">${santri.rfid_id}</p>
              </div>
            </div>

            <p class="text-xs text-gray-500">
              Data ini akan di-nonaktifkan dan tidak bisa dipulihkan.
            </p>
          </div>

          <!-- Footer -->
          <div class="border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
            <button 
              id="btn-cancel"
              class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm">
              Batal
            </button>
            <button 
              id="btn-confirm"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-sm">
              Hapus
            </button>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    const backdrop = document.getElementById("modal-backdrop");
    const confirmBtn = document.getElementById("btn-confirm");
    const cancelBtn = document.getElementById("btn-cancel");

    // Close on backdrop click
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) this.props.onCancel();
    });

    // Cancel button
    cancelBtn?.addEventListener("click", () => this.props.onCancel());

    // Confirm button
    confirmBtn?.addEventListener("click", async () => {
      (confirmBtn as HTMLButtonElement).disabled = true;
      confirmBtn.textContent = "Loading...";

      try {
        await this.props.onConfirm();
      } finally {
        (confirmBtn as HTMLButtonElement).disabled = false;
        confirmBtn.textContent = "Hapus";
      }
    });
  }
}
