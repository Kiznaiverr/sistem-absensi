/**
 * Loading UI Utilities
 * Provides reusable loading states and skeleton screens
 */

/**
 * Generate loading spinner HTML (SVG-based)
 * Used for: modal submissions, button actions, inline operations
 */
export function getSpinnerHTML(): string {
  return `
    <svg class="w-4 h-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  `;
}

/**
 * Generate skeleton loader skeleton row (for lists)
 * Used for: initial page load with many items
 */
export function getSkeletonRowHTML(): string {
  return `
    <div class="animate-pulse">
      <div class="flex items-center gap-4 p-4 border-b border-gray-200">
        <div class="h-10 w-10 bg-gray-200 rounded"></div>
        <div class="flex-1 space-y-2">
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          <div class="h-3 bg-gray-100 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate skeleton table header
 */
export function getSkeletonHeaderHTML(): string {
  return `
    <div class="animate-pulse">
      <div class="flex items-center gap-4 p-4 bg-gray-50 border-b-2 border-gray-200">
        <div class="h-5 w-12 bg-gray-200 rounded"></div>
        <div class="h-5 w-32 bg-gray-200 rounded"></div>
        <div class="h-5 w-32 bg-gray-200 rounded"></div>
        <div class="h-5 w-32 bg-gray-200 rounded"></div>
      </div>
    </div>
  `;
}

/**
 * Generate full page skeleton loader
 * Used for: initial page load (SantriPage, ExportPage, etc)
 */
export function getFullPageSkeletonHTML(): string {
  const rows = Array(8)
    .fill(0)
    .map(() => getSkeletonRowHTML())
    .join("");

  return `
    <div class="flex gap-4 p-4">
      <!-- Sidebar Skeleton -->
      <div class="w-64 flex-shrink-0 animate-pulse">
        <div class="bg-white rounded-lg shadow-md p-4 space-y-4">
          <div class="h-6 bg-gray-200 rounded w-3/4"></div>
          <div class="space-y-2">
            <div class="h-4 bg-gray-100 rounded"></div>
            <div class="h-4 bg-gray-100 rounded w-5/6"></div>
            <div class="h-4 bg-gray-100 rounded w-4/6"></div>
          </div>
        </div>
      </div>

      <!-- Main Content Skeleton -->
      <div class="flex-1">
        <div class="bg-white rounded-lg shadow-md p-5 border border-gray-200/50 animate-pulse">
          <!-- Header -->
          <div class="flex justify-between items-center mb-4">
            <div class="h-6 bg-gray-200 rounded w-48"></div>
            <div class="h-10 bg-gray-200 rounded w-32"></div>
          </div>

          <!-- Filters -->
          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="h-10 bg-gray-100 rounded"></div>
            <div class="h-10 bg-gray-100 rounded"></div>
            <div class="h-10 bg-gray-100 rounded"></div>
          </div>

          <!-- Table Header -->
          ${getSkeletonHeaderHTML()}

          <!-- Table Rows -->
          <div class="divide-y divide-gray-200">
            ${rows}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate simple spinner for inline loading (search/filter)
 */
export function getInlineSpinnerHTML(): string {
  return `
    <svg class="w-4 h-4 text-amber-600 animate-spin inline-block ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  `;
}

/**
 * Set button loading state
 * Disables button and shows spinner + loading text
 */
export function setButtonLoading(
  buttonId: string,
  isLoading: boolean,
  loadingText = "Memproses...",
): void {
  const button = document.getElementById(buttonId) as HTMLButtonElement;
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.classList.add("opacity-70", "cursor-not-allowed");
    const spinner = getSpinnerHTML();
    button.innerHTML = `${spinner} <span class="ml-2">${loadingText}</span>`;
  } else {
    button.disabled = false;
    button.classList.remove("opacity-70", "cursor-not-allowed");
    // Note: Button text should be reset by component that called this
  }
}

/**
 * Show inline spinner next to element
 * Used for: search input, filter operations
 */
export function showInlineLoader(elementId: string): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const spinner = document.createElement("div");
  spinner.id = `${elementId}-loader`;
  spinner.className = "inline-block ml-2";
  spinner.innerHTML = getInlineSpinnerHTML();
  element.appendChild(spinner);
}

/**
 * Hide inline spinner
 */
export function hideInlineLoader(elementId: string): void {
  const loader = document.getElementById(`${elementId}-loader`);
  if (loader) {
    loader.remove();
  }
}

/**
 * Delay function for simulating loading (useful for testing)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
