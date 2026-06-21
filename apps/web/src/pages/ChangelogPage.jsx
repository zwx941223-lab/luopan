import { PageSection } from "../components/PageSection.jsx";
import { APP_VERSION } from "../config.js";

const logs = [
  {
    version: "web-v1.9.0 / plugin-v4.0.8",
    date: "2026-06-22",
    items: [
      "按 xf1 存档恢复商品图字段识别逻辑，重新启用 image/img/pic 字段，同时保留 TOP 徽章、店铺头像和二维码过滤。"
    ]
  },
  {
    version: "web-v1.9.0 / plugin-v4.0.7",
    date: "2026-06-22",
    items: [
      "修复新采集商品图缺失问题：补充识别懒加载图片、背景图和更多商品图字段，同时继续过滤 TOP 徽章、店铺头像和视频封面。"
    ]
  },
  {
    version: "web-v1.9.0 / plugin-v4.0.6",
    date: "2026-06-21",
    items: [
      "榜单明细、今日新增、采集历史改为后端分页，每页默认 50 条，减少前端一次性加载压力。",
      "数据留存改为中国时间自然日保留今天 + 昨天，不再按滚动 72 小时保留。",
      "新增关键数据库索引，优化历史分页、今日统计、旧数据清理和榜单查询。",
      "今日新增口径固定为当天第一批有效采集作基准，后续批次中新出现的商品计入今日新增。",
      "采集历史增加分页按钮，避免历史批次过多时页面变长变卡。",
      "总览页记录数改为今日采集数，按中国时间 0 点归零。"
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
