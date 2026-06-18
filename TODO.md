# TODO

## Highest Priority

- Live-verify one fresh capture on the real `短视频榜 / 实时` page
- Confirm newest uploaded rows now include real:
  - `productUrl`
  - `videoUrl`
  - `videoPublishedAt`
  - `shopName`
- Confirm dashboard shows the newest uploaded records under the correct live category
- Remove or isolate historical bad batches with empty or wrong records

## Extension

- Verify current text selectors for `短视频榜` and `实时`
- Verify single-page cap remains about `10` rows
- Inspect fresh live payload if product/video deep fields are still empty
- Keep Chinese UI in panel
- Keep current category as the upload source of truth

## Backend

- Keep category ids aligned with Compass category ids
- Auto-register uploaded categories
- Clean old wrong batches from `store.json` after live verification

## Web

- Confirm ranking page renders newest uploaded records only
- Confirm video modal opens real playable video or Douyin page fallback
- Continue Compass-style visual tuning after data chain is stable

## Later

- Add proper category/user admin UI
- Replace JSON store with MySQL/PostgreSQL
- Deploy to Alibaba Cloud
- Add scheduled capture
- Add stronger video playback/download strategy
