/**
 * Export Page Component - Data Export with Excel Download
 * Load and display attendance data with Excel download capability
 */

import { ApiService } from "../../services/api";
import { ExcelGenerator } from "../../services/excel";

interface FilterState {
  month: number;
  year: number;
  school_type: string;
  class_id: string;
  shift: "siang" | "malam" | null;
}

type UIState = "form" | "loading" | "success" | "error";

export class ExportPageComponent {
  private containerId: string;
  private currentState: UIState = "form";
  private classes: any[] = [];
  private jsonData: any = null;
  private errorMessage: string = "";

  private filters: FilterState = {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    school_type: "",
    class_id: "",
    shift: null,
  };

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  async init(): Promise<void> {
    await this.loadClasses();
    this.render();
    this.setupEventListeners();
  }

  private async loadClasses(): Promise<void> {
    try {
      this.classes = await ApiService.getClasses();
    } catch (error) {
      console.error("Failed to load classes:", error);
      this.classes = [];
    }
  }

  /**
   * Get unique class numbers (for "Semua" option)
   * Returns one representative per class number: Kelas 1, 2, 3
   */
  private getUniqueClassNumbers(): any[] {
    const classMap = new Map<string, any>();

    for (const cls of this.classes) {
      // Extract class number from name (e.g., "SMP-1" -> "1")
      const match = cls.name.match(/-(\d+)$/);
      const number = match ? match[1] : cls.name;

      if (!classMap.has(number)) {
        classMap.set(number, {
          ...cls,
          name: `Kelas ${number}`,
          displayName: `Kelas ${number}`,
        });
      }
    }

    // Sort by class number
    return Array.from(classMap.values()).sort((a, b) => {
      const numA = parseInt(a.displayName.split(" ")[1]);
      const numB = parseInt(b.displayName.split(" ")[1]);
      return numA - numB;
    });
  }

