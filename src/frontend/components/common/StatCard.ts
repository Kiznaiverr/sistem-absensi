/**
 * StatCard Component
 * Reusable card for displaying statistics
 */

export interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  icon?: string;
  variant?: "default" | "siang" | "malam" | "total";
  elementId?: string;
}

export class StatCardComponent {
  props: StatCardProps;

  constructor(props: StatCardProps) {
    this.props = props;
  }

  private getVariantColor(): string {
    switch (this.props.variant) {
      case "siang":
        return "text-peach-300";
      case "malam":
        return "text-purple-500";
      case "total":
        return "text-mint-500";
      default:
        return "text-blue-500";
    }
  }

  render(): string {
    const colorClass = this.getVariantColor();
    const elementId = this.props.elementId || `stat-${this.props.variant}`;

    return `
      <div class="stat-card">
        <p class="stat-label">${this.props.label}</p>
        <p class="stat-value ${colorClass}" id="${elementId}">
          ${this.props.value}
        </p>
        ${this.props.unit ? `<p class="stat-unit">${this.props.unit}</p>` : ""}
      </div>
    `;
  }
}

export function renderStatCard(props: StatCardProps): string {
  return new StatCardComponent(props).render();
}
