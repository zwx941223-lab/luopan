import { PageSection } from "../components/PageSection.jsx";
import { APP_VERSION } from "../config.js";

const logs = [
  {
    version: "web-v1.9.22",
    date: "2026-07-10",
    items: [
      "修复榜单明细未带行业类目时可能触发后端内存溢出的问题。",
      "榜单明细接口现在会在后端默认使用第一个有数据的可见类目，不再因为空类目请求读取全库 records。",
      "打开榜单明细页时仍会自动展示默认类目，切换其它类目和今日新增视图保持原有操作方式。"
    ]
  },
  {
    version: "web-v1.9.21",
    date: "2026-07-10",
    items: [
      "补充网页端更新日志，恢复更新日志页面的正常中文展示。",
      "明确记录 web-v1.9.20 的榜单明细 502 修复内容，方便后续排查时区分网页问题和插件采集问题。",
      "本次只调整网页端展示说明，不改变插件采集逻辑，插件稳定基线仍为 plugin-v4.4.0。"
    ]
  },
  {
    version: "web-v1.9.20 / plugin-v4.4.0",
    date: "2026-07-10",
    items: [
      "修复打开网页端“榜单明细”后服务器偶发 502 的问题。",
      "根因是普通榜单明细请求仍会额外计算“今日新增”基准数据，数据量变大后会拖慢后端查询。",
      "普通“全部商品”和“仅变化”列表已跳过今日新增基准扫描，今日新增视图仍保留原有专用查询逻辑。",
      "收紧今日新增的扫描范围，降低长时间运行后的服务器压力。",
      "插件采集逻辑未改动，继续沿用已经验证通过的 plugin-v4.4.0。"
    ]
  },
  {
    version: "plugin-v4.4.0",
    date: "2026-07-03",
    items: [
      "启动和运行过程中自动识别罗盘真实行业类目，替代旧的固定类目菜单。",
      "面板仍保留一级类目勾选和二级类目下拉，实际采集优先使用罗盘接口中的 industryId 与 categoryId。",
      "类目采集优先复用榜单接口模板直接请求对应类目数据，页面点击和翻页流程保留为兜底路径。",
      "单类目采集页数保持 20 页。",
      "该版本已确认采集链路可用，作为当前插件稳定基线保存。"
    ]
  },
  {
    version: "web-v1.9.19 / plugin-v4.1.7",
    date: "2026-06-22",
    items: [
      "优化网页端性能，榜单、历史和类目统计改为分页和轻量查询，减少数据量变大后的卡顿。",
      "增强服务器采集稳定性，支持服务器自动采集和类目耗时统计，并修复定时采集丢轮问题。",
      "取消接口失败时上传 DOM 脏数据的兜底逻辑，避免出现未知店铺、暂无视频等异常记录。",
      "重做今日新增逻辑，以当天第一批可信数据为基准，后续首次出现的商品进入今日新增。",
      "新增掉出榜单标记，今日新增商品后续未在最新批次出现时会保留展示并标记。",
      "按中国时间自然日保留今天和昨天的数据，减少长期冗余数据拖慢系统。"
    ]
  },
  {
    version: "web-v1.8.0 / plugin-v4.0.5",
    date: "2026-06-21",
    items: [
      "恢复服务器交付版插件基线。",
      "修复 90 分钟定时采集在上一轮未结束时丢轮的问题，改为排队到当前轮结束后执行。",
      "榜单商品增加商品 ID 展示和复制按钮。",
      "恢复默认登录账号配置。"
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
