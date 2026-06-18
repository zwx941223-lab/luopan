import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { APP_VERSION } from "../config.js";

const navItems = [
  { to: "/overview", label: "经营总览", meta: "数据概览" },
  { to: "/ranking", label: "榜单明细", meta: "短视频榜" },
  { to: "/history", label: "采集历史", meta: "批次记录" },
  { to: "/settings", label: "系统设置", meta: "账号与类目" }
];

export function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="compass-shell">
      <header className="compass-topbar">
        <div className="compass-brand">
          <div className="brand-copy">
            <div className="brand-title-row">
              <strong>抖音电商·选品罗盘</strong>
              <em>运营</em>
            </div>
            <span>短视频榜单采集工作台</span>
          </div>
        </div>

        <div className="topbar-user">
          <div>
            <span>{APP_VERSION}</span>
            <strong>{user?.displayName || "未登录"}</strong>
            <small>{user?.role === "admin" ? "管理员账号" : user ? "运营账号" : "请先登录"}</small>
          </div>
          {user ? (
            <button className="topbar-action" onClick={logout}>
              退出登录
            </button>
          ) : (
            <Link className="topbar-action" to="/login">
              登录入口
            </Link>
          )}
        </div>
      </header>

      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div>
            <p className="sidebar-title">商品分析</p>
            <nav className="dashboard-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                >
                  <span>{item.label}</span>
                  <small>{item.meta}</small>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="sidebar-growth-art" aria-hidden="true">
            <span className="growth-cube cube-one" />
            <span className="growth-cube cube-two" />
            <span className="growth-cube cube-three" />
            <span className="growth-arrow" />
            <span className="growth-base" />
          </div>
        </aside>
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
