// src/components/ErrorBoundary.jsx
import React from "react";

class ErrorBoundary extends React.Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Render crash:", error, info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            minHeight: "100vh",
            background: "#020617",
            color: "#fff",
            fontFamily: "monospace",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Something broke on this screen.</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#fca5a5" }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <pre
            style={{ whiteSpace: "pre-wrap", color: "#94a3b8", fontSize: 12 }}
          >
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;