import { useDashboardData, fetchCategories, fetchOverview } from "../hooks/useDashboardData.js";
import { MetricCard } from "../components/MetricCard.jsx";
import { PageSection } from "../components/PageSection.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";

export function OverviewPage() {
  const overview = useDashboardData(fetchOverview, []);
  const categories = useDashboardData(fetchCategories, []);
  const categoryList = categories.data || [];

  return (
    <div className="page-stack">
      <PageSection title="经营总览" subtitle="类目协同与采集状态">
        <StatusPanel loading={overview.loading || categories.loading} error={overview.error || categories.error}>
          <div className="metrics-grid">
            <MetricCard label="当前可见类目" value={overview.data?.categoryCount || 0} accent="gold" />
            <MetricCard label="已有数据类目" value={overview.data?.categoriesWithData || 0} accent="teal" />
            <MetricCard label="最新记录数" value={overview.data?.recordCount || 0} accent="rose" />
            <MetricCard label="最新商品数" value={overview.data?.productCount || 0} />
          </div>
        </StatusPanel>
      </PageSection>

      <PageSection title="关注类目" subtitle="当前账号默认查看的运营类目">
        <StatusPanel loading={categories.loading} error={categories.error} empty={!categoryList.length}>
          <div className="category-grid">
            {categoryList.map((category) => (
              <article key={category.id} className="category-card">
                <p className="section-eyebrow">{category.code || "category"}</p>
                <h3>{category.name}</h3>
                <span>已绑定运营视图</span>
              </article>
            ))}
          </div>
        </StatusPanel>
      </PageSection>
    </div>
  );
}
