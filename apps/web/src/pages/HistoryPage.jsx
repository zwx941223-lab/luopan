import dayjs from "dayjs";
import { PageSection } from "../components/PageSection.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { fetchHistory, useDashboardData } from "../hooks/useDashboardData.js";

export function HistoryPage() {
  const history = useDashboardData(fetchHistory, []);
  const items = history.data || [];

  return (
    <div className="page-stack">
      <PageSection title="采集历史" subtitle="查看每次静默抓取的时间、类目和记录数">
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
                    <td>{item.triggerMode === "manual" ? "手动" : "定时"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StatusPanel>
      </PageSection>
    </div>
  );
}
