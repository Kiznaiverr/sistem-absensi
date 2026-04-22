/**
 * Santri Table Component
 * Displays list of santri with edit/delete actions
 */

import type { Santri, Class } from "./SantriPage";

interface SantriTableProps {
  containerId: string;
  santri: Santri[];
  classes: Class[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onEdit: (santri: Santri) => void;
  onDelete: (santri: Santri) => void;
  onPageChange: (page: number) => void;
}

export class SantriTable {
  private props: SantriTableProps;

  constructor(props: SantriTableProps) {
    this.props = props;
  }

  /**
   * Get class name by ID
   */
  private getClassName(classId: string): string {
    return this.props.classes.find((c) => c.id === classId)?.name || "Unknown";
  }

  /**
   * Render table
   */
  render(): void {
    const container = document.getElementById(this.props.containerId);
    if (!container) return;

    if (this.props.santri.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12">
          <p class="text-gray-500 text-lg">Tidak ada data santri</p>
        </div>
      `;
      return;
    }

    const rows = this.props.santri
      .map(
        (s) => `
      <tr class="border-t border-gray-200 hover:bg-gray-50 transition">
        <td class="px-4 py-3 text-sm text-gray-900 font-medium">${s.name}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${s.rfid_id}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${this.getClassName(s.class_id)}</td>
        <td class="px-4 py-3 text-sm">
          <span class="px-2 py-1 rounded-full text-xs font-semibold ${s.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}">
            ${s.is_active ? "Aktif" : "Tidak Aktif"}
          </span>
        </td>
        <td class="px-4 py-3 text-sm">
          <div class="flex gap-2">
            <button 
              class="btn-edit px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium transition"
              data-id="${s.id}">
              Edit
            </button>
            <button 
              class="btn-delete px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition"
              data-id="${s.id}">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `,
      )
      .join("");

    const html = `
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nama</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">RFID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Kelas</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div class="mt-4 flex items-center justify-between">
        <p class="text-sm text-gray-600">
          Menampilkan ${(this.props.currentPage - 1) * this.props.itemsPerPage + 1} - ${Math.min(this.props.currentPage * this.props.itemsPerPage, this.props.totalItems)} dari ${this.props.totalItems} santri
        </p>
        <div class="flex gap-2 items-center">
          <button 
            id="btn-prev-page"
            class="px-3 py-1 border border-gray-300 hover:border-amber-500 text-gray-700 hover:text-amber-600 rounded text-sm font-medium transition ${this.props.currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""}"
            ${this.props.currentPage === 1 ? "disabled" : ""}>
            ← Prev
          </button>
          
          <div class="flex gap-1">
            ${this.renderPageButtons()}
          </div>
          
          <button 
            id="btn-next-page"
            class="px-3 py-1 border border-gray-300 hover:border-amber-500 text-gray-700 hover:text-amber-600 rounded text-sm font-medium transition ${this.props.currentPage === this.props.totalPages ? "opacity-50 cursor-not-allowed" : ""}"
            ${this.props.currentPage === this.props.totalPages ? "disabled" : ""}>
            Next →
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.setupEventListeners();
  }

  /**
   * Render page number buttons
   */
  private renderPageButtons(): string {
    const buttons: string[] = [];
    const maxButtons = 5;
    const { currentPage, totalPages } = this.props;

    // Calculate range of pages to show
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // Add page buttons
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(`
        <button 
          class="btn-page-num px-2 py-1 rounded text-sm font-medium transition ${
            i === currentPage
              ? "bg-amber-600 text-white"
              : "border border-gray-300 text-gray-700 hover:border-amber-500"
          }"
          data-page="${i}">
          ${i}
        </button>
      `);
    }

    return buttons.join("");
  }

  /**
   * Setup event listeners for table and pagination
   */
  private setupEventListeners(): void {
    const container = document.getElementById(this.props.containerId);
    if (!container) return;

    // Edit buttons
    container.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const santriId = (e.target as HTMLElement).getAttribute("data-id");
        const santri = this.props.santri.find((s) => s.id === santriId);
        if (santri) this.props.onEdit(santri);
      });
    });

    // Delete buttons
    container.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const santriId = (e.target as HTMLElement).getAttribute("data-id");
        const santri = this.props.santri.find((s) => s.id === santriId);
        if (santri) this.props.onDelete(santri);
      });
    });

    // Previous page button
    document.getElementById("btn-prev-page")?.addEventListener("click", () => {
      if (this.props.currentPage > 1) {
        this.props.onPageChange(this.props.currentPage - 1);
      }
    });

    // Next page button
    document.getElementById("btn-next-page")?.addEventListener("click", () => {
      if (this.props.currentPage < this.props.totalPages) {
        this.props.onPageChange(this.props.currentPage + 1);
      }
    });

    // Page number buttons
    container.querySelectorAll(".btn-page-num").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const page = parseInt(
          (e.target as HTMLElement).getAttribute("data-page") || "1",
        );
        this.props.onPageChange(page);
      });
    });
  }

  /**
   * Update data and re-render with pagination info
   */
  updateData(
    santri: Santri[],
    currentPage: number,
    totalPages: number,
    totalItems: number,
  ): void {
    this.props.santri = santri;
    this.props.currentPage = currentPage;
    this.props.totalPages = totalPages;
    this.props.totalItems = totalItems;
    this.render();
  }
}
