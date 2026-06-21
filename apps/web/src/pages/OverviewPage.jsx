import { useDashboardData, fetchCategories, fetchOverview } from "../hooks/useDashboardData.js";
import { MetricCard } from "../components/MetricCard.jsx";
import { PageSection } from "../components/PageSection.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";

export function OverviewPage() {
  const overview = useDashboardData(fetchOverview, []);
  const categories = useDashboardData(fetchCategories, []);
  const categoryList = categories.data || [];
  const missedCategories = categoryList.filter((category) => !category.hasData);

  return (
    <div className="page-stack">
      <PageSection title="经营总览" subtitle="类目协同与采集状态">
        <StatusPanel loading={overview.loading || categories.loading} error={overview.error || categories.error}>
          <div className="metrics-grid">
            <MetricCard label="当前可见类目" value={overview.data?.categoryCount || 0} accent="gold" />
            <MetricCard label="已有数据类目" value={overview.data?.categoriesWithData || 0} accent="teal" />
            <MetricCard label="未采集到类目" value={missedCategories.length} accent="rose" />
            <MetricCard label="今日采集数" value={overview.data?.recordCount || 0} />
          </div>
        </StatusPanel>
      </PageSection>

      <PageSection title="未采集到的类目">
        <StatusPanel loading={categories.loading} error={categories.error} empty={!categoryList.length}>
          {missedCategories.length ? (
            <div className="missed-category-list">
              {missedCategories.map((category) => (
                <span key={category.id}>{category.name}</span>
              ))}
            </div>
          ) : (
            <div className="missed-category-ok">全部类目已有采集数据</div>
          )}
        </StatusPanel>
      </PageSection>

      <PageSection title="关注类目" subtitle="当前账号默认查看的运营类目">
        <StatusPanel loading={categories.loading} error={categories.error} empty={!categoryList.length}>
          <div className="category-grid">
            {categoryList.map((category) => (
              <article key={category.id} className="category-card">
                <p className="section-eyebrow">{category.code || "category"}</p>
                <h3>{category.name}</h3>
                <span>{category.hasData ? "已有采集数据" : "暂无采集数据"}</span>
              </article>
            ))}
          </div>
        </StatusPanel>
      </PageSection>
    </div>
  );
}
