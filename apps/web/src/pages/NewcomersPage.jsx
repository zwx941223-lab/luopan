import { useEffect, useMemo, useState } from "react";
import { CategoryFilter } from "../components/CategoryFilter.jsx";
import { PageSection } from "../components/PageSection.jsx";
import { RecordsTable } from "../components/RecordsTable.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { fetchCategories, fetchDiffs, useDashboardData } from "../hooks/useDashboardData.js";

const PAGE_SIZE = 50;

export function NewcomersPage() {
  const categories = useDashboardData(fetchCategories, []);
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);

  const categoryOptions = categories.data || [];
  const effectiveCategoryId = categoryId || categoryOptions[0]?.id || "";
  const diffs = useDashboardData(
    (token) => fetchDiffs(token, effectiveCategoryId, { page, pageSize: PAGE_SIZE }),
    [effectiveCategoryId, page]
  );
  const rows = useMemo(() => diffs.data?.newcomers || [], [diffs.data]);

  const currentCompareAt = diffs.data?.currentHour || "";
  const baselineCompareAt = diffs.data?.baselineHour || diffs.data?.previousHour || "";
  const todayBatchCount = Number(diffs.data?.todayBatchCount || 0);
  const currentRecordCount = Number(diffs.data?.currentRecordCount || 0);
  const baselineRecordCount = Number(diffs.data?.previousRecordCount || 0);
  const newcomerCount = Number(diffs.data?.newcomerCount || 0);
  const totalPages = Math.max(1, Number(diffs.data?.newcomerTotalPages || Math.ceil(newcomerCount / PAGE_SIZE) || 1));
  const safePage = Math.min(page, totalPages);
  const pageStart = newcomerCount ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(newcomerCount, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [effectiveCategoryId]);

  return (
    <div className="page-stack">
      <PageSection
        title="今日新增"
        subtitle="以今天 0 点后的第一批采集作为基准，统计今天后续批次中新出现的商品"
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
          <strong>今日基准对比</strong>
          <span>
            {baselineCompareAt ? `基准批次：${baselineCompareAt}` : "基准批次：暂无"}
            {"  |  "}
            {currentCompareAt ? `当前批次：${currentCompareAt}` : "当前批次：暂无"}
          </span>
        </div>
        <div className="compare-stats">
          <div className="compare-stat">
            <span>今日有效批次</span>
            <strong>{todayBatchCount}</strong>
          </div>
          <div className="compare-stat">
            <span>基准批次记录</span>
            <strong>{baselineRecordCount}</strong>
          </div>
          <div className="compare-stat">
            <span>当前批次记录</span>
            <strong>{currentRecordCount}</strong>
          </div>
          <div className="compare-stat">
            <span>今日新增</span>
            <strong>{newcomerCount}</strong>
          </div>
        </div>
        <StatusPanel
          loading={categories.loading || diffs.loading}
          error={categories.error || diffs.error}
          empty={!rows.length}
          emptyMessage={
            baselineCompareAt
              ? "今天基准批次之后，暂时没有识别到今日新增商品。"
              : "今天还没有可用基准批次，完成第一批采集后再查看。"
          }
        >
          <RecordsTable rows={rows} />
          {newcomerCount > PAGE_SIZE ? (
            <div className="table-pagination">
              <span>
                每页 {PAGE_SIZE} 条，当前 {pageStart}-{pageEnd} / 共 {newcomerCount} 条
              </span>
              <div className="pagination-buttons">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(1)}>
                  首页
                </button>
                <button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  上一页
                </button>
                <strong>{safePage} / {totalPages}</strong>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  下一页
                </button>
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
                  末页
                </button>
              </div>
            </div>
          ) : null}
        </StatusPanel>
      </PageSection>
    </div>
  );
}
