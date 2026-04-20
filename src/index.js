import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    this.setState({ error: error.message, info: info.componentStack });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 20,
          fontFamily: "monospace",
          background: "#ffebee",
          minHeight: "100vh",
        }}>
          <div style={{
            background: "#c62828",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 16,
            fontWeight: "bold",
          }}>
            App crashed — error details below
          </div>
          <div style={{
            background: "#fff",
            border: "1px solid #ef9a9a",
            borderRadius: 8,
            padding: 14,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>ERROR MESSAGE</div>
            <pre style={{ fontSize: 13, color: "#c62828", whiteSpace: "pre-wrap", margin: 0 }}>
              {this.state.error}
            </pre>
          </div>
          <div style={{
            background: "#fff",
            border: "1px solid #ef9a9a",
            borderRadius: 8,
            padding: 14,
          }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>COMPONENT STACK</div>
            <pre style={{ fontSize: 11, color: "#555", whiteSpace: "pre-wrap", margin: 0 }}>
              {this.state.info}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);