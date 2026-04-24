/**
 * Santri Management Page - Main Container
 * Orchestrates santri list, filters, and modals
 */

import { ApiService } from "../../services/api";
import { getFullPageSkeletonHTML } from "../../utils/loading";
import { SantriTable } from "./SantriTable";
import { SantriSidebar } from "./SantriSidebar";
import { AddSantriModal } from "./modals/AddSantriModal";
import { EditSantriModal } from "./modals/EditSantriModal";
import { DeleteSantriModal } from "./modals/DeleteSantriModal";

export interface Santri {
  id: string;
  name: string;
  rfid_id: string;
  class_id: string;
  class_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  name: string;
  school_type: string;
}

export class SantriPage {
  private containerId: string;
  private santriList: Santri[] = [];
  private allClasses: Class[] = [];
  private filteredSantri: Santri[] = [];
  private currentFilters = {
    searchTerm: "",
    classId: "",
    showInactive: false,
  };

  // Pagination
  private itemsPerPage = 10;
  private currentPage = 1;

  // Modal state
  private selectedSantri: Santri | null = null;

  // Components
  private table: SantriTable | null = null;
  private sidebar: SantriSidebar | null = null;
  private addModal: AddSantriModal | null = null;
  private editModal: EditSantriModal | null = null;
  private deleteModal: DeleteSantriModal | null = null;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  /**
   * Initialize page - load data and render
   */
  async init(): Promise<void> {
    try {
      // Show skeleton first
      this.renderSkeleton();

      // Load data
      await this.loadData();

      // Show actual content
      this.render();
      this.setupEventListeners();
    } catch (error) {
      console.error("Failed to initialize Santri page:", error);
      this.render();
      this.showError("Gagal memuat data santri");
    }
  }

  /**
   * Load santri list and classes
   */
  private async loadData(): Promise<void> {
    // Load classes
    this.allClasses = await ApiService.getClasses();

    // Build filters - only include if actually applied
    const filters: any = {};

    // Only add is_active filter if showInactive is true
    // (default is to show active only, which doesn't need filter)
    if (this.currentFilters.showInactive) {
      filters.is_active = false; // Explicitly show inactive
    }

    // Load all santri
    // Pass filters only if they were actually applied
    this.santriList = await ApiService.getAllSantri(
      Object.keys(filters).length > 0 ? filters : undefined,
    );

    this.applyFilters();
  }

  /**
   * Apply current filters to santri list
   */
  private applyFilters(): void {
    let filtered = [...this.santriList];

    // Filter by search term
    if (this.currentFilters.searchTerm) {
      const term = this.currentFilters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.rfid_id.toLowerCase().includes(term),
      );
    }

    // Filter by class
    if (this.currentFilters.classId) {
      filtered = filtered.filter(
        (s) => s.class_id === this.currentFilters.classId,
      );
    }

