/**
 * Component Exports
 * Central export point for all components
 */

// Layout
export {
  HeaderComponent,
  renderHeader,
  initializeHeader,
} from "./layout/Header";
export { LayoutComponent, renderLayout } from "./layout/Layout";
export type { LayoutProps } from "./layout/Layout";

// Common
export { StatCardComponent, renderStatCard } from "./common/StatCard";
export type { StatCardProps } from "./common/StatCard";

// Attendance
export {
  AttendanceStatsComponent,
  renderAttendanceStats,
} from "./attendance/AttendanceStats";

// RFID Form
export { RFIDFormComponent } from "./rfid-form";
