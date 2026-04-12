/**
 * Excel Styling Constants & Configuration
 */

export const EXCEL_CONFIG = {
  DAYS_IN_MONTH: 31,
  COMPANY_NAME: "PONDOK PESANTREN AL-KAHFI SOMALANGU",
};

export const COLUMN_WIDTHS = {
  NO: 5,
  NAME: 25,
  DATE: 3,
};

export const PAGE_SETUP = {
  paperSize: 9, // A4
  orientation: "landscape" as const,
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  margins: {
    left: 0.7,
    right: 0.7,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  },
};

export const FONT_STYLES = {
  title: { name: "Times New Roman", size: 14, bold: true },
  subtitle: { name: "Times New Roman", size: 12, bold: true },
  info: { name: "Times New Roman", bold: true },
  header: { name: "Times New Roman", bold: true },
  body: { name: "Times New Roman" },
};

export const ALIGNMENT = {
  centerMiddle: { horizontal: "center" as const, vertical: "middle" as const },
  centerCenter: {
    horizontal: "center" as const,
    vertical: "middle" as const,
  },
  leftCenter: { horizontal: "left" as const, vertical: "middle" as const },
  left: { horizontal: "left" as const },
};

export const BORDER_STYLES = {
  thin: {
    top: { style: "thin" as const },
    left: { style: "thin" as const },
    bottom: { style: "thin" as const },
    right: { style: "thin" as const },
  },
  none: {
    top: { style: undefined },
    left: { style: undefined },
    bottom: { style: undefined },
    right: { style: undefined },
  },
};
