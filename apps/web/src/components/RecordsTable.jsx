import { useState } from "react";
import dayjs from "dayjs";

function formatVideoTime(value) {
  if (!value) {
    return "-";
  }

  const raw = String(value).trim();
  const numeric = /^\d{10,13}$/.test(raw) ? Number(raw) : null;
  const parsed = numeric
    ? dayjs(numeric < 100000000000 ? numeric * 1000 : numeric)
    : dayjs(raw);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm:ss") : String(value);
}

function isObjectPlaceholderText(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase() === "[objectobject]";
}

function formatRange(value) {
  if (!value) {
    return "-";
  }

  if (typeof value === "object") {
    const candidates = [
      value.value,
      value.val,
      value.range,
      value.rangeValue,
      value.range_value,
      value.showValue,
      value.show_value,
      value.displayValue,
      value.display_value,
      value.text,
      value.label,
      value.desc
    ];
    const direct = candidates.find((item) => item != null && String(item).trim());
    if (direct != null) {
      return formatRange(direct);
    }

    const min = value.min ?? value.lower ?? value.start ?? value.from;
    const max = value.max ?? value.upper ?? value.end ?? value.to;
    if (min != null || max != null) {
      return formatRange(`${min ?? ""}-${max ?? ""}`);
    }

    return "-";
  }

  const text = String(value).trim();
  if (/^(https?:)?\/\//i.test(text) || /^www\./i.test(text)) {
    return "-";
  }
  const compact = text.replace(/\s+/g, "");
  if (compact.length > 28 && /[\u4e00-\u9fa5]{5,}/.test(compact) && /[-~]/.test(compact)) {
    return "-";
  }
  return text && !isObjectPlaceholderText(text) ? text : "-";
}

function parseCleanRangeLevel(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text || text.length > 28 || !/[-~]/.test(text) || !/\d/.test(text) || /^(https?:)?\/\//i.test(text)) {
    return null;
  }
  const cjkCount = Array.from(text).filter((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 0x4e00 && code <= 0x9fff;
  }).length;
  if (cjkCount >= 5) {
    return null;
  }

  const normalized = text
    .replace(/\uFFE5|\u00A5|,|元/g, "")
    .replace(/万/g, "w")
    .replace(/千/g, "k")
    .toLowerCase();
  const values = [];
  const pattern = /(\d+(?:\.\d+)?)(w|k)?/gi;
  let match;
  while ((match = pattern.exec(normalized))) {
    let parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    if (match[2] === "w") {
      parsed *= 10000;
    } else if (match[2] === "k") {
      parsed *= 1000;
    }
    values.push(parsed);
  }
  return values.length ? Math.max(...values) : null;
}

function normalizeDiffItem(item) {
  const previousLevel = parseCleanRangeLevel(item?.previous);
  const currentLevel = parseCleanRangeLevel(item?.current);
  if (previousLevel == null || currentLevel == null) {
    return item;
  }
  const direction = currentLevel > previousLevel ? "up" : currentLevel < previousLevel ? "down" : "changed";
  return { ...item, direction };
}

function buildUniqueVideos(videos = []) {
  const seen = new Set();
  const items = [];

  for (const video of videos) {
    const videoId = String(video.videoId || "").trim();
    const rawCover = String(video.videoCover || "").trim();
    const rawUrl = String(video.videoUrl || "").trim();
    const urlLooksLikeImage = /\.(?:png|jpe?g|webp|gif)(?:\?|$)|tplv-|image\.image|douyinpic\.com\/img/i.test(rawUrl);
    const cover = rawCover || (urlLooksLikeImage ? rawUrl : "");
    const url = urlLooksLikeImage
      ? videoId
        ? `https://www.douyin.com/video/${encodeURIComponent(videoId)}`
        : ""
      : rawUrl || (videoId ? `https://www.douyin.com/video/${encodeURIComponent(videoId)}` : "");
    if (!cover || /avatar|logo|shop|store|qrcode|aweme-qrcode/i.test(cover)) {
      continue;
    }

    const key =
      videoId ||
      url ||
      `${cover}::${video.videoPublishedAt || ""}::${video.videoTitle || ""}`;

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push({ ...video, videoId, videoCover: cover, videoUrl: url });
  }

  return items;
}

function looksLikeShopLogo(url = "") {
  const text = String(url || "");
  if (/ecom-shop-material/i.test(text)) {
    return false;
  }
  return /logo|avatar|shop|store/i.test(text);
}

function getDisplayProductImage(row) {
  const productImage = String(row.productImage || "").trim();
  if (!productImage || looksLikeShopLogo(productImage)) {
    return "";
  }
  if (/rank|ranking|top|badge|medal|crown|champion|first|second|third/i.test(productImage)) {
    return "";
  }
  return productImage;
}

