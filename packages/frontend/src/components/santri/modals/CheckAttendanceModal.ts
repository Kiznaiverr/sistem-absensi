/**
 * Check Attendance Modal
 * Supports two panels: Santri check and Class check.
 */

import {
  type AttendanceStatusCandidate,
  type AttendanceTodayClassStatusResponse,
  type AttendanceTodayClassSummaryItem,
  type AttendanceTodayClassSummaryResponse,
  type AttendanceTodayStatusResponse,
} from "../../../services/api";

interface CheckAttendanceModalProps {
  containerId: string;
  onCheckSantri: (params: {
    q?: string;
    santri_id?: string;
    rfid_id?: string;
  }) => Promise<AttendanceTodayStatusResponse>;
  onLoadClassSummary: () => Promise<AttendanceTodayClassSummaryResponse>;
  onCheckClassStatus: (
    classId: string,
  ) => Promise<AttendanceTodayClassStatusResponse>;
  onCancel: () => void;
}

interface SingleStatusView {
  mode: "single";
  date: string;
  santri: AttendanceStatusCandidate;
  source: "active" | "archive" | "both" | "none";
  siang: { checked_in: boolean; checked_in_at: string | null };
  malam: { checked_in: boolean; checked_in_at: string | null };
}

type PanelMode = "santri" | "kelas";
type ClassViewMode = "list" | "detail";

export class CheckAttendanceModal {
  private props: CheckAttendanceModalProps;
  private isVisible = false;
  private loading = false;
  private errorMessage = "";

  private panelMode: PanelMode = "santri";

  // Santri mode state
  private searchQuery = "";
  private candidates: AttendanceStatusCandidate[] = [];
  private singleStatus: SingleStatusView | null = null;

  // Kelas mode state
  private classSummary: AttendanceTodayClassSummaryItem[] = [];
  private selectedClassStatus: AttendanceTodayClassStatusResponse | null = null;
  private classViewMode: ClassViewMode = "list";
  private classSummaryLoaded = false;

  constructor(props: CheckAttendanceModalProps) {
    this.props = props;
  }

  show(): void {
    this.isVisible = true;
    this.loading = false;
    this.errorMessage = "";
    this.panelMode = "santri";
    this.searchQuery = "";
    this.candidates = [];
    this.singleStatus = null;
    this.selectedClassStatus = null;
    this.classViewMode = "list";
    this.render();
  }

  hide(): void {
    this.isVisible = false;
    const container = document.getElementById(this.props.containerId);
    if (container) container.innerHTML = "";
  }

  private render(): void {
    const container = document.getElementById(this.props.containerId);
    if (!container || !this.isVisible) return;

    const html = `
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" id="check-attendance-backdrop">
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          <div class="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 class="text-lg font-bold text-gray-900">Check Absensi Hari Ini</h3>
            <button id="btn-close-check-attendance" class="text-gray-500 hover:text-gray-700 text-xl leading-none">&times;</button>
          </div>

          <div class="px-6 pt-4">
            <div class="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                id="btn-panel-santri"
                class="px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${this.panelMode === "santri" ? "bg-white text-amber-700 shadow" : "text-gray-600 hover:text-gray-800"}">
                Check Santri
              </button>
              <button
                id="btn-panel-kelas"
                class="px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${this.panelMode === "kelas" ? "bg-white text-amber-700 shadow" : "text-gray-600 hover:text-gray-800"}">
                Check Per Kelas
              </button>
            </div>
          </div>

          <div class="px-6 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
            ${this.errorMessage ? `<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 animate-slideUp">${this.escapeHtml(this.errorMessage)}</div>` : ""}

            <div class="transition-all duration-200 ${this.panelMode === "santri" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 hidden"}">
              ${this.renderSantriPanel()}
            </div>

