/**
 * Santri Sidebar Component
 * Left sidebar with filters and back button
 */

import type { Class } from "./SantriPage";

interface SantriSidebarProps {
  containerId: string;
  classes: Class[];
  totalCount: number;
  filteredCount: number;
  currentFilters: {
    searchTerm: string;
    classId: string;
    showInactive: boolean;
  };
  onBackClick: () => void;
  onFilterChange: (filters: {
    searchTerm?: string;
    classId?: string;
    showInactive?: boolean;
  }) => void;
}

export class SantriSidebar {
  private props: SantriSidebarProps;

  constructor(props: SantriSidebarProps) {
    this.props = props;
  }

  /**
   * Render sidebar
   */
  render(): void {
    const container = document.getElementById(this.props.containerId);
    if (!container) return;

    const html = `
      <div class="bg-white rounded-lg shadow-md p-4 border border-gray-200/50 sticky top-20">
        <!-- Back Button -->
        <button 
          id="btn-back"
          class="w-full mb-4 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2">
          ← Kembali ke Home
        </button>

        <!-- Stats -->
        <div class="bg-amber-50 rounded-lg p-3 mb-4 border border-amber-200">
          <p class="text-xs text-gray-600 mb-1">Total Santri</p>
          <p class="text-2xl font-bold text-amber-600">${this.props.totalCount}</p>
          <p class="text-xs text-gray-500 mt-1">Ditampilkan: ${this.props.filteredCount}</p>
        </div>

        <!-- Divider -->
        <div class="border-t border-gray-200 my-4"></div>

        <!-- Filters -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-2">Cari Santri</label>
            <input 
              id="filter-search"
              type="text"
              placeholder="Nama atau RFID..."
              value="${this.props.currentFilters.searchTerm}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-2">Filter Kelas</label>
            <select 
              id="filter-class"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
              <option value="">Semua Kelas</option>
              ${this.props.classes.map((c) => `<option value="${c.id}" ${this.props.currentFilters.classId === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
            </select>
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              id="filter-inactive"
              type="checkbox"
              ${this.props.currentFilters.showInactive ? "checked" : ""}
              class="w-4 h-4 border border-gray-300 rounded focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
            <span class="text-sm text-gray-700">Tampilkan Tidak Aktif</span>
          </label>
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
    document.getElementById("btn-back")?.addEventListener("click", () => {
      this.props.onBackClick();
    });

    document.getElementById("filter-search")?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.props.onFilterChange({ searchTerm: value });
    });

    document.getElementById("filter-class")?.addEventListener("change", (e) => {
      const value = (e.target as HTMLSelectElement).value;
      this.props.onFilterChange({ classId: value });
    });

    document
      .getElementById("filter-inactive")
      ?.addEventListener("change", (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.props.onFilterChange({ showInactive: checked });
      });
  }

  /**
   * Update filtered count
   */
  updateCount(count: number): void {
    const countEl = document.querySelector(
      `#${this.props.containerId} p:last-of-type`,
    );
    if (countEl) {
      countEl.textContent = `Ditampilkan: ${count}`;
    }
  }
}
