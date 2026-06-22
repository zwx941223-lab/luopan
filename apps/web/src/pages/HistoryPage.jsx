import { useState } from "react";
import dayjs from "dayjs";
import { PageSection } from "../components/PageSection.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { fetchHistory, useDashboardData } from "../hooks/useDashboardData.js";

const PAGE_SIZE = 50;

function formatDuration(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }
  return value < 1000 ? `${value}ms` : `${Math.round(value / 100) / 10}s`;
}

export function HistoryPage() {
  const [page, setPage] = useState(1);
  const history = useDashboardData((token) => fetchHistory(token, { page, pageSize: PAGE_SIZE }), [page]);
  const payload = history.data || {};
  const items = Array.isArray(payload) ? payload : payload.items || [];
  const totalItems = Array.isArray(payload) ? items.length : Number(payload.total || 0);
  const totalPages = Math.max(1, Number(payload.totalPages || Math.ceil(totalItems / PAGE_SIZE) || 1));
  const safePage = Math.min(page, totalPages);
  const pageStart = totalItems ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(totalItems, safePage * PAGE_SIZE);

  return (
    <div className="page-stack">
      <PageSection title="采集历史" subtitle="查看每次静默抓取的时间、类目、记录数和耗时">
        <StatusPanel loading={history.loading} error={history.error} empty={!items.length}>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>采集时间</th>
                  <th>类目</th>
                  <th>榜单</th>
                  <th>页数</th>
                  <th>记录数</th>
                  <th>切换</th>
                  <th>采集</th>
                  <th>上传</th>
                  <th>入库</th>
                  <th>总耗时</th>
                  <th>模式</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{dayjs(item.capturedAt).format("YYYY-MM-DD HH:mm:ss")}</td>
                    <td>{item.categoryName}</td>
                    <td>{item.rankingType}</td>
                    <td>{item.pageLimit}</td>
                    <td>{item.recordCount}</td>
                    <td>{formatDuration(item.timing?.switchMs)}</td>
                    <td>{formatDuration(item.timing?.collectMs)}</td>
                    <td>{formatDuration(item.timing?.uploadMs)}</td>
                    <td>{formatDuration(item.timing?.serverUploadMs)}</td>
                    <td>{formatDuration(item.timing?.totalMs)}</td>
                    <td>{item.triggerMode === "manual" ? "手动" : "自动"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalItems > PAGE_SIZE ? (
            <div className="table-pagination">
              <span>
                每页 {PAGE_SIZE} 条，当前 {pageStart}-{pageEnd} / 共 {totalItems} 条
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