            <div class="transition-all duration-200 ${this.panelMode === "kelas" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 hidden"}">
              ${this.renderKelasPanel()}
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.setupEventListeners();

    if (this.panelMode === "santri") {
      const input = document.getElementById(
        "check-attendance-input",
      ) as HTMLInputElement | null;
      input?.focus();
    }
  }

  private renderSantriPanel(): string {
    return `
      <div class="space-y-4 animate-slideUp">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Cari berdasarkan Nama atau RFID</label>
          <div class="flex gap-2">
            <input
              id="check-attendance-input"
              type="text"
              value="${this.escapeHtml(this.searchQuery)}"
              placeholder="Contoh: Ahmad atau RFID123"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
            <button
              id="btn-check-attendance-apply"
              class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm ${this.loading ? "opacity-60 cursor-not-allowed" : ""}">
              ${this.loading ? "Mencari..." : "Apply"}
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">Bisa scan/tap kartu langsung ke input lalu tekan Enter.</p>
        </div>

        ${this.renderCandidatesSection()}
        ${this.renderSingleStatusSection()}
      </div>
    `;
  }

  private renderKelasPanel(): string {
    if (this.classViewMode === "detail" && this.selectedClassStatus) {
      return this.renderClassDetailSection();
    }

    const classCards = this.classSummary
      .map((item) => {
        return `
          <button
            class="btn-select-class w-full text-left p-3 border rounded-xl transition-all duration-200 bg-white hover:border-amber-300 hover:-translate-y-[1px] hover:shadow-sm"
            data-class-id="${item.class_id}">
            <div class="flex items-center justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-gray-900 leading-tight">${this.escapeHtml(item.class_name)}</p>
                <p class="text-xs text-gray-500 mt-0.5">${this.escapeHtml(item.school_type)}</p>
              </div>
              <span class="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">${item.total_santri_active}</span>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">Siang<br><span class="font-semibold text-gray-900">${item.siang_hadir_count}/${item.total_santri_active}</span></div>
              <div class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-gray-700">Malam<br><span class="font-semibold text-gray-900">${item.malam_hadir_count}/${item.total_santri_active}</span></div>
            </div>
          </button>
        `;
      })
      .join("");

    return `
      <div class="space-y-4 animate-slideUp">
        <div class="flex gap-2 items-center justify-between">
          <button
            id="btn-load-class-summary"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm ${this.loading ? "opacity-60 cursor-not-allowed" : ""}">
            ${this.loading ? "Memuat..." : "Muat Ringkasan Kelas"}
          </button>
          <p class="text-xs text-gray-500 text-right">Klik salah satu box kelas untuk melihat detail penuh.</p>
        </div>

        ${this.classSummary.length > 0 ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[58vh] overflow-y-auto pr-1 scrollbar-soft">${classCards}</div>` : `<p class="text-sm text-gray-500">Belum ada ringkasan kelas yang dimuat.</p>`}
      </div>
    `;
  }

  private renderCandidatesSection(): string {
    if (!this.candidates.length) return "";

    return `
      <div class="border border-amber-200 bg-amber-50 rounded-lg p-4">
        <p class="text-sm font-semibold text-amber-800 mb-3">Ditemukan lebih dari satu santri. Pilih salah satu:</p>
        <div class="space-y-2">
          ${this.candidates
            .map(
              (candidate) => `
                <button
                  class="btn-select-candidate w-full text-left px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg"
                  data-santri-id="${candidate.id}">
                  <p class="text-sm font-semibold text-gray-900">${this.escapeHtml(candidate.name)}</p>
                  <p class="text-xs text-gray-600">RFID: ${this.escapeHtml(candidate.rfid_id)} • ${this.escapeHtml(candidate.class_name || "-")}</p>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  private renderSingleStatusSection(): string {
    if (!this.singleStatus) return "";

    const siangBadge = this.singleStatus.siang.checked_in
      ? `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Sudah Absen</span>`
      : `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Belum Absen</span>`;

    const malamBadge = this.singleStatus.malam.checked_in
      ? `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Sudah Absen</span>`
      : `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Belum Absen</span>`;

    return `
      <div class="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
        <div>
          <p class="text-sm font-bold text-gray-900">${this.escapeHtml(this.singleStatus.santri.name)}</p>
          <p class="text-xs text-gray-700">RFID: ${this.escapeHtml(this.singleStatus.santri.rfid_id)} • ${this.escapeHtml(this.singleStatus.santri.class_name || "-")}</p>
          <p class="text-xs text-gray-500 mt-1">Sumber data: ${this.escapeHtml(this.singleStatus.source)}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="bg-white rounded-lg border border-gray-200 p-3">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-semibold text-gray-900">Shift Siang</p>
              ${siangBadge}
            </div>
            <p class="text-xs text-gray-600">${this.singleStatus.siang.checked_in_at ? `Jam: ${this.formatTime(this.singleStatus.siang.checked_in_at)}` : "Belum ada check-in"}</p>
          </div>

          <div class="bg-white rounded-lg border border-gray-200 p-3">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-semibold text-gray-900">Shift Malam</p>
              ${malamBadge}
            </div>
            <p class="text-xs text-gray-600">${this.singleStatus.malam.checked_in_at ? `Jam: ${this.formatTime(this.singleStatus.malam.checked_in_at)}` : "Belum ada check-in"}</p>
          </div>
        </div>
      </div>
    `;
  }

  private renderClassDetailSection(): string {
    if (!this.selectedClassStatus) return "";

    const rows = this.selectedClassStatus.students
      .map((student) => {
        const siangLabel = student.siang_checked_in
          ? `<span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200">Sudah Absen</span><span class="ml-2 text-[11px] text-green-700">${this.formatTime(student.siang_checked_in_at || "")}</span>`
          : `<span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200">Belum Absen</span>`;
        const malamLabel = student.malam_checked_in
          ? `<span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200">Sudah Absen</span><span class="ml-2 text-[11px] text-green-700">${this.formatTime(student.malam_checked_in_at || "")}</span>`
          : `<span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200">Belum Absen</span>`;

        return `
          <tr class="border-b border-gray-100">
            <td class="px-3 py-2 text-sm text-gray-900">${this.escapeHtml(student.name)}</td>
            <td class="px-3 py-2 text-xs text-gray-600">${this.escapeHtml(student.rfid_id)}</td>
            <td class="px-3 py-2 text-xs">${siangLabel}</td>
            <td class="px-3 py-2 text-xs">${malamLabel}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3 animate-slideUp">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-bold text-gray-900">${this.escapeHtml(this.selectedClassStatus.class.name)}</p>
            <p class="text-xs text-gray-600 mt-1">${this.escapeHtml(this.selectedClassStatus.class.school_type)} • Sumber: ${this.escapeHtml(this.selectedClassStatus.source)}</p>
          </div>
          <div class="text-right text-xs text-gray-600">
            <p>Total aktif: ${this.selectedClassStatus.summary.total_santri_active}</p>
            <p>Siang: ${this.selectedClassStatus.summary.siang_hadir_count} hadir</p>
            <p>Malam: ${this.selectedClassStatus.summary.malam_hadir_count} hadir</p>
          </div>
        </div>

        <button id="btn-back-class-list" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-800 transition-colors">
          ← Kembali ke daftar kelas
        </button>

        <div class="overflow-x-auto bg-white rounded border border-gray-200 scrollbar-soft">
          <table class="w-full min-w-[520px]">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Nama</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">RFID</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Siang</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Malam</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    const backdrop = document.getElementById("check-attendance-backdrop");
    const closeBtn = document.getElementById("btn-close-check-attendance");
    const santriPanelBtn = document.getElementById("btn-panel-santri");
    const kelasPanelBtn = document.getElementById("btn-panel-kelas");
    const backClassListBtn = document.getElementById("btn-back-class-list");

    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) this.props.onCancel();
    });

    closeBtn?.addEventListener("click", () => this.props.onCancel());

    santriPanelBtn?.addEventListener("click", () => {
      this.panelMode = "santri";
      this.errorMessage = "";
      this.render();
    });

    kelasPanelBtn?.addEventListener("click", async () => {
      this.panelMode = "kelas";
      this.errorMessage = "";
      this.classViewMode = "list";
      this.selectedClassStatus = null;
      this.render();
      if (!this.classSummaryLoaded) {
        await this.loadClassSummary();
      }
    });

    const applyBtn = document.getElementById("btn-check-attendance-apply");
    const input = document.getElementById(
      "check-attendance-input",
    ) as HTMLInputElement | null;
    applyBtn?.addEventListener("click", async () => {
      await this.submitSantriQuery();
    });

    input?.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await this.submitSantriQuery();
      }
    });

    document.querySelectorAll(".btn-select-candidate").forEach((element) => {
      element.addEventListener("click", async () => {
        const santriId = (element as HTMLButtonElement).dataset.santriId;
        if (!santriId) return;
        await this.fetchBySantriId(santriId);
      });
    });

    document
      .getElementById("btn-load-class-summary")
      ?.addEventListener("click", async () => {
        await this.loadClassSummary(true);
      });

    document.querySelectorAll(".btn-select-class").forEach((element) => {
      element.addEventListener("click", async () => {
        const classId = (element as HTMLButtonElement).dataset.classId;
        if (!classId) return;
        await this.loadClassStatus(classId);
      });
    });

    backClassListBtn?.addEventListener("click", () => {
      this.classViewMode = "list";
      this.selectedClassStatus = null;
      this.errorMessage = "";
      this.render();
    });
  }

  private async submitSantriQuery(): Promise<void> {
    const input = document.getElementById(
      "check-attendance-input",
    ) as HTMLInputElement | null;

    const query = (input?.value || "").trim();
    if (!query) {
      this.errorMessage = "Masukkan nama atau RFID terlebih dahulu";
      this.render();
      return;
    }

    this.searchQuery = query;
    this.loading = true;
    this.errorMessage = "";
    this.candidates = [];
    this.singleStatus = null;
    this.render();

    try {
      const response = await this.props.onCheckSantri({ q: query });
      this.applySantriResponse(response);
      this.searchQuery = "";
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : "Gagal memeriksa absensi";
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private async fetchBySantriId(santriId: string): Promise<void> {
    this.loading = true;
    this.errorMessage = "";
    this.singleStatus = null;
    this.render();

    try {
      const response = await this.props.onCheckSantri({ santri_id: santriId });
      this.applySantriResponse(response);
      this.searchQuery = "";
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : "Gagal memeriksa absensi";
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private applySantriResponse(response: AttendanceTodayStatusResponse): void {
    if (response.mode === "candidates") {
      this.candidates = response.candidates;
      this.singleStatus = null;
      return;
    }

    this.candidates = [];
    this.singleStatus = {
      mode: "single",
      date: response.date,
      santri: response.santri,
      source: response.status.source,
      siang: response.status.siang,
      malam: response.status.malam,
    };
  }

  private async loadClassSummary(forceReload = false): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.errorMessage = "";
    this.render();

    try {
      if (!this.classSummaryLoaded || forceReload) {
        const response = await this.props.onLoadClassSummary();
        this.classSummary = response.classes;
        this.classSummaryLoaded = true;
      }
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : "Gagal memuat ringkasan kelas";
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private async loadClassStatus(classId: string): Promise<void> {
    this.loading = true;
    this.errorMessage = "";
    this.classViewMode = "detail";
    this.render();

    try {
      this.selectedClassStatus = await this.props.onCheckClassStatus(classId);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : "Gagal memuat detail kelas";
      this.selectedClassStatus = null;
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private formatTime(dateString: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