  private render(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Get filtered classes
    let filteredClasses: any[];
    if (this.filters.school_type) {
      filteredClasses = this.classes.filter(
        (c) => c.school_type === this.filters.school_type,
      );
    } else {
      filteredClasses = this.getUniqueClassNumbers();
    }

    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    // Render based on current state
    let content = "";

    if (this.currentState === "form") {
      content = this.renderFormState(filteredClasses, monthNames);
    } else if (this.currentState === "loading") {
      content = this.renderLoadingState();
    } else if (this.currentState === "success") {
      content = this.renderSuccessState(monthNames);
    } else if (this.currentState === "error") {
      content = this.renderErrorState();
    }

    container.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 flex items-center justify-center py-6 px-6">
        <div class="w-full max-w-md h-fit transition-opacity duration-500 ease-in-out" id="content-wrapper">
          ${content}
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private renderFormState(
    filteredClasses: any[],
    monthNames: string[],
  ): string {
    return `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <!-- Header -->
        <div class="mb-7 pb-6 border-b border-gray-200">
          <h1 class="text-2xl font-bold text-gray-900">Export Absensi</h1>
          <p class="text-gray-600 text-sm mt-2">Unduh data dalam format Excel</p>
        </div>

        <!-- Form Grid -->
        <div class="space-y-5">
          <!-- Row 1: Month & Year -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Bulan</label>
              <select id="filter-month" class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                  .map(
                    (m) =>
                      `<option value="${m}" ${m === this.filters.month ? "selected" : ""}>${monthNames[m - 1]}</option>`,
                  )
                  .join("")}
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Tahun</label>
              <select id="filter-year" class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                ${[2024, 2025, 2026, 2027]
                  .map(
                    (y) =>
                      `<option value="${y}" ${y === this.filters.year ? "selected" : ""}>${y}</option>`,
                  )
                  .join("")}
              </select>
            </div>
          </div>

          <!-- Row 2: Shift -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-3">Shift</label>
            <div class="space-y-2">
              <label class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                <input type="radio" name="shift" value="siang" ${this.filters.shift === "siang" ? "checked" : ""} class="w-4 h-4 accent-amber-600">
                <span class="ml-3 text-sm font-medium text-gray-900">Siang</span>
              </label>
              <label class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                <input type="radio" name="shift" value="malam" ${this.filters.shift === "malam" ? "checked" : ""} class="w-4 h-4 accent-amber-600">
                <span class="ml-3 text-sm font-medium text-gray-900">Malam</span>
              </label>
            </div>
          </div>

          <!-- Row 3: School & Class -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Sekolah</label>
              <select id="filter-school" class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                <option value="">Semua</option>
                <option value="SMP" ${this.filters.school_type === "SMP" ? "selected" : ""}>SMP</option>
                <option value="SMK" ${this.filters.school_type === "SMK" ? "selected" : ""}>SMK</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Kelas</label>
              <select id="filter-class" class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                <option value="">Semua</option>
                ${filteredClasses
                  .map((c) => {
                    const displayLabel = c.displayName
                      ? c.displayName
                      : `${c.school_type} - ${c.name}`;
                    return `<option value="${c.id}" ${c.id === this.filters.class_id ? "selected" : ""}>${displayLabel}</option>`;
                  })
                  .join("")}
              </select>
            </div>
          </div>
        </div>

        <!-- Button -->
        <button id="btn-load" class="w-full mt-7 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors">
          Lanjutkan
        </button>
      </div>
    `;
  }

  private renderLoadingState(): string {
    return `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
        <div class="flex flex-col items-center justify-center">
          <!-- Spinner -->
          <div class="mb-4">
            <svg class="w-10 h-10 text-amber-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p class="text-gray-700 font-medium">Memproses data...</p>
          <p class="text-gray-500 text-sm mt-1">Mohon tunggu beberapa saat</p>
        </div>
      </div>
    `;
  }

  private renderSuccessState(monthNames: string[]): string {
    const monthName = monthNames[this.jsonData.data.month - 1];
    const totalStudents = this.jsonData.data.classMatrices.reduce(
      (sum: number, cm: any) => sum + cm.students.length,
      0,
    );

    return `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <!-- Header -->
        <div class="mb-6 pb-6 border-b border-gray-200">
          <p class="text-xs font-semibold text-amber-600 uppercase tracking-wide">Berhasil Diproses</p>
          <h2 class="text-2xl font-bold text-gray-900 mt-2">Siap Diunduh</h2>
        </div>

        <!-- Summary Grid -->
        <div class="grid grid-cols-3 gap-4 mb-7">
          <div class="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border border-gray-200">
            <p class="text-xs font-medium text-gray-600 uppercase">Periode</p>
            <p class="text-lg font-bold text-gray-900 mt-1">${monthName}</p>
            <p class="text-sm text-gray-500 mt-1">${this.jsonData.data.year}</p>
          </div>
          <div class="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border border-gray-200">
            <p class="text-xs font-medium text-gray-600 uppercase">Shift</p>
            <p class="text-lg font-bold text-gray-900 mt-1 capitalize">${this.jsonData.data.shift}</p>
          </div>
          <div class="bg-gradient-to-br from-amber-50 to-white rounded-lg p-4 border border-amber-200">
            <p class="text-xs font-medium text-amber-700 uppercase">Total Santri</p>
            <p class="text-lg font-bold text-amber-700 mt-1">${totalStudents}</p>
          </div>
        </div>

        <!-- Classes Section -->
        <div>
          <h3 class="text-sm font-bold text-gray-900 mb-3">Daftar Kelas <span class="text-gray-500 font-normal">(${this.jsonData.data.classMatrices.length})</span></h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${this.jsonData.data.classMatrices
              .map(
                (cm: any) => `
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-gray-100 transition">
                <span class="font-medium text-gray-900">${cm.class.name}</span>
                <span class="inline-flex items-center justify-center w-6 h-6 bg-amber-600 text-white text-xs font-bold rounded">${cm.students.length}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- Buttons -->
        <div class="grid grid-cols-2 gap-3 mt-7 pt-6 border-t border-gray-200">
          <button id="btn-change-filter" class="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 font-semibold text-sm rounded-lg transition-colors">
            Ubah Filter
          </button>
          <button id="btn-download" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-lg transition-colors">
            Unduh Excel
          </button>
        </div>
      </div>
    `;
  }

  private renderErrorState(): string {
    return `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <!-- Error Header -->
        <div class="mb-6 pb-6 border-b border-gray-200">
          <div class="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-lg mb-3">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 class="text-lg font-bold text-gray-900">Terjadi Kesalahan</h2>
        </div>

        <!-- Error Message -->
        <div class="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <p class="text-sm text-red-700">${this.errorMessage}</p>
        </div>

        <!-- Buttons -->
        <div class="grid grid-cols-2 gap-3 pt-6 border-t border-gray-200">
          <button id="btn-back-form" class="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 font-semibold text-sm rounded-lg transition-colors">
            Kembali
          </button>
          <button id="btn-retry" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-lg transition-colors">
            Coba Lagi
          </button>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Filter changes
    document.getElementById("filter-month")?.addEventListener("change", (e) => {
      this.filters.month = parseInt((e.target as HTMLSelectElement).value);
    });

    document.getElementById("filter-year")?.addEventListener("change", (e) => {
      this.filters.year = parseInt((e.target as HTMLSelectElement).value);
    });

    document
      .getElementById("filter-school")
      ?.addEventListener("change", (e) => {
        this.filters.school_type = (e.target as HTMLSelectElement).value;
        this.filters.class_id = "";
        this.render();
      });

    document.getElementById("filter-class")?.addEventListener("change", (e) => {
      const selectedId = (e.target as HTMLSelectElement).value;
      if (!selectedId) {
        this.filters.class_id = "";
      } else {
        const selectedClass = this.classes.find((c) => c.id === selectedId);
        if (selectedClass) {
          const match = selectedClass.name.match(/-(\d+)$/);
          this.filters.class_id = match ? match[1] : selectedClass.name;
        }
      }
    });

    document.querySelectorAll("input[name='shift']").forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.filters.shift = (e.target as HTMLInputElement).value as
          | "siang"
          | "malam";
      });
    });

    // Load button
    document.getElementById("btn-load")?.addEventListener("click", () => {
      this.handleLoad();
    });

    // Download button
    document.getElementById("btn-download")?.addEventListener("click", () => {
      this.handleDownload();
    });

    // Change filter button
    document
      .getElementById("btn-change-filter")
      ?.addEventListener("click", () => {
        this.currentState = "form";
        this.render();
      });

    // Retry button
    document.getElementById("btn-retry")?.addEventListener("click", () => {
      this.handleLoad();
    });

    // Back to form button
    document.getElementById("btn-back-form")?.addEventListener("click", () => {
      this.currentState = "form";
      this.errorMessage = "";
      this.render();
    });
  }

  private async handleLoad(): Promise<void> {
    if (!this.filters.shift) {
      this.errorMessage = "Pilih shift terlebih dahulu";
      this.currentState = "error";
      this.render();
      return;
    }

    this.currentState = "loading";
    this.render();

    try {
      const params = new URLSearchParams({
        month: this.filters.month.toString(),
        year: this.filters.year.toString(),
        shift: this.filters.shift,
        ...(this.filters.school_type && {
          school_type: this.filters.school_type,
        }),
        ...(this.filters.class_id && { class_id: this.filters.class_id }),
      });

      const response = await fetch(
        `/api/attendance/export?${params.toString()}`,
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      this.jsonData = await response.json();
      this.currentState = "success";
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat memuat data";
      this.currentState = "error";
    }

    this.render();
  }

  private async handleDownload(): Promise<void> {
    if (!this.jsonData) {
      this.errorMessage = "Data tidak tersedia";
      this.currentState = "error";
      this.render();
      return;
    }

    try {
      // Generate Excel file locally
      const generator = new ExcelGenerator();
      const arrayBuffer = await generator.generate(this.jsonData.data);
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `absensi_${this.jsonData.data.month}_${this.jsonData.data.year}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : "Gagal membuat file Excel";
      this.currentState = "error";
      this.render();
    }
  }
}
