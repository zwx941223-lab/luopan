export function StatusPanel({ loading, error, empty, emptyMessage = "当前暂无数据", children }) {
  if (loading) {
    return <div className="panel-state">数据加载中...</div>;
  }

  if (error) {
    return <div className="panel-state error">{error}</div>;
  }

  if (empty) {
    return <div className="panel-state">{emptyMessage}</div>;
  }

  return children;
}
