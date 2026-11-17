import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, reloadForChunkError } from "@/lib/chunk-load-error.ts";

type Props = { children: ReactNode; /** When this changes, clear a caught error so nav can recover. */ resetKey?: string };
type State = { error: Error | null };

/** Catches render crashes so the app shows a message instead of a white screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadForChunkError()) return;
    console.error("[app] uncaught render error", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-2xl font-bold tracking-tight">This page hit a problem</p>
        <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
