import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export function LoginPage() {
  const { token, login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin123456");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (token) {
    return <Navigate to="/overview" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login(username, password);
    } catch (submitError) {
      setError(submitError.message || "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div>
          <p className="eyebrow">DY Monitor</p>
          <h1>抖音短视频榜监控后台</h1>
          <p className="login-copy">
            第一版聚焦类目分工、静默采集、榜单变化识别和运营直连动作。
          </p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="filter-field">
            <span>账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="filter-field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <div className="panel-state error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "登录中..." : "进入工作台"}
          </button>
        </form>
      </div>
    </div>
  );
}
