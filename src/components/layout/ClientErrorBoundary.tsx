import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ClientErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ClientPortal] Render error:", error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
    window.location.replace("/platform");
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 space-y-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <h2 className="text-lg font-semibold">Client portal error</h2>
              <p className="text-sm text-muted-foreground">
                {this.state.error.message || "An unexpected error occurred while loading the client portal."}
              </p>
              <Button onClick={this.handleReset} variant="outline" className="w-full">
                Return to Contractor Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
