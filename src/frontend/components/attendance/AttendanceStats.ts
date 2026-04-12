/**
 * AttendanceStats Component
 * Displays attendance summary (Siang, Malam, Total)
 */

import { StatCardComponent } from "../common/StatCard";
import { FrontendCacheService } from "../../services/cache";

export class AttendanceStatsComponent {
  render(): string {
    const summary = FrontendCacheService.getTodaySummary();

    const siangCard = new StatCardComponent({
      label: "Absensi Siang",
      value: summary.siang_count,
      unit: "santri",
      variant: "siang",
      elementId: "stat-siang",
    });

    const malamCard = new StatCardComponent({
      label: "Absensi Malam",
      value: summary.malam_count,
      unit: "santri",
      variant: "malam",
      elementId: "stat-malam",
    });

    const totalCard = new StatCardComponent({
      label: "Total Hari Ini",
      value: summary.total_count,
      unit: "santri",
      variant: "total",
      elementId: "stat-total",
    });

    return `
      <div class="grid grid-cols-3 gap-3 mb-3 animate-slideUp items-stretch">
        ${siangCard.render()}
        ${malamCard.render()}
        ${totalCard.render()}
      </div>
    `;
  }
}

export function renderAttendanceStats(): string {
  return new AttendanceStatsComponent().render();
}
