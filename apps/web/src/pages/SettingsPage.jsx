import { useDashboardData, fetchCategories } from "../hooks/useDashboardData.js";
import { PageSection } from "../components/PageSection.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";

export function SettingsPage() {
  const categories = useDashboardData(fetchCategories, []);
  const categoryList = categories.data || [];

  return (
    <div className="page-stack">
      <PageSection title="系统设置" subtitle="第一版先稳定账号、类目分工和采集约束">
        <StatusPanel loading={categories.loading} error={categories.error} empty={!categoryList.length}>
          <div className="setting-grid">
            <article className="setting-card">
              <h3>默认测试账号</h3>
              <p>`admin / Admin123456`</p>
              <p>`operator-a / Operator123`</p>
            </article>
            <article className="setting-card">
              <h3>当前类目</h3>
              <ul className="compact-list">
                {categoryList.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ul>
            </article>
            <article className="setting-card">
              <h3>采集约束</h3>
              <ul className="compact-list">
                <li>默认前 10 页</li>
                <li>静默接口抓取优先</li>
                <li>历史批次用于榜单对比</li>
              </ul>
            </article>
          </div>
        </StatusPanel>
      </PageSection>
    </div>
  );
}