function getDisplayProductUrl(row) {
  const productId = String(row.productId || "").trim();
  if (productId) {
    return `https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=${encodeURIComponent(
      productId
    )}&origin_type=pc_compass_manage`;
  }

  const productUrl = String(row.productUrl || "").trim();
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

function renderDiffItems(row) {
  const items = (Array.isArray(row.diffItems) ? row.diffItems : []).filter((item) => {
    const text = `${item?.kind || ""} ${item?.label || ""} ${item?.text || ""}`;
    return item?.kind !== "videoCount" && !/视频数|video\s*count/i.test(text);
  });
  const displayItems = items.map(normalizeDiffItem).filter(Boolean);
  if (!displayItems.length && row.isNewcomer) {
    return <span className="diff-badge newcomer">本次新增</span>;
  }
  if (!displayItems.length) {
    return <span className="muted-inline">-</span>;
  }

  return (
    <div className="range-change-list">
      {displayItems.map((item) => (
        <span key={`${item.kind}-${item.previous}-${item.current}`} className={`range-change ${item.direction || ""}`}>
          <b>{item.label}</b>
          <span className="range-change-flow">
            <em>前 {formatRange(item.previous)}</em>
            <strong>{item.direction === "down" ? "↓" : item.direction === "up" ? "↑" : "→"}</strong>
            <em>后 {formatRange(item.current)}</em>
          </span>
        </span>
      ))}
    </div>
  );
}

function renderStatusTags(row) {
  const tags = (Array.isArray(row.statusTags) ? row.statusTags : []).filter((tag) => tag !== "排名变化");
  if (!tags.length) {
    return <span className="muted-inline">-</span>;
  }

  return (
    <div className="status-tag-list">
      {tags.map((tag) => (
        <span key={tag} className="status-tag">
          {tag}
        </span>
      ))}
    </div>
  );
}

function ProductIdCopyButton({ productId }) {
  const [copied, setCopied] = useState(false);
  const value = String(productId || "").trim();

  if (!value) {
    return null;
  }

  async function copyProductId() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="product-id-line">
      <span>商品ID：{value}</span>
      <button type="button" className="product-id-copy" onClick={copyProductId} title="复制商品 ID" aria-label="复制商品 ID">
        {copied ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="7" width="10" height="12" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h8" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function RecordsTable({ rows, onPreviewVideo }) {
  function openVideo(video, row) {
    if (!video?.videoUrl) {
      return;
    }

    if (typeof onPreviewVideo === "function") {
      onPreviewVideo({
        ...video,
        productName: row.productName,
        shopName: row.shopName
      });
      return;
    }

    window.open(video.videoUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="table-shell compass-table-shell">
      <table className="data-table compass-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>商品</th>
            <th>带货短视频</th>
            <th>短视频用户支付金额</th>
            <th>短视频点击次数</th>
            <th>短视频成交件数</th>
            <th>区间变化</th>
            <th>状态标签</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const videos = buildUniqueVideos(row.videos || []);
            const displayProductImage = getDisplayProductImage(row);
            const displayProductUrl = getDisplayProductUrl(row);

            return (
              <tr key={row.id}>
                <td className="rank-cell">
                  <span className="rank-pill">{row.rank || "-"}</span>
                </td>
                <td>
                  <div className="product-cell">
                    {displayProductImage ? (
                      <img src={displayProductImage} alt={row.productName || "商品图片"} />
                    ) : (
                      <div className="product-image-fallback">商品</div>
                    )}
                    <div>
                      {displayProductUrl ? (
                        <a className="product-title-link" href={displayProductUrl} target="_blank" rel="noreferrer">
                          {row.productName || "未命名商品"}
                        </a>
                      ) : (
                        <strong>{row.productName || "未命名商品"}</strong>
                      )}
                      <p>{row.shopName || "未知店铺"}</p>
                      <span>{row.categoryName || "短视频榜"}</span>
                      <ProductIdCopyButton productId={row.productId} />
                    </div>
                  </div>
                </td>
                <td>
                  <div className="video-thumb-grid">
                    {videos.slice(0, 5).map((video, index) => {
                      const playable = Boolean(video.videoUrl);

                      return (
                        <button
                          key={`${video.videoId || video.videoUrl || video.videoCover || index}`}
                          type="button"
                          className="video-thumb-button"
                          disabled={!playable}
                          onClick={() => (playable ? openVideo(video, row) : null)}
                          title={playable ? "点击打开视频" : "暂无视频链接"}
                        >
                          <div className="video-thumb-card">
                            {video.videoCover ? (
                              <img
                                src={video.videoCover}
                                alt={video.videoTitle || `视频${index + 1}`}
                                className="video-thumb-image"
                              />
                            ) : (
                              <div className="video-thumb-empty">视频</div>
                            )}
                            <div className="video-thumb-play">▶</div>
                          </div>
                          <div className="video-thumb-meta">{formatVideoTime(video.videoPublishedAt)}</div>
                        </button>
                      );
                    })}
                    {!videos.length ? <span className="muted-inline">暂无视频</span> : null}
                  </div>
                </td>
                <td>{formatRange(row.paymentRange)}</td>
                <td>{formatRange(row.clickRange)}</td>
                <td>{formatRange(row.orderRange)}</td>
                <td>{renderDiffItems(row)}</td>
                <td>{renderStatusTags(row)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
