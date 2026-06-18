import { useMemo, useState } from "react";
import { CategoryFilter } from "../components/CategoryFilter.jsx";
import { PageSection } from "../components/PageSection.jsx";
import { RecordsTable } from "../components/RecordsTable.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { fetchCategories, fetchDiffs, useDashboardData } from "../hooks/useDashboardData.js";

export function NewcomersPage() {
  const categories = useDashboardData(fetchCategories, []);
  const [categoryId, setCategoryId] = useState("");

  const categoryOptions = categories.data || [];
  const effectiveCategoryId = categoryId || categoryOptions[0]?.id || "";
  const diffs = useDashboardData((token) => fetchDiffs(token, effectiveCategoryId), [effectiveCategoryId]);
  const rows = useMemo(() => diffs.data?.newcomers || [], [diffs.data]);

  const currentCompareAt = diffs.data?.currentHour || "";
  const previousCompareAt = diffs.data?.previousHour || "";
  const currentRecordCount = Number(diffs.data?.currentRecordCount || 0);
  const previousRecordCount = Number(diffs.data?.previousRecordCount || 0);
  const newcomerCount = Number(diffs.data?.newcomerCount || 0);

  return (
    <div className="page-stack">
      <PageSection
        title="新增上榜"
        subtitle="对比最近两次采集，优先查看新进入榜单的商品"
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
            <span>新增上榜数</span>
            <strong>{newcomerCount}</strong>
          </div>
        </div>
        <StatusPanel
          loading={categories.loading || diffs.loading}
          error={categories.error || diffs.error}
          empty={!rows.length}
          emptyMessage={
            previousCompareAt
              ? "最近两次采集对比后，当前没有新增上榜商品。"
              : "当前只有一批采集数据，至少需要两批才能识别新增上榜。"
          }
        >
          <RecordsTable rows={rows} />
        </StatusPanel>
      </PageSection>
    </div>
  );
}
