/**
 * Layout Component
 * Main layout wrapper for the application
 */

export interface LayoutProps {
  header?: string;
  stats: string;
  mainContent: string;
  sidebar?: string;
}

export class LayoutComponent {
  props: LayoutProps;

  constructor(props: LayoutProps) {
    this.props = props;
  }

  render(): string {
    return `
      <div class="app-container">
        <div class="app-wrapper">
          ${this.props.header || ""}
          
          ${this.props.stats}
          
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div class="col-span-2">
              ${this.props.mainContent}
            </div>
            <div>
              ${this.props.sidebar || ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export function renderLayout(props: LayoutProps): string {
  return new LayoutComponent(props).render();
}