    this.filteredSantri = filtered;
    // Reset to page 1 when filters change
    this.currentPage = 1;
  }

  /**
   * Get paginated santri data
   */
  private getPaginatedSantri(): Santri[] {
    const startIdx = (this.currentPage - 1) * this.itemsPerPage;
    const endIdx = startIdx + this.itemsPerPage;
    return this.filteredSantri.slice(startIdx, endIdx);
  }

  /**
   * Calculate total pages
   */
  private getTotalPages(): number {
    return Math.ceil(this.filteredSantri.length / this.itemsPerPage);
  }

  /**
   * Render skeleton loader during initial load
   */
  private renderSkeleton(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = getFullPageSkeletonHTML();
  }

  /**
   * Render main layout
   */
  private render(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const html = `
      <div class="flex gap-4 p-4">
        <!-- Sidebar -->
        <div id="sidebar-container" class="w-64 flex-shrink-0"></div>

        <!-- Main Content -->
        <div id="main-content" class="flex-1">
          <div class="bg-white rounded-lg shadow-md p-5 border border-gray-200/50">
            <!-- Header with Add Button -->
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold text-gray-900">Manajemen Santri</h2>
              <button 
                id="btn-add-santri"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors">
                + Tambah Santri
              </button>
            </div>

            <!-- Table Container -->
            <div id="table-container"></div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <div id="add-modal-container"></div>
      <div id="edit-modal-container"></div>
      <div id="delete-modal-container"></div>

      <!-- Error Toast -->
      <div id="error-toast" class="hidden fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg"></div>
    `;

    container.innerHTML = html;
    this.renderComponents();
  }

  /**
   * Render sub-components
   */
  private renderComponents(): void {
    // Render sidebar
    this.sidebar = new SantriSidebar({
      containerId: "sidebar-container",
      classes: this.allClasses,
      totalCount: this.santriList.length,
      filteredCount: this.filteredSantri.length,
      currentFilters: this.currentFilters,
      onBackClick: () => this.handleBackClick(),
      onFilterChange: (filters) => this.handleFilterChange(filters),
    });
    this.sidebar.render();

    // Render table
    this.table = new SantriTable({
      containerId: "table-container",
      santri: this.getPaginatedSantri(),
      classes: this.allClasses,
      currentPage: this.currentPage,
      totalPages: this.getTotalPages(),
      totalItems: this.filteredSantri.length,
      itemsPerPage: this.itemsPerPage,
      onEdit: (santri: Santri) => this.handleEditSantri(santri),
      onDelete: (santri: Santri) => this.handleDeleteSantri(santri),
      onPageChange: (page: number) => this.handlePageChange(page),
    });
    this.table.render();

    // Initialize modals
    this.addModal = new AddSantriModal({
      containerId: "add-modal-container",
      classes: this.allClasses,
      onSubmit: (data: { name: string; rfid_id: string; class_id: string }) =>
        this.handleAddSantri(data),
      onCancel: () => this.closeAddModal(),
    });

    this.editModal = new EditSantriModal({
      containerId: "edit-modal-container",
      classes: this.allClasses,
      santri: this.selectedSantri,
      onSubmit: (data: {
        name?: string;
        class_id?: string;
        rfid_id?: string;
      }) => this.handleUpdateSantri(data),
      onCancel: () => this.closeEditModal(),
    });

    this.deleteModal = new DeleteSantriModal({
      containerId: "delete-modal-container",
      santri: this.selectedSantri,
      onConfirm: () => this.handleConfirmDelete(),
      onCancel: () => this.closeDeleteModal(),
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    document.getElementById("btn-add-santri")?.addEventListener("click", () => {
      this.addModal?.show();
    });
  }

  /**
   * Handle add santri
   */
  private async handleAddSantri(data: {
    name: string;
    rfid_id: string;
    class_id: string;
  }): Promise<void> {
    try {
      await ApiService.createSantri(data);
      this.closeAddModal();
      await this.reloadAndRefresh();
      this.showSuccess("Santri berhasil ditambahkan");
    } catch (error) {
      console.error("Failed to create santri:", error);
      const message =
        error instanceof Error ? error.message : "Gagal menambahkan santri";
      this.showError(message);
    }
  }

  /**
   * Handle after CRUD operations - reload and stay on same page if possible
   */
  private async reloadAndRefresh(): Promise<void> {
    await this.loadData();
    const totalPages = this.getTotalPages();
    // Reset to last valid page if we exceed total pages
    if (this.currentPage > totalPages) {
      this.currentPage = Math.max(1, totalPages);
    }
    this.render();
    this.setupEventListeners();
  }

  /**
   * Handle edit santri
   */
  private handleEditSantri(santri: Santri): void {
    this.selectedSantri = santri;
    this.editModal?.setSantri(santri);
    this.editModal?.show();
  }

  /**
   * Handle update santri
   */
  private async handleUpdateSantri(data: {
    name?: string;
    class_id?: string;
    rfid_id?: string;
  }): Promise<void> {
    if (!this.selectedSantri) return;

    try {
      // Update RFID separately if provided
      if (data.rfid_id) {
        await ApiService.updateSantriRFID(this.selectedSantri.id, data.rfid_id);
      }

      // Update other fields
      if (data.name || data.class_id) {
        await ApiService.updateSantri(this.selectedSantri.id, {
          name: data.name,
          class_id: data.class_id,
        });
      }

      this.closeEditModal();
      await this.reloadAndRefresh();
      this.showSuccess("Santri berhasil diperbarui");
    } catch (error) {
      console.error("Failed to update santri:", error);
      const message =
        error instanceof Error ? error.message : "Gagal memperbarui santri";
      this.showError(message);
    }
  }

  /**
   * Handle delete santri
   */
  private handleDeleteSantri(santri: Santri): void {
    this.selectedSantri = santri;
    this.deleteModal?.setSantri(santri);
    this.deleteModal?.show();
  }

  /**
   * Handle confirm delete
   */
  private async handleConfirmDelete(): Promise<void> {
    if (!this.selectedSantri) return;

    try {
      await ApiService.deleteSantri(this.selectedSantri.id);
      this.closeDeleteModal();
      await this.reloadAndRefresh();
      this.showSuccess("Santri berhasil dihapus");
    } catch (error) {
      console.error("Failed to delete santri:", error);
      const message =
        error instanceof Error ? error.message : "Gagal menghapus santri";
      this.showError(message);
    }
  }

  /**
   * Handle filter change
   */
  private handleFilterChange(filters: {
    searchTerm?: string;
    classId?: string;
    showInactive?: boolean;
  }): void {
    if (filters.searchTerm !== undefined) {
      this.currentFilters.searchTerm = filters.searchTerm;
    }
    if (filters.classId !== undefined) {
      this.currentFilters.classId = filters.classId;
    }
    if (filters.showInactive !== undefined) {
      this.currentFilters.showInactive = filters.showInactive;
    }

    this.applyFilters();

    // Re-render table with pagination reset
    if (this.table) {
      this.table.updateData(
        this.getPaginatedSantri(),
        this.currentPage,
        this.getTotalPages(),
        this.filteredSantri.length,
      );
    }

    // Update sidebar count
    if (this.sidebar) {
      this.sidebar.updateCount(this.filteredSantri.length);
    }
  }

  /**
   * Handle page change
   */
  private handlePageChange(page: number): void {
    const totalPages = this.getTotalPages();
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      if (this.table) {
        this.table.updateData(
          this.getPaginatedSantri(),
          this.currentPage,
          totalPages,
          this.filteredSantri.length,
        );
      }
    }
  }

  /**
   * Handle back click
   */
  private handleBackClick(): void {
    // Navigate back to home page via custom event
    window.dispatchEvent(
      new CustomEvent("navigateToPage", { detail: { page: "home" } }),
    );
  }

  /**
   * Close add modal
   */
  private closeAddModal(): void {
    this.addModal?.hide();
  }

  /**
   * Close edit modal
   */
  private closeEditModal(): void {
    this.editModal?.hide();
    this.selectedSantri = null;
  }

  /**
   * Close delete modal
   */
  private closeDeleteModal(): void {
    this.deleteModal?.hide();
    this.selectedSantri = null;
  }

  /**
   * Show error toast
   */
  private showError(message: string): void {
    const toast = document.getElementById("error-toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove("hidden");

    setTimeout(() => {
      toast.classList.add("hidden");
    }, 4000);
  }

  /**
   * Show success toast
   */
  private showSuccess(message: string): void {
    const toast = document.getElementById("error-toast");
    if (!toast) return;

    toast.textContent = message;
    toast.className =
      "fixed bottom-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg";

    setTimeout(() => {
      toast.className =
        "hidden fixed bottom-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg";
    }, 4000);
  }
}
