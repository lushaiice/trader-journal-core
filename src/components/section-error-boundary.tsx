import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Calm, non-technical fallback title. */
  title?: string;
  /** Calm, non-technical description. */
  description?: string;
  /** Render a compact card instead of the full empty-state surface. */
  compact?: boolean;
  children: ReactNode;
}
interface State { hasError: boolean }

/**
 * Section-level error boundary. Prevents a single broken widget from
 * white-screening the rest of the page. No raw stack traces leak to users.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console for debugging, but never to the UI.
    console.error("[SectionErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    const {
      title = "This section is temporarily unavailable.",
      description = "We had trouble loading this view. Try again in a moment.",
      compact,
    } = this.props;
    return (
      <div
        className={
          "surface-card flex flex-col items-center justify-center text-center px-6 " +
          (compact ? "py-8" : "py-12 md:py-16")
        }
      >
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
        <Button size="sm" variant="outline" className="mt-4" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
