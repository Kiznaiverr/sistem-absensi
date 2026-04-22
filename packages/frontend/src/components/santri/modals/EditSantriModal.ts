/**
 * Edit Santri Modal Component
 * Form to update existing santri
 */

import type { Santri, Class } from "../SantriPage";

interface EditSantriModalProps {
  containerId: string;
  classes: Class[];
  santri: Santri | null;
  onSubmit: (data: {
    name?: string;
    class_id?: string;
    rfid_id?: string;
  }) => void;
  onCancel: () => void;
}

export class EditSantriModal {
  private props: EditSantriModalProps;
  private isVisible = false;

  constructor(props: EditSantriModalProps) {
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
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <!-- Header -->
          <div class="border-b border-gray-200 px-6 py-4">
            <h3 class="text-lg font-bold text-gray-900">Edit Santri</h3>
          </div>

          <!-- Form -->
          <form id="edit-santri-form" class="px-6 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nama Santri</label>
              <input 
                type="text"
                name="name"
                value="${santri.name}"
                placeholder="Masukkan nama santri"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
              <p class="text-xs text-gray-500 mt-1">Min. 3 karakter, Max. 255 karakter</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">RFID (Ganti jika perlu)</label>
              <input 
                type="text"
                name="rfid_id"
                value="${santri.rfid_id}"
                placeholder="Masukkan ID RFID baru"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
              <p class="text-xs text-gray-500 mt-1">Kosongkan jika tidak ingin mengubah</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
              <select 
                name="class_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                <option value="">Pilih Kelas...</option>
                ${this.props.classes.map((c) => `<option value="${c.id}" ${c.id === santri.class_id ? "selected" : ""}>${c.name}</option>`).join("")}
              </select>
            </div>

            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p class="text-xs text-blue-800">
                <strong>Status:</strong> ${santri.is_active ? "Aktif" : "Tidak Aktif"}
              </p>
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
    const form = document.getElementById("edit-santri-form") as HTMLFormElement;
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

      const formData = new FormData(form);
      const name = (formData.get("name") as string).trim();
      const rfid_id = (formData.get("rfid_id") as string).trim();
      const class_id = formData.get("class_id") as string;

      // Validation
      if (name && name.length < 3) {
        alert("Nama harus minimal 3 karakter");
        return;
      }

      // Build data object - only include fields that changed or were entered
      const data: { name?: string; class_id?: string; rfid_id?: string } = {};

      if (name && name !== this.props.santri?.name) {
        data.name = name;
      }
      if (class_id && class_id !== this.props.santri?.class_id) {
        data.class_id = class_id;
      }
      if (rfid_id) {
        // RFID change always sent (even if same, backend will validate)
        data.rfid_id = rfid_id;
      }

      // Check if anything changed
      if (Object.keys(data).length === 0) {
        alert("Tidak ada perubahan");
        return;
      }

      (submitBtn as HTMLButtonElement).disabled = true;
      submitBtn.textContent = "Loading...";

      try {
        await this.props.onSubmit(data);
      } finally {
        (submitBtn as HTMLButtonElement).disabled = false;
        submitBtn.textContent = "Simpan";
      }
    });

    // Submit on Enter
    form?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") submitBtn?.click();
    });
  }
}
