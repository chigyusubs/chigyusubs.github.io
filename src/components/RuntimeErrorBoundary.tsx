import React from "react";
import { copyDebugBuffer } from "../lib/debugState";
import { Button } from "./ui/Button";
import { SectionCard } from "./ui/SectionCard";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class RuntimeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Runtime error", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const copyEvents = async () => {
      const text = copyDebugBuffer();
      if (!text || !text.trim()) {
        alert("No internal events logged yet.");
        return;
      }
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          alert("Internal events copied");
          return;
        } catch {
          // fall through
        }
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-1000px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        alert("Internal events copied");
      } catch {
        alert(text);
      } finally {
        document.body.removeChild(textarea);
      }
    };

    return (
      <div className="max-w-5xl mx-auto px-6 py-4">
        <SectionCard
          title="Something went wrong"
          subtitle="A runtime error occurred. Copy debug events and refresh."
        >
          <div className="space-y-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              {this.state.error.message}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button tone="secondary" onClick={copyEvents}>
                Copy internal debug events
              </Button>
              <Button tone="primary" onClick={() => window.location.reload()}>
                Refresh app
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }
}
