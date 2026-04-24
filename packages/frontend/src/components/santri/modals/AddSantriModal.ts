/**
 * Add Santri Modal Component
 * Form to create new santri
 */

import { setButtonLoading } from "../../../utils/loading";
import type { Class } from "../SantriPage";

interface AddSantriModalProps {
  containerId: string;
  classes: Class[];
  onSubmit: (data: { name: string; rfid_id: string; class_id: string }) => void;
  onCancel: () => void;
}

export class AddSantriModal {
  private props: AddSantriModalProps;
  private isVisible = false;

  constructor(props: AddSantriModalProps) {
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
   * Render modal
   */
  private render(): void {
    const container = document.getElementById(this.props.containerId);
    if (!container || !this.isVisible) return;

    const html = `
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" id="modal-backdrop">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <!-- Header -->
          <div class="border-b border-gray-200 px-6 py-4">
            <h3 class="text-lg font-bold text-gray-900">Tambah Santri Baru</h3>
          </div>

          <!-- Form -->
          <form id="add-santri-form" class="px-6 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nama Santri</label>
              <input 
                type="text"
                name="name"
                placeholder="Masukkan nama santri"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required>
              <p class="text-xs text-gray-500 mt-1">Min. 3 karakter, Max. 255 karakter</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">RFID</label>
              <input 
                type="text"
                name="rfid_id"
                placeholder="Masukkan ID RFID"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required>
              <p class="text-xs text-gray-500 mt-1">RFID harus unik</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
              <select 
                name="class_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                required>
                <option value="">Pilih Kelas...</option>
                ${this.props.classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}
              </select>
            </div>
          </form>

          <!-- Footer -->
          <div class="border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
            <button 
              id="btn-cancel"
              class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm">
              Batal
            </button>
            <button 
              id="btn-submit"
              class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors text-sm">
              Simpan
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
    const form = document.getElementById("add-santri-form") as HTMLFormElement;
    const submitBtn = document.getElementById("btn-submit");
    const cancelBtn = document.getElementById("btn-cancel");

    // Close on backdrop click
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) this.props.onCancel();
    });

    // Cancel button
    cancelBtn?.addEventListener("click", () => this.props.onCancel());

    // Submit button
    submitBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const formData = new FormData(form);
      const data = {
        name: (formData.get("name") as string).trim(),
        rfid_id: (formData.get("rfid_id") as string).trim(),
        class_id: formData.get("class_id") as string,
      };

      // Basic validation
      if (data.name.length < 3) {
        alert("Nama harus minimal 3 karakter");
        return;
      }

      // Show loading state
      setButtonLoading("btn-submit", true, "Menyimpan...");

      try {
        await this.props.onSubmit(data);
      } finally {
        // Reset button state
        setButtonLoading("btn-submit", false);
        (submitBtn as HTMLButtonElement).textContent = "Simpan";
      }
    });

    // Submit on Enter
    form?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") submitBtn?.click();
    });
  }
}
