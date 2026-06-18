import { useState } from "react";
import { CategoryFilter } from "../components/CategoryFilter.jsx";
import { PageSection } from "../components/PageSection.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { fetchCategories, fetchDiffs, useDashboardData } from "../hooks/useDashboardData.js";

function getDisplayProductUrl(item) {
  const productId = String(item.productId || "").trim();
  if (productId) {
    return `https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=${encodeURIComponent(
      productId
    )}&origin_type=pc_compass_manage`;
  }

  const productUrl = String(item.productUrl || "").trim();
  if (!productUrl) {
    return "";
  }

  try {
    const url = new URL(productUrl);
    const id = url.searchParams.get("id");
    if (id && /haohuo\.jinritemai\.com/i.test(url.hostname)) {
      return `https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=${encodeURIComponent(
        id
      )}&origin_type=pc_compass_manage`;
    }
  } catch {
    return productUrl;
  }

  return productUrl;
}

export function ShiftsPage() {
  const categories = useDashboardData(fetchCategories, []);
  const [categoryId, setCategoryId] = useState("");

  const categoryOptions = categories.data || [];
  const effectiveCategoryId = categoryId || categoryOptions[0]?.id || "";
  const diffs = useDashboardData((token) => fetchDiffs(token, effectiveCategoryId), [effectiveCategoryId]);
  const shifts = diffs.data?.shifts || [];

  const currentCompareAt = diffs.data?.currentHour || "";
  const previousCompareAt = diffs.data?.previousHour || "";
  const currentRecordCount = Number(diffs.data?.currentRecordCount || 0);
  const previousRecordCount = Number(diffs.data?.previousRecordCount || 0);
  const shiftCount = Number(diffs.data?.shiftCount || 0);

  return (
    <div className="page-stack">
      <PageSection
        title="区间变化"
        subtitle="对比最近两次采集，聚焦支付、点击和成交区间的变化"
        actions={
          <CategoryFilter
            categories={categoryOptions}
            value={effectiveCategoryId}
            onChange={setCategoryId}
            allowAll={false}
          />
        }
      >
        <div className="compare-note">
          <strong>对比批次</strong>
          <span>
            {currentCompareAt ? `当前批次：${currentCompareAt}` : "当前批次：暂无"}
            {"  |  "}
            {previousCompareAt ? `上一批次：${previousCompareAt}` : "上一批次：暂无"}
          </span>
        </div>
        <div className="compare-stats">
          <div className="compare-stat">
            <span>当前批次记录</span>
            <strong>{currentRecordCount}</strong>
          </div>
          <div className="compare-stat">
            <span>上一批次记录</span>
            <strong>{previousRecordCount}</strong>
          </div>
          <div className="compare-stat">
            <span>变化商品数</span>
            <strong>{shiftCount}</strong>
          </div>
        </div>
        <StatusPanel
          loading={categories.loading || diffs.loading}
          error={categories.error || diffs.error}
          empty={!shifts.length}
          emptyMessage={
            previousCompareAt
              ? "最近两次采集对比后，当前没有发现支付、点击或成交区间变化。"
              : "当前只有一批采集数据，至少需要两批才能识别区间变化。"
          }
        >
          <div className="timeline-grid">
            {shifts.map((item) => (
              <article key={item.id} className="shift-card">
                <div className="shift-head">
                  <div>
                    <p className="section-eyebrow">#{item.rank}</p>
                    <h3>{item.productName}</h3>
                    <span>{item.shopName}</span>
                  </div>
                  {getDisplayProductUrl(item) ? (
                    <a className="secondary-button" href={getDisplayProductUrl(item)} target="_blank" rel="noreferrer">
                      查看商品
                    </a>
                  ) : null}
                </div>
                <ul className="change-list">
                  {(item.changes || []).map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </StatusPanel>
      </PageSection>
    </div>
  );
}
