import { PageSection } from "../components/PageSection.jsx";
import { APP_VERSION } from "../config.js";

const logs = [
  {
    version: "web-v1.9.19 / plugin-v4.1.7",
    date: "2026-06-22",
    items: [
      "优化网页端性能：榜单、历史、类目统计改为分页和轻量查询，减少数据量变大后的卡顿。",
      "优化采集稳定性：支持服务器自动采集、类目耗时统计，并修复定时采集丢轮和部分分页识别问题。",
      "增强服务器采集保护：接口数据未捕获时不再上传 DOM 兜底脏数据，避免出现未知店铺、暂无视频等异常记录。",
      "重做今日新增：以当天第一批为基准，保留当天出现过的新增商品，显示首次新增时间并支持变化对比。",
      "新增掉出榜单标记：今日新增商品后续未在最新批次出现时，用独立颜色标识。",
      "调整数据留存：按中国时间自然日保留今天和昨天，减少长期冗余数据拖慢系统。",
      "清理无用功能：删除导出入口和相关依赖，恢复商品图原样保存与展示。"
    ]
  },
  {
    version: "web-v1.8.0 / plugin-v4.0.5",
    date: "2026-06-21",
    items: [
      "恢复服务器交付版插件基础版本。",
      "修复 90 分钟定时采集在上一轮未结束时丢轮的问题，改为排队到当前轮结束后执行。",
      "榜单商品增加商品 ID 展示和复制按钮。",
      "默认登录账号恢复为 admin / Admin123456、operator-a / Operator123。"
    ]
  }
];

export function ChangelogPage() {
  return (
    <div className="page-stack">
      <PageSection title="更新日志" subtitle={`当前网页端版本：${APP_VERSION}`}>
        <div className="setting-grid">
          {logs.map((log) => (
            <article className="setting-card changelog-card" key={log.version}>
              <p className="section-eyebrow">{log.date}</p>
              <h3>{log.version}</h3>
              <ul className="compact-list">
                {log.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </PageSection>
    </div>
  );
}
