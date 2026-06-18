import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "页面渲染异常"
    };
  }

  componentDidCatch(error) {
    console.error("[DY Monitor] web render failed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen-center">
          <div style={{ textAlign: "center", maxWidth: 560 }}>
            <h2 style={{ marginBottom: 12 }}>网页工作台加载失败</h2>
            <p style={{ color: "#6d7788", marginBottom: 16 }}>
              {this.state.message || "页面渲染异常，请刷新后重试。"}
            </p>
            <button className="primary-button" onClick={() => window.location.reload()}>
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
