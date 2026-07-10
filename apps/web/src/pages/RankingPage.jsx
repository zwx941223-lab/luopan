import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CategoryFilter } from "../components/CategoryFilter.jsx";
import { RecordsTable } from "../components/RecordsTable.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { fetchCategories, fetchRankingRows, useDashboardData } from "../hooks/useDashboardData.js";
import { APP_VERSION } from "../config.js";

const PAGE_SIZE = 50;

function formatBatchTime(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

export function RankingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categories = useDashboardData(fetchCategories, []);
  const [categoryId, setCategoryId] = useState(() => searchParams.get("categoryId") || "");
  const [viewMode, setViewMode] = useState("all");
  const [page, setPage] = useState(1);

  const categoryOptions = categories.data || [];
  const defaultCategoryId = categoryOptions.find((item) => item.hasData)?.id || categoryOptions[0]?.id || "";
  const effectiveCategoryId = categoryId || defaultCategoryId;
  const activeCategory = categoryOptions.find((item) => item.id === effectiveCategoryId);
  const refreshKey = searchParams.get("refresh") || "";
  const records = useDashboardData(
    (authToken) => {
      if (!effectiveCategoryId) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: PAGE_SIZE,
          totalPages: 1
        });
      }

      return fetchRankingRows(authToken, effectiveCategoryId, refreshKey, {
        viewMode,
        page,
        pageSize: PAGE_SIZE
      });
    },
    [effectiveCategoryId, refreshKey, viewMode, page]
  );
  const payload = records.data || {};
  const rows = Array.isArray(payload) ? payload : payload.items || [];
  const totalRows = Array.isArray(payload) ? rows.length : Number(payload.total || 0);
  const totalPages = Math.max(1, Number(payload.totalPages || Math.ceil(totalRows / PAGE_SIZE) || 1));
  const safePage = Math.min(page, totalPages);
  const pageStart = totalRows ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(totalRows, safePage * PAGE_SIZE);

  const compareCurrentBatchAt = rows[0]?.compareCurrentBatchAt || "";
  const comparePreviousBatchAt = rows[0]?.comparePreviousBatchAt || "";
  const currentBatchLabel = formatBatchTime(compareCurrentBatchAt);
  const previousBatchLabel = formatBatchTime(comparePreviousBatchAt);

  useEffect(() => {
    const requestedCategoryId = searchParams.get("categoryId") || "";
    if (requestedCategoryId && requestedCategoryId !== categoryId) {
      setCategoryId(requestedCategoryId);
    }
  }, [searchParams, categoryId]);

  useEffect(() => {
    if (categoryId || !categoryOptions.length) {
      return;
    }

    const nextCategoryId = defaultCategoryId;
    if (!nextCategoryId) {
      return;
    }

    setCategoryId(nextCategoryId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("categoryId", nextCategoryId);
    nextParams.delete("categoryName");
    nextParams.set("refresh", String(Date.now()));
    setSearchParams(nextParams, { replace: true });
  }, [categoryId, categoryOptions, defaultCategoryId, searchParams, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [effectiveCategoryId, viewMode, refreshKey]);

  function handleCategoryChange(nextCategoryId) {
    setCategoryId(nextCategoryId);
    const nextParams = new URLSearchParams(searchParams);
    if (nextCategoryId) {
      nextParams.set("categoryId", nextCategoryId);
    } else {
      nextParams.delete("categoryId");
    }
    nextParams.delete("categoryName");
    nextParams.set("refresh", String(Date.now()));
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="page-stack ranking-workbench">
      <section className="compass-hero">
        <div>
          <p className="section-eyebrow">商品榜单</p>
          <h1>抖音商品 TOP100</h1>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <span className="hero-orbit orbit-one" />
          <span className="hero-orbit orbit-two" />
          <span className="hero-play play-left" />
          <span className="hero-play play-right" />
          <span className="hero-platform" />
          <span className="hero-column column-one" />
          <span className="hero-column column-two" />
          <span className="hero-column column-three" />
          <span className="hero-panel panel-back" />
          <span className="hero-panel panel-front" />
        </div>
        <div className="hero-summary">
          <span>当前类目</span>
          <strong>{activeCategory?.name || searchParams.get("categoryName") || "等待采集"}</strong>
          <small>{APP_VERSION}</small>
        </div>
      </section>

      <section className="compass-rank-card">
        <div className="compass-filter-card">
          <div className="filter-row">
            <CategoryFilter
              categories={categoryOptions}
              value={effectiveCategoryId}
              selectedLabel={searchParams.get("categoryName") || ""}
              onChange={handleCategoryChange}
              allowAll={false}
            />
            <div className="filter-field">
              <span>榜单类型</span>
              <div className="fixed-filter-value">短视频榜</div>
            </div>
            <div className="filter-field">
              <span>数据口径</span>
              <div className="fixed-filter-value">实时数据</div>
            </div>
          </div>

          <div className="filter-footer">
            <div className="segmented-control">
              <button
                type="button"
                className={viewMode === "all" ? "segment active" : "segment"}
                onClick={() => setViewMode("all")}
              >
                全部商品
              </button>
              <button
                type="button"
                className={viewMode === "changed" ? "segment active" : "segment"}
                onClick={() => setViewMode("changed")}
              >
                仅变化
              </button>
              <button
                type="button"
                className={viewMode === "firstListed" ? "segment active" : "segment"}
                onClick={() => setViewMode("firstListed")}
              >
                今日新增
              </button>
            </div>
            <div className="compare-note">
              <strong>对比批次</strong>
              <span>
                当前：{currentBatchLabel || "暂无"}
                {"  |  "}
                上一批：{previousBatchLabel || "暂无"}
              </span>
            </div>
          </div>
        </div>

        <StatusPanel
          loading={categories.loading || records.loading}
          error={categories.error || records.error}
          empty={!rows.length}
          emptyMessage={
            viewMode === "firstListed"
              ? "当前筛选下没有今日新增商品。"
              : viewMode === "changed"
                ? "当前筛选下没有变化商品。"
                : "当前暂无榜单明细数据。"
          }
        >
          <RecordsTable rows={rows} />
          {totalRows > PAGE_SIZE ? (
            <div className="table-pagination">
              <span>
                每页 {PAGE_SIZE} 条，当前 {pageStart}-{pageEnd} / 共 {totalRows} 条
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
      </section>
    </div>
  );
}
