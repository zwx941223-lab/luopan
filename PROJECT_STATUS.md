# DY Monitor Project Status

## 2026-06-21 - plugin-v4.0.6 + web-v1.8.2

- Added `compassDetailUrl` capture for Luopan `查看详情` links and displayed it as a separate table action.
- Replaced the old `首次上榜` filter with `今日新增`, calculated from today's first captured batch as the baseline.

## 2026-06-21 - web-v1.8.1 ranking detail speedup

- Added a 30-second selected-category ranking rows cache to speed repeated page loads and filter switches.
- Changed ranking detail backfill to run only when latest batch rows have missing display fields, and reduced the fallback scan window.

## 2026-06-21 - plugin-v4.0.5 manual start

- Removed the panel auto-start timer on page open.
- The plugin now waits for the operator to click `全类目采集`, `立即执行一轮`, or explicitly enable the 90-minute timer before running.

## 2026-06-21 - web-v1.8.0 server performance hardening

- Added short-lived category stats caching to avoid full aggregate work on every page/plugin panel load.
- Replaced common full-store reads for records, diffs, and latest-batch with targeted SQLite queries.
- Added ranking/hour and category/captured indexes plus passive WAL checkpoint after retention cleanup.
- Added `/api/monitor/diagnostics` and duration headers to help locate server-side slow requests after long-running collection.

## 2026-06-21 - plugin-v4.0.4 + web-v1.7.99 delivery

- Restored plugin from `xf1` as the stable baseline before applying the category fix.
- Kept the original successful category-click flow and only passed standard `level1` / `level2` metadata from the panel.
- This prevents multi-slash second-level categories such as `智能家居/电子/电工` from being truncated during switching.
- Verified plugin syntax checks plus server and web production builds.

## 2026-06-21 - plugin-v4.0.2 + server fallback hotfix

- Plugin uploads now mark DOM fallback captures with `captureFallbackMode: dom` and `domFallbackPages`.
- Backend stores fallback metadata and allows DOM fallback batches to pass the short-video quality gate when row counts are complete.
- Latest-batch selection now accepts DOM fallback batches, targeting `玩具乐器/玩具` where the visible short-video table is valid but the API parser lacks video signal.

## 2026-06-21 - web-v1.7.99

- Added an overview metric for categories that still have no captured data.
- Added a compact "未采集到的类目" section so operators can quickly see missing categories after a successful run.
- Restored the overview page copy to readable Chinese while keeping the existing Compass-like layout.

## 2026-06-21 - plugin-v4.0.1

- Added DOM table fallback capture when a category's short-video API response cannot be recognized.
- The fallback is page-scoped and only runs when API rows are empty, preserving the normal API-first path for stable categories.
- This targets the remaining `玩具乐器/玩具` empty-data failure after server deployment.

## 2026-06-21 - server performance hotfix

- Optimized high-traffic backend reads for large datasets.
- Category list now uses SQLite aggregate stats instead of loading all records into memory.
- Ranking detail now reads only the selected category's latest trusted batches plus limited recent backfill data.
- Overview stats now use SQL aggregation for the latest capture hour.
- Capture upload now appends the current batch directly to SQLite instead of reading and rewriting the whole database.
- Capture history now returns a limited recent batch list and no longer loads all records.
- Web bumped to `web-v1.7.98` for the lighter capture-history request.
- This keeps plugin capture behavior unchanged and targets web lag after multi-day full-category retention.

## 2026-06-18 - plugin-v4.0.0

- Switched plugin version naming from test builds to the formal `plugin-v4.0.0`.
- Updated the plugin panel to show level-1 categories with level-2 category dropdowns.
- Manual capture is preserved: operators/admins can select specific level-1 rows and their level-2 dropdown values, then run one round.
- Server mode is fixed: the plugin auto-starts a full-category collection round after loading and repeats every 90 minutes.
- Timer collection always uses all standard categories and does not depend on the manual selection state.
- Verified extension syntax checks for `silent-capture.js`, `runtime.js`, and `panel.js`.

## 2026-06-18 - plugin-v4.0.0-test19

- Reduced category apply fixed wait from 5 seconds to 2 seconds.
- Kept the existing category label confirmation wait unchanged to preserve stability after the shorter fixed pause.
- Verified extension syntax checks for `silent-capture.js`, `runtime.js`, and `panel.js`.

## 2026-06-18 - plugin-v4.0.0-test18

- Fixed Compass `首次上榜` capture by reading the visible table row label directly.
- The visible row patch now merges `isCompassFirstListed` by rank together with payment/click/order fallback fields.
- This avoids relying only on API `first/new` keyword guessing.
- Verified extension syntax checks for `silent-capture.js`, `runtime.js`, and `panel.js`.

## 2026-06-18 - web-v1.7.97

- Restored all payment/click/order change badges even when a value cannot be parsed for direction.
- Fixed range-change badge backgrounds so the colored area expands to cover the full text.
- Kept the single-column compact layout without horizontal scrolling.
- Built successfully with `npm run build:web`.

## 2026-06-18 - web-v1.7.96

- Fixed range-change badge direction and background by recalculating direction from clean numeric ranges.
- Dirty mixed text such as product titles plus price bands is no longer allowed to generate/display range-change badges.
- Backend now ignores diff items when either side is not a clean short range value.
- Web display also filters historical dirty diff items before rendering.
- Built successfully with `npm run build:web` and `npm run build:server`.

## 2026-06-18 - web-v1.7.95

- Changed range-change badges back to a compact single-column stack.
- Removed horizontal scrolling from the range-change cell.
- Kept reduced font size and padding so multiple changes take less vertical space.
- Built successfully with `npm run build:web`.

## 2026-06-18 - web-v1.7.94

- Compressed the range-change badges in the ranking table.
- Multiple payment/click/order changes now stay in a single horizontal row instead of wrapping into two-column/two-line blocks.
- Reduced badge font size, padding, and spacing to keep the table easier to scan.
- Built successfully with `npm run build:web`.

## 2026-06-18 - web-v1.7.93

- Fixed range-change display so `视频数` changes are ignored completely.
- Backend diff filtering now rejects `videoCount` items and any `视频数/video count` diff text.
- Web ranking table and `仅变化` filter also ignore historical `视频数` diff items so old batches do not show them.
- Built successfully with `npm run build:web` and `npm run build:server`.

## 2026-06-18 - web-v1.7.90

- Fixed video timestamp display for Unix second/millisecond values such as `1781687682`; the web now formats them as normal local dates instead of invalid/future-looking strings.
- Fixed video thumbnail click fallback: when the captured media URL is actually an image cover, the web uses `videoId` to open `https://www.douyin.com/video/{videoId}`.
- This is a web display/link fix and does not change plugin capture logic.
- Built successfully with `npm run build:web`.

## 2026-06-18 - plugin-v4.0.0-test15 + web-v1.7.89

- Removed the web ranking table's `带货视频数` column.
- Fixed video display regression caused by overly strict cover filtering: image-like Compass media URLs are now treated as video covers, not as playable URLs.
- Extension now converts image-like video media URLs into covers and uses `https://www.douyin.com/video/{videoId}` as the clickable video URL when a video id is available.
- Added visible-table metric backfill during capture so payment/click/order ranges can be filled from the currently rendered Compass table when the API row parser returns empty values.
- Existing old batches with blank metric fields are not retroactively repaired; the fix applies to the next capture.
- Built successfully: plugin syntax checks, server build, and web build all passed.

## 2026-06-18 - plugin-v4.0.0-test14 + web-v1.7.88

- Removed `videoCount` from backend ranking diff items, so "video count before/after" no longer appears in range-change badges.
- Tightened extension video extraction: video covers now come only from video-cover-like fields, and generic product/shop images are no longer used as video covers.
- Added Chinese metric fragments for payment/click/order extraction to improve later-page field parsing.
- Filtered web video thumbnails so entries without a real cover or with avatar/logo/shop-like covers are not shown in the short-video column.
- Built successfully: plugin syntax checks, server build, and web build all passed.

## 2026-06-18 - plugin-v4.0.0-test13

- Created archive `_archives/早上7点-20260618-070908.zip` before speed changes. The archive includes current code and a consistent SQLite database snapshot.
- Optimized only the page-turn wait path, not the category selection or capture data mapping logic.
- After clicking a page, the extension now continues once the target page is active and a fresh API candidate is observed, with conservative timeout fallback still in place.
- Removed the per-page trailing 300ms wait when rows are already read successfully.
- Cleared backend business data after the change: `records=0`, `capture_batches=0`, `categories=0`; users/settings were kept.
- Cleared the web client's local/session/cache storage and refreshed the ranking page.

## 2026-06-18 - plugin-v4.0.0-test12

- Fixed the "capture succeeds but web shows no latest data" case caused by page 1 being dropped.
- Root cause: after category switching, Compass often already emitted the page-1 API response, but capture start cleared API candidates and waited only for newer responses. Page 1 then had 0 rows while pages 2-10 uploaded, producing a 90-row batch without rank 1.
- The extension now clears stale API candidates before switching category, keeps fresh category-switch API responses for capture, and actively refreshes page 1 before reading.
- Web cache was cleared in the in-app browser; backend data was not deleted.

## 2026-06-18 - plugin-v4.0.0-test11

- Tightened category switching to click only the real Compass cascader beside the visible category label, then verify that the dropdown menu actually opened before selecting level 1 and level 2.
- Added category-open debug state so failed runs can distinguish between "picker not found", "menu not opened", and "level item not found".
- Re-scoped pagination to the ranking table's nearest lower pagination container first, falling back to the old bottom pagination only when table-relative detection is unavailable.
- Kept backend and web untouched.

## 2026-06-18 - plugin-v4.0.0-test10

- Fixed the category picker locator used before the legacy cascader logic.
- The picker search no longer treats arbitrary `button/div` nodes beside `行业类目` as the category selector, preventing the small help/icon node from being clicked instead of the real cascader.
- It now only accepts real cascader/select-like controls with a reasonable width/height and stores picker debug details for failed category switches.

## 2026-06-18 - plugin-v4.0.0-test9

- Replaced the new category switching routine with the legacy full-plugin cascader strategy from `dy-monitor-完整版(2).zip`.
- Legacy category switching now uses title matching, role/data-level matching, per-column menu matching, long waits between levels, and last-visible-column `全部` selection.
- Replaced pagination with the legacy style: re-read the pagination container every page, prefer the next numeric page, then fall back to next-page controls, with longer waits for Compass DOM/API refresh.
- The flow still ensures the page is on short-video ranking and realtime before category switching/capture.

## 2026-06-18 - plugin-v4.0.0-test8

- Changed category switching from fail-fast validation to an active apply loop.
- The extension now retries category application up to three times: open picker, click level 1, click level 2, click third-column `全部` when present, click confirm/apply-style buttons when visible, press Escape to close the popup, then re-check the visible category field.
- This focuses on actually pushing Compass into the selected category instead of merely blocking capture when the first click sequence does not apply.

## 2026-06-18 - plugin-v4.0.0-test7

- Fixed category switching false positives: the extension no longer treats a level-2 click as success unless the visible Compass category field updates to the target level-2 category.
- After clicking a level-2 category, the extension clicks `全部` in the third cascader column when it appears, matching Compass' "all under this second-level category" behavior.
- If the visible category field still shows the old category, the run fails before capture so old-category data is not uploaded as the selected category.

## 2026-06-18 - plugin-v4.0.0-test6

- Strengthened Compass pagination clicks with PointerEvent, MouseEvent, and native `element.click()` dispatch.
- Page buttons now prefer the inner clickable `a/button` node instead of the surrounding `li` wrapper.
- If a direct page click does not move the active page, the collector retries with the next-page button and stores per-page debug in diagnostics.

## 2026-06-18 - plugin-v4.0.0-test5

- Fixed API-primary pagination so each page waits for a Compass API response captured after that page action, preventing page 1 data from being reused for pages 2-10.
- Strengthened pagination clicking by clicking the closest page `li/button/a` container instead of only the inner text node.
- First page now explicitly triggers realtime refresh before waiting for page-1 API rows.

## 2026-06-18 - plugin-v4.0.0-test4

- Corrected the rebuild direction from DOM-primary capture to API-primary capture.
- Restored a clean runtime API listener that injects `page-api-hook.js` and stores recent Compass `/compass_api/` responses for the new collector.
- Next collector logic uses page clicks only to trigger Compass requests; data parsing is based on captured API JSON instead of DOM row guessing.

## 2026-06-18 - plugin-v4.0.0-test3

- Added image-anchored row detection: the new collector now finds product/video images first, then walks up to the surrounding row container.
- Reduced dependency on Douyin table class names and Chinese header text, making row detection less sensitive to Compass' custom DOM structure.
- Updated range parsing to use clean numeric patterns instead of corrupted Chinese-text regex.

## 2026-06-18 - plugin-v4.0.0-test2

- Expanded the new plugin's DOM row detection for Douyin Compass tables that render rows with custom `div`/semi-table classes instead of standard `tr` rows.
- Added visible-row filtering by size, image presence, and screen position, then de-duplicated rows by vertical position so nested row elements do not create duplicates.
- This targets the `没有读取到榜单数据` failure from `plugin-v4.0.0-test1` without changing category switching or upload logic.

## 2026-06-18 - plugin-v4.0.0-test1

- Rebuilt the extension core from scratch instead of continuing to patch the old capture code.
- Replaced the old runtime, category list, capture engine, and floating panel with a smaller clean implementation.
- Kept the backend upload contract unchanged: records still post to `/api/monitor/capture/upload` with `captureSchemaVersion: 4`, fixed short-video realtime Top100 capture, and the existing record fields.
- New test scope: category selection, page-by-page DOM capture for 10 pages, upload, basic progress, and batch selected/all category execution.
- Previous implementation was archived before rewrite as `_archives/dy-monitor-extension-before-rewrite-plugin-v3.3.42-20260618-061738.zip`.

## 2026-06-18 - plugin-v3.3.42

- Treat a successful level-2 cascader click as a successful category switch, then proceed to capture immediately.
- Removed the post-click wait that required Compass' visible category field to update while the dropdown was still open.
- This fixes batch runs getting stuck at `Switching Compass category` even though the target level-1/level-2 options are visibly selected.

## 2026-06-18 - plugin-v3.3.41

- Added an 8-second hard timeout around batch category switching so the panel no longer stays forever at `Switching Compass category`.
- Changed the pre-switch "already on target category" check to read only the visible category field directly instead of running the heavier full category detection path.
- This makes failures surface quickly and prevents category switching from blocking capture/page-turning indefinitely.

## 2026-06-18 - plugin-v3.3.40

- Added a fast-path before category switching: if the visible Compass category field already matches the selected level-2 category or its leaf name, the extension skips reopening the category dropdown.
- Reduced category-switch retry attempts from two rounds to one round after the heavy scroll fallback was removed, preventing long first-category startup waits.
- Kept the rest of capture, pagination, upload, and field extraction logic unchanged.

## 2026-06-18 - web-v1.7.87

- Removed the backend upload rejection that blocked an otherwise complete 10-page capture only because rank 1 was missing.
- Kept the record-count and suspicious-ranking quality gates in place, so incomplete one-page or non-short-video batches are still rejected.
- Bumped the web cache version to `web-v1.7.87` so this backend/web-side rule change is distinguishable during retest.

## 2026-06-18 - plugin-v3.3.39

- Disabled the heavy full-page category scroll fallback during category switching.
- Category selection now only clicks within the visible Compass cascader menus, then fails fast with debug details if the expected level-1 or level-2 option is not present.
- This is a stability-first fix for Compass "page not responding" freezes when the category dropdown is already open.

## 2026-06-18 - plugin-v3.3.38

- Fixed repeated realtime-tab clicks during capture refresh when Compass already shows the realtime state.
- `ensureRealtimeTemplate` now trusts the same active-state detection used elsewhere before deciding to click `实时`.
- Shortened post-tab-switch settle waits from 900ms to 250ms to reduce the first-category pause without changing category selection or pagination rules.

## 2026-06-18 - plugin-v3.3.37

- Optimized extension read/capture speed without changing the restored DOM capture, category selection, pagination, or field mapping logic.
- Shortened conservative waits around category dropdown opening, level-1/level-2 selection, category verification, list refresh, pagination readiness, and pre-capture row stabilization.
- Kept the remaining capture safety gates unchanged so this patch is easy to verify and roll back if a specific environment still needs longer waits.

## 2026-06-18 - plugin-v3.3.36

- Relaxed category-switch validation on the restored `v3.3.20` logic line.
- A Compass category field that shows either the full level-2 path or the level-2 leaf name now counts as a successful switch.
- Removed the second strict post-switch category-name check that could fail even when the Compass category dropdown visibly showed the selected target.

## 2026-06-18 - plugin-v3.3.35

- Removed the upload-blocking rule that rejected captures only because rank 1 was missing.
- Kept the remaining safety checks for empty captures and insufficient record count.

## 2026-06-18 - plugin-v3.3.34

- Restored the extension back to the stable `v3.3.20` logic line using the saved `plugin-v3.3.27` backup as the clean base.
- This removes the later experimental short-video pagination patches from `v3.3.30`-`v3.3.33`.
- The intended capture flow is again DOM page-by-page collection as the main source, with API only used conservatively to backfill missing video publish time.
- Backed up the pre-restore extension as `_archives/dy-monitor-extension-backup-before-restore-3.3.20-line-20260618-052211.zip`.

## 2026-06-18 - plugin-v3.3.33

- Restored robust product-name extraction on the `v3.3.x` line so visible short-video table rows are not filtered out only because the product title is not stored in `a[title]` or title/name CSS classes.
- Added raw-row vs parsed-row diagnostics for page collection, making it clear whether Compass rows were found but parsing failed.
- Manual capture failures now preserve existing page-turn diagnostics instead of replacing them with a generic failed state.

## 2026-06-18 - plugin-v3.3.32

- Removed pagination `scrollIntoView` because it caused the Compass short-video page to be pulled down during capture.
- Fixed forced page-1 collection: when Compass is already on page 1 and rows are visible, the extension now accepts it instead of waiting for row content to change.
- This targets the case where capture appears to start, scrolls the page once, then stops before turning pages.

## 2026-06-18 - plugin-v3.3.31

- Fixed short-video pagination after observing the Compass UI shows `1 2 3 4 5 ... 20`.
- When the target page is hidden behind an ellipsis, the extension now clicks the next-page arrow instead of jumping to the far visible page such as `20`.
- Numeric pagination clicks are limited to the exact target page or the immediate next page, preventing page 5 -> 20 jumps during forced 1-10 collection.

## 2026-06-18 - plugin-v3.3.30

- Kept the plugin on the `v3.3.29` line and patched only short-video DOM pagination.
- Pagination lookup now prefers the visible ranking table's nearest lower pagination container instead of picking a global page control that works on the total ranking page but can be wrong on the short-video ranking page.
- Pagination clicks now scroll the target into view and prefer the real `a/button` node before falling back to the surrounding `li`.

## 2026-06-18 - plugin-test1.6

- Fixed the likely zero-record cause on visible Compass rows: DOM product-name extraction now falls back to readable text inside the product cell instead of only relying on `a[title]` / title-like class names.
- Added page diagnostics with `rawRows` and parsed row count, so a page can show whether the table rows were found but filtered out during parsing.
- This targets screenshots where page 1 visibly has 10 ranking rows but the plugin reports 0 successful pages.

## 2026-06-18 - plugin-test1.5

- Increased selected-category batch timeout from 90 seconds to 240 seconds because the test flow intentionally performs real 10-page DOM pagination with old-style waits.
- Manual capture failure handling no longer overwrites existing capture diagnostics, so page-turn details remain visible after failures.
- This targets screenshots where the panel showed `0` successful pages even though the Compass page was visibly loaded on page 1.

## 2026-06-18 - plugin-test1.4

- Removed the test-plugin upload blockers for category mismatch, missing rank 1, and insufficient page/count results.
- Kept only the minimum empty-record guard so the extension does not upload a completely empty capture.
- This version is intended for diagnosing whether page turning and field parsing can run through without the earlier safety gates stopping the test.

## 2026-06-18 - plugin-test1.3

- Removed the automatic post-level-2 `全部` click from the test plugin main category-switch path.
- Reason: the current requirement is to select and verify only the level-2 category; clicking a later `全部` option can change the Compass filter scope or trigger an extra refresh.
- Kept the helper function in the file for diagnostics/fallback, but it is no longer used by default.

## 2026-06-18 - plugin-test1.2

- Adjusted test-plugin diagnostics so incomplete captures return page-turn details to the panel before upload blocking.
- Moved category mismatch validation before rank/count validation in the panel, so failures report the real first blocker instead of a later generic count/rank message.
- Removed the early content-script missing-rank throw for test flow; upload is still blocked by panel validation when rank 1 or enough pages are missing.

## 2026-06-18 - plugin-test1.1

- Created a test plugin line based on the old `dy-monitor-完整版(2).zip` category and pagination behavior while keeping the current upload, field parsing, and video timestamp backfill.
- Category switching now again attempts the old completion step: after level-2 selection, click the last visible `全部` item if Compass leaves the cascader panel open.
- DOM collection now uses an old-style pagination driver: force page 1, then page 2-10 by re-reading the pagination container each turn and clicking the target page number or next page button.
- Version is intentionally changed to `plugin-test1.1` / manifest `1.1.0` so this can be tested separately from the `3.3.x` line.

## 2026-06-18 - plugin-v3.3.29

- Fixed DOM page collection so it no longer skips pagination clicks just because the active page is detected as the target page.
- `collectViaDomPages` now force-clicks page 1 first and force-clicks every target page during the 1-10 loop.
- `waitForDomPage` now supports a forced-click mode that expects row content to change, reducing false success when Compass keeps reporting the active page as `1`.
- Video timestamp backfill remains unchanged.

## 2026-06-18 - plugin-v3.3.28

- Restored the plugin from the `plugin-v3.3.27` backup, then patched DOM pagination using the old `dy-monitor-完整版(2).zip` approach.
- `goToDomPage` now keeps a `lastKnownPage` fallback so Compass can continue page 1 -> 10 even when the active pagination class is not reliably detected after Vue rebuilds the pagination DOM.
- The pagination loop still refreshes the pagination container every turn and prefers the next visible numeric page before falling back to the next-page button.

## 2026-06-18 - plugin rollback to v3.2.108

- Backed up the current `plugin-v3.3.27` extension as `_archives/dy-monitor-extension-backup-plugin-v3.3.27-20260618-041907.zip`.
- Restored `dy-monitor-extension` from the known server upload package `_archives/dy-monitor-server-deploy-plugin-v3.2.108-web-v1.7.76-20260618-010216.zip`.
- Current loaded extension files now report `plugin-v3.2.108` / manifest `3.2.108`.

## 2026-06-18 - plugin-v3.3.27

- Re-read the server upload package `_archives/dy-monitor-server-deploy-plugin-v3.2.108-web-v1.7.76-20260618-010216.zip` and restored its safer category-switch behavior.
- If Compass is already on the selected level-2 category, the extension now starts capture directly instead of reopening the category cascader.
- Removed the extra post-level-2 `全部` click from the main switch path because it was not part of the known usable server package plugin flow.
- Kept the newer upload safety gates for mismatched category and missing rank 1.

## 2026-06-18 - plugin-v3.3.26

- Referenced the old successful cascader flow again: after clicking the target level-2 category, the extension now clicks the last visible `全部` option if Compass leaves the cascader panel open.
- Kept the `plugin-v3.3.0` lineage behavior of opening the Compass cascader and selecting the target category directly, while preserving category mismatch and missing rank-1 safety gates.
- This targets the case where the UI appears to select a category but Compass does not actually apply the level-2 category before capture.

## 2026-06-18 - plugin-v3.3.25

- Re-synced the category-switch main path with the `plugin-v3.3.0` lineage (`plugin-v3.2.100`/nearby snapshot behavior).
- Removed the newer "visible page already shows target" skip path from batch category switching, so selected categories always reopen the Compass cascader and click the target category.
- Restored the broader current-text category picker lookup from the stable snapshot and the more conservative waits used around cascader rendering.
- Kept the newer upload safety gates: mismatched category and missing rank 1 captures are still blocked.

## 2026-06-18 - plugin-v3.3.24

- Shortened category-switch waits after confirming Compass renders cascader columns quickly.
- Open-picker wait is reduced to 300ms, level-1-to-level-2 wait to 500ms, level-2-to-final-column wait to 400ms, and final `全部` retry waits to 250ms.
- Kept the old-plugin final `全部` click behavior and the category/rank upload safety gates unchanged.

## 2026-06-18 - plugin-v3.3.23

- Synced the old successful category-switch behavior from `dy-monitor-完整版(2).zip`.
- After clicking level-1 and level-2 categories, the extension now also clicks the last visible `全部` item in the cascader when present, matching the old plugin's completion step.
- Increased short waits around category column switching so Compass has time to render the next cascader column before capture starts.

## 2026-06-18 - plugin-v3.3.22

- Fixed category auto-switch false positives where a page like `玩具乐器/乐器及配件` could be treated as matching `玩具乐器/玩具` just because both words were visible near the top.
- Category visible-page checks now require a matched standard level-2 category path, not separate loose level-1 and level-2 text hits.
- Tightened category picker detection to prefer the field beside the `行业类目` label, reducing the chance of clicking category text inside table rows.

## 2026-06-18 - plugin-v3.3.21 + web-v1.7.86

- Added a final extension-side category consistency gate before capture/upload: selected target category must match the actual Compass page category.
- Added extension and backend guards that reject 10-page captures missing rank 1, preventing bad batches that start from rank 2.
- Improved range-change direction parsing for money/count units such as `¥`, `元`, `千`, `万`, `w`, `k`, and comma-formatted numbers.
- Updated range-change display to show compact `前` and `后` labels for clearer batch comparison.

## 2026-06-18 - web-v1.7.85

- Fixed ranking detail display when the newest stored batch starts from rank 2 because rank 1 was not captured.
- Backend trusted-batch selection now requires a rank-1 record before treating a batch as the latest visible ranking batch.
- Existing bad batches are not deleted; the dashboard falls back to the most recent complete trusted batch for display.

## 2026-06-18 - web-v1.7.84

- Compressed the ranking table row spacing and thumbnail sizes so the list is denser.
- Limited the short-video preview column to five videos per row for easier scanning.
- Reworked range-change badges into clearer previous-to-current blocks with directional arrows.
- Removed the generic `排名变化` status tag from display so only specific labels such as `排名上升`, `排名下降`, and `首次上榜` remain.

## 2026-06-18 - web-v1.7.83

- Added the first SQLite backend storage layer at `apps/server/data/dy-monitor.db`.
- Existing `store.json` data now migrates into SQLite automatically while preserving the old JSON file as a backup source.
- The backend still exposes the same store shape to existing services, so plugin and dashboard APIs do not need a large rewrite before server upload.
- Tencent Cloud Windows deployment should upload `apps/server/data/dy-monitor.db` together with the project and run Node 24+ so `node:sqlite` is available.

## 2026-06-18 - plugin-v3.3.20

- Kept DOM page-by-page capture as the main source, but added a conservative API video-time backfill after DOM capture.
- The backfill only fills missing `videoPublishedAt` values and does not overwrite DOM product images, video covers, or metric ranges.

## 2026-06-18 - web-v1.7.82

- Removed the standalone brand icon from the top-left header.

## 2026-06-18 - web-v1.7.81

- Added ranking-table pagination with 50 rows per page and page controls below the table.
- The page resets to page 1 when category, filter mode, or refresh batch changes.

## 2026-06-18 - web-v1.7.80

- Softened the top-right account area so the user text and logout button no longer visually overpower the header.

## 2026-06-18 - web-v1.7.79

- Removed the hero subtitle under `抖音商品 TOP100`.

## 2026-06-18 - web-v1.7.78

- Added structural Compass-style visual elements from the provided references: a Douyin-like brand mark, a hero data/video illustration, and a soft growth illustration in the sidebar.
- This is a layout/visual enhancement, not just a color change.

## 2026-06-18 - web-v1.7.77

- Changed the ranking hero title from `抖音商品 TOP200` to `抖音商品 TOP100`.

## 2026-06-18 - plugin-v3.3.19

- Confirmed `立即执行一轮` must always run the standard full-category queue from the first category, not from the currently visible Compass category.
- Removed the unused queue-start helper that was briefly added in the wrong direction before it was wired into any capture entry.

## 2026-06-18 - plugin-v3.3.18

- Fixed the first selected category in batch capture by ensuring the short-video ranking tab and realtime tab are ready before the extension decides that the current page already matches the target category.
- Added a lightweight visible-table stabilization wait before DOM page collection so the first category does not start capturing while Compass is still refreshing.
- Version naming now rolls the patch number every 100 versions, so `plugin-v3.2.118` is displayed as `plugin-v3.3.18`.

## 2026-06-18 - plugin-v3.2.117

- Fixed the skip-switch path so a page that already shows the selected category uploads under the selected target category instead of any stale detected category.
- Expanded the extension failed-category log to include the failure reason plus the latest stage/page diagnostics, making selected-category batch failures traceable after the run.

## 2026-06-18 - plugin-v3.2.116

- Added a direct visible-page category check before switching categories.
- If the top filter area already shows both the target level-1 and level-2 category names, the extension skips cascader switching and starts capture.
- This handles refresh cases where complex category detection misses the current Compass filter even though the page is already on the target category.

## 2026-06-18 - plugin-v3.2.115

- Fixed refresh-sensitive batch capture state.
- Category switching now reloads the Compass category tree after page refresh when runtime memory is empty.
- DOM capture now keeps the batch target category as the upload category, using page-detected category only as a fallback.
- This prevents page-refresh category detection timing from overwriting the intended batch category.

## 2026-06-18 - plugin-v3.2.114

- Added a hard 90-second timeout per category in batch capture so one stuck category cannot freeze the whole run.
- If the Compass category field already matches the target category, switching is skipped and capture starts directly.
- Reduced category-switch fixed waits and scroll-search retries by borrowing the old plugin's more direct click-and-scan style.
- Kept full DOM page capture intact while improving category switch responsiveness.

## 2026-06-18 - plugin-v3.2.113

- Fixed the DOM page-turn result handling after `goToDomPage` began returning detailed diagnostics.
- Pagination failure objects are no longer treated as successful page turns, preventing repeated page-1 reads.
- Pagination container detection now excludes the extension panel and prefers containers with numeric page buttons.
- Added page-turn diagnostics to the panel debug output: before/after page, clicked element, visible page numbers, and table-signature changes.

## 2026-06-18 - plugin-v3.2.112

- Combined the old plugin's faster pagination idea with the current full-field DOM capture.
- Page turns now succeed when either the active page number changes or the visible table content changes.
- Reduced fixed waits during pagination and replaced them with faster polling, while still reading each visible page.
- Avoided a duplicate page-1 navigation call in required DOM-page capture.

## 2026-06-18 - plugin-v3.2.111

- Reworked DOM pagination to follow the old plugin's proven page-turning approach.
- The extension now re-detects the pagination container each turn, prefers the next visible numeric page after the current page, and falls back to the next button.
- Required DOM-page capture now first forces navigation back to page 1 before reading pages 1-10.

## 2026-06-18 - plugin-v3.2.110

- Changed capture to direct required DOM pagination from page 1 to page 10.
- The extension no longer uses API pagination rows as the main capture result for short-video ranking.
- Each page is opened in Compass and the visible table rows are extracted directly, so product images, video covers, and range fields come from the page itself.
- Capture diagnostics now marks this path as `dom-pages`.

## 2026-06-18 - plugin-v3.2.109

- Changed short-video capture back to required page-by-page DOM pagination after API pagination succeeds.
- Reason: API fast pagination can collect enough rows, but page 2+ often misses product images, video covers, and range fields.
- The extension now visits each target page and merges visible Compass table fields back into API records.
- Capture diagnostics now marks this path as `api-dom-pages`.

## 2026-06-18 - plugin-v3.2.108

- Added an extension-side auto capture switch for unattended collection.
- When enabled, the Compass page runs one full-category capture every 2 hours using the existing batch-category flow.
- Added a manual "run one auto round now" button, persistent next-run state, and skip/delay protection when a capture is already running.
- Updated the extension dashboard link to `http://localhost:4318` for the single-server deployment mode.
- Added Windows guardian scripts to check backend health every 5 minutes, restart the backend when needed, and reopen Edge/Compass if Edge is closed.
- The guardian intentionally does not clear cookies or browser login state.

## 2026-06-18 - web-v1.7.76

- Prepared Windows single-server deployment for backend and web.
- The backend now serves the built web dashboard from `apps/web/dist`, so production can run through one `4318` port.
- The web dashboard now defaults API calls to same-origin `/api`, while `VITE_API_BASE_URL` can still override it.
- Added `scripts/build-production.ps1`, `scripts/start-server.ps1`, and `apps/server/.env.production.example` for server setup.

## 2026-06-17 - plugin-v3.2.107 + web-v1.7.75

- Added a DOM backfill fallback for API captures: when page 2+ rows are missing product images, video covers, payment ranges, click ranges, or order ranges, the extension automatically visits the visible ranking pages and merges the table fields back into the API result.
- Kept the fast API path as the first step; the slower page-by-page DOM backfill only runs when field completeness is poor.
- Added backend display backfill from historical records for the same product/video when current rows have empty media or range fields.

## 2026-06-17 - plugin-v3.2.106

- Fixed the likely cause of page 2+ rows missing product images, video covers, and metric ranges.
- API pagination now evaluates all request variants for a page and picks the non-duplicate result with the richest fields instead of accepting the first list-shaped response.
- Expanded API extraction aliases for product images, video covers, and payment/click/order range fields; per-page debug now includes a `qualityScore` for follow-up diagnosis.

## 2026-06-17 - web-v1.7.74

- Fixed dashboard category ordering so `/api/categories` returns standard categories in the Douyin Compass order instead of reordering by latest capture time.
- Extra non-standard categories, if any, are kept after the standard list and sorted by name.
- Bumped the web version so browser cache can distinguish this category-ordering update.

## 2026-06-17 - plugin-v3.2.105

- Added a persistent extension-side failed-category log for batch collection; it stores only failed category names/ids and displays the recent failed categories at the end of a batch.
- Reduced the fixed settle delay between batch categories from `900ms` to `400ms`.
- Made API-template waiting more responsive by polling every `120ms` instead of `250ms`, so capture proceeds sooner once the Compass ranking request is caught while keeping the same maximum wait window.

## 2026-06-17 - plugin-v3.2.104

- Restored the baseline capture behavior from archived `plugin-v3.2.81` after successful category switching.
- Category switching still clears stale API candidates before opening the Compass cascader, but no longer clears the fresh API request emitted by the successful category click.
- Capture wait timing was restored closer to the baseline (`2600ms + 1600ms`) to reduce slow second-category collection and avoid DOM-only 10-row fallback when realtime is already selected.

## 2026-06-17 - plugin-v3.2.103

- After a successful simulated category switch, the extension now actively triggers the real-time Compass refresh and waits longer for the ranking API template.
- Current-category capture also waits longer for the real API after refresh before falling back to visible DOM rows.
- This targets the newly unblocked case where category switching succeeds but capture only sees the first visible page and fails the 10-page safety gate.

## 2026-06-17 - plugin-v3.2.102

- Category switching now follows the old plugin more closely by selecting from visible `.ecom-cascader-picker` elements after `短视频榜 + 实时` are ready.
- The picker selector no longer depends on broad label/position guessing for the primary click path.
- Switch diagnostics now include visible cascader picker count/texts and opened menu column texts, so failures reveal whether the wrong picker was opened or the menu did not render.

## 2026-06-17 - plugin-v3.2.101

- Batch category switching now also ensures the right-side `实时` data scope is selected before opening the category cascader.
- Top filter button matching now prefers smaller button-like elements, reducing the chance of clicking a parent container instead of the actual `实时` button.
- This targets failures where the page is on `短视频榜` but still not on real-time data before capture.

## 2026-06-17 - plugin-v3.2.100

- Batch category switching now ensures the Compass page is on the `短视频榜` tab before opening the industry category cascader.
- This addresses the case where old cascader clicking works on `总榜` but the intended collection target is `短视频榜`.
- Category field lookup now waits briefly after tab switching so the short-video ranking filters can re-render before clicking.

## 2026-06-17 - plugin-v3.2.99

- Reused the old plugin's proven Compass cascader click strategy for category switching.
- The extension now opens `.ecom-cascader-picker`, then clicks level 1 and level 2 category items by exact `title` / menu-column matching before falling back to generic text search.
- This removes the API category mutation path from the batch switching flow and focuses on real simulated clicks plus field recognition.

## 2026-06-17 - plugin-v3.2.98

- Simplified category switching around real simulated clicks in the Compass category dropdown.
- After clicking first-level and second-level category text, the extension now waits for the Compass category field text to show the target category before capture.
- After the field is recognized, API candidates are reset and the extension waits for Compass to emit the real ranking API instead of mutating category IDs.

## 2026-06-17 - plugin-v3.2.97

- Reverted batch collection direction from direct category-ID API mutation back to real Compass category switching before capture.
- Batch capture now switches the Compass UI category first, waits for Compass to fire the real ranking API, then uses the existing current-category capture/upload path.
- Fixed a switch success bug where `switchToCategoryOnce` referenced an out-of-scope `category` variable.
- Added switch failure diagnostics showing the switch stage and visible category options when first/second-level category text cannot be found.

## 2026-06-17 - plugin-v3.2.96

- Added compact diagnostics for failed API category override captures.
- The panel now shows resolved first/second category IDs and up to four category-related fields found in the captured Compass API template.
- This is intended to identify the exact request field that still prevents selected-category API batch capture from returning pages.

## 2026-06-17 - plugin-v3.2.95

- Batch API category override now resolves the selected category path from the Compass category tree.
- Request mutation can fill first-level fields with the first category ID and second/leaf/category fields with the selected second-level category ID.
- This targets failures where Compass keeps the current first-level category in the request while only the second-level category was replaced.

## 2026-06-17 - plugin-v3.2.94

- Compacted the extension panel UI so it blocks less of the Compass ranking table.
- Reduced panel width, padding, button height, category list height, progress bar height, and diagnostics height.
- Category rows and first-level headers are now denser for batch selection.

## 2026-06-17 - plugin-v3.2.93

- Strengthened API category override for batch capture.
- Category replacement now handles array-style fields such as `categoryIds`, `cateIds`, `industryIds`, `secondCateIds`, and JSON-encoded URL parameters.
- Filter-object forms like `{ field: "categoryId", values: [...] }` are also rewritten to the selected category ID.
- Failed API batch attempts now store diagnostics before throwing, so the panel can show whether any request strategy/page succeeded.

## 2026-06-17 - plugin-v3.2.92

- Hid the old category click/switch self-check buttons from the extension panel because batch collection no longer uses Compass UI switching.
- Batch capture now clears stale category-switch diagnostics before starting and shows that it uses selected category IDs through the ranking API path.
- This prevents old `切换自检失败` messages from being mistaken for the new API-based batch capture result.

## 2026-06-17 - plugin-v3.2.91

- Changed batch category capture to use the captured short-video ranking API template with selected category ID overrides.
- Batch selected/all-category capture no longer depends on Compass category dropdown UI switching, fixed screen coordinates, browser zoom, or the operator's current window layout.
- Manual current-page capture remains on the original current-category path; the new API category override path is only used for batch category collection.

## 2026-06-17 - plugin-v3.2.90

- Added a second extension self-check button to test switching to the first selected category.
- The switch self-check does not collect or upload data; it reports target category, before/after detected category, and failure reason.
- This isolates whether automatic full-category capture is failing at first-level selection, second-level selection, or final category validation.

## 2026-06-17 - plugin-v3.2.89

- Added an extension panel self-check button for cross-device category click reliability.
- The self-check locates the visible Compass `行业类目` dropdown, highlights it, attempts a real event-chain click, and verifies whether category options opened.
- This does not collect or upload data; it is a prerequisite diagnostic before relying on automatic full-category switching across different operator computers.

## 2026-06-17 - plugin-v3.2.88

- Changed automatic category switching to target only the first two category levels.
- Third-level Compass category columns are ignored during switching and validation.
- Synthetic clicks now include pointer and mouse event chains with element-center coordinates to better trigger Compass React controls.

## 2026-06-17 - plugin-v3.2.87

- Improved batch category switching when the target first-level category is outside the visible Compass dropdown area.
- The extension now scrolls visible Compass category popup containers while searching for first-level and second-level category options.
- This targets failures such as being on `图书教育` and not finding `玩具乐器` because it is above the current popup scroll position.

## 2026-06-17 - plugin-v3.2.86

- Fixed batch category switching accidentally matching category text inside the extension panel.
- Automatic category switching now excludes `#dy-monitor-root` when searching for category options or popup controls.
- This prevents the batch queue from only collecting the first category while subsequent category switches click the plugin UI instead of the Compass UI.

## 2026-06-17 - plugin-v3.2.85

- Improved automatic Compass category switching for batch capture.
- After clicking a second-level category, the extension now tries visible confirm/apply/search buttons before validation.
- Category validation waits longer, retries the full switch flow once, and failure messages now include the target and actual detected category.

## 2026-06-17 - plugin-v3.2.84

- Changed the extension batch category picker to an accordion-style list.
- First-level categories stay visible; second-level categories only appear after clicking a first-level category.
- Previously selected second-level categories remain selected when expanding or collapsing first-level groups.

## 2026-06-17 - plugin-v3.2.83

- Changed the extension batch category selector into a collapsed dropdown-style picker.
- Capture page count is now fixed to 10 and the page count input is hidden in the panel.
- Improved category switching wait/verification for batch capture so the plugin waits longer for first-level and second-level category selection before validating.

## 2026-06-17 - plugin-v3.2.82

- Added the first version of batch category capture in the extension panel.
- The panel now lists all standard second-level categories with checkboxes; no categories are selected by default.
- Operators can manually choose any number of categories to capture, or click `全选并采集` to run the full-category queue.
- Batch capture runs as a sequential queue with stop support, per-category progress, and failure isolation.

## 2026-06-17 - baseline archive before large changes

- Created baseline archive: `_archives/dy-monitor-baseline-web-v1.7.73-plugin-v3.2.81-20260617-173857.zip`.
- Baseline versions: `web-v1.7.73`, `plugin-v3.2.81`, extension manifest `3.2.81`.
- Baseline note: category cascader can switch first-level categories and select second-level categories before the next large refactor.

## 2026-06-17 - web-v1.7.73

- Fixed the category cascader so browsing another first-level category no longer gets reset back to the previously selected category while the panel is open.
- Opening the selector still starts from the current category, but users can now switch to other categories inside the panel normally.

## 2026-06-17 - web-v1.7.72

- Fixed the category cascader being forced back to the currently selected category while users browse the left column.
- Opening the selector still starts from the current category, but clicking or hovering another first-level category now keeps the right column on that category.

## 2026-06-17 - web-v1.7.71

- Reduced the category cascader dropdown height so it stays inside the visible browser area on normal dashboard screens.
- Kept both category columns scrollable, so lower categories can be reached without the panel extending below the viewport.

## 2026-06-17 - web-v1.7.70

- Fixed the Compass-like category cascader so the dropdown is no longer clipped by the ranking card.
- Both category columns now have stable scrollable height, allowing lower first-level and second-level categories to be selected.

## 2026-06-17 - plugin-v3.2.81 + web-v1.7.69

- Standard categories are now backed by a shared full two-level category table.
- Ranking category filters on the web are now rendered as a Compass-like two-column cascader instead of a long flat dropdown.
- Plugin category detection now validates and normalizes categories against the standard category table before upload.

## 2026-06-17 - web-v1.7.68

- Hid the ranking page data-quality summary strip above the table.
- Removed the unused `QualityItem` render helper from the ranking page.

## 2026-06-17 - web-v1.7.67

- Changed the `仅变化` ranking filter to show only rows with actual range/detail changes.
- Rows that only have `本次新增` / newcomer status no longer appear in `仅变化`.

## 2026-06-17 - web-v1.7.66

- Fixed the ranking page showing stale/previous-batch data after capture.
- Frontend GET API requests now use `no-store` and `Cache-Control: no-cache`.
- Ranking rows now include a cache-busting refresh parameter in the request URL.
- When `/ranking` opens without a category id, the page now locks to the newest available category and writes it into the URL before displaying rows.

## 2026-06-17 - web-v1.7.65

- Deduped the visible category list by category name while preserving the category with actual data.
- Removed the empty duplicate `玩具乐器/玩具` category `1000003615` from `store.json`.
- `CategoryFilter` text was rewritten back to readable Chinese.
- `auth-service` and `record-service` now both dedupe categories by display name before exposing them to the UI.

## 2026-06-17 - plugin-v3.2.80

- Added multi-key visible-row merge between Compass DOM rows and API rows using product id, product detail URL id, compact product name, and shop name.
- This improves product image and metric range enrichment when Compass truncates product/shop text.
- Relaxed backend suspicious-batch rejection so valid short-video batches are not rejected only because product image/payment/order fields are missing; video-signal quality still protects against obviously wrong payloads.

## 2026-06-17 - plugin-v3.2.79

- Improved capture failure diagnostics when the Compass API template is unstable.
- The extension now tries to parse the current visible page before reporting insufficient API pages, so the error can show how many visible rows were recognized.
- Upload failures caused by `Extension context invalidated` now show a clear Chinese hint: refresh the current Compass page after reloading/updating the extension.
- This version does not relax the 10-page safety gate: a visible one-page fallback still will not be uploaded as a fake 10-page capture.

## 2026-06-17 - web-v1.7.64

- Changed `榜单明细` back to raw Compass ranking-row display: no product-level aggregation in the main table.
- Latest ranking table now preserves duplicate products and original rank rows, so a 10-page capture can display the original 100 rows when the uploaded batch has 100 records.
- Removed the separate `区间跳跃` filter button to avoid overlap with `仅变化`.
- Kept `区间跳跃` as a status tag when payment/click/order range moves upward, so operators still see it inside `仅变化` and `全部商品`.
- Quality strip now follows the raw visible rows for the current batch instead of unique-product rows.

## 2026-06-17 - web-v1.7.63

- Reworked the existing `榜单明细` page in place instead of opening any separate window or adding a new workflow.
- Added `区间跳跃` filter beside `全部商品 / 仅变化 / 首次上榜`.
- Added a data-quality strip showing current batch total rows plus payment/click/order/product-image/video-cover coverage.
- Backend `ranking-rows` now attaches structured `diffItems`, `statusTags`, `isRangeJump`, and per-row `qualitySummary` for frontend rendering.
- Ranking table now includes `区间变化` and `状态标签` columns while keeping product links and video-thumbnail click-through behavior.
- Rewrote `RankingPage.jsx` and `RecordsTable.jsx` visible text back to readable Chinese in the touched workbench area.

## 2026-06-17 - plugin-v3.2.77 + web-v1.7.62

- Fixed range-field pollution where direct Douyin video URLs could be captured into `clickRange` or other metric-range fields.
- Extension range normalization now rejects URL-like strings before checking whether text contains numbers.
- Backend range normalization now drops URL-like strings from payment/click/order/video-count range fields for new uploads.
- Web table rendering now hides URL-like range values defensively instead of stretching the table.
- Cleaned existing `store.json` polluted range fields after backup `apps/server/data/store.backup-before-range-url-clean-20260617134114.json`.
- `plugin-v3.2.78`: narrowed click-range extraction so `play/view/watch` media fields no longer compete with real click metrics. Click range now only matches explicit click/PV-style keys and Chinese `点击` labels.

## 2026-06-17 - backend guard + web-v1.7.61 + plugin-v3.2.76

- `plugin-v3.2.76`: bumped extension version only so operators can distinguish the backend/web recovery build after reloading Edge extension.
- `web-v1.7.61`: bumped dashboard version to force browser-side cache reset while preserving login state.
- Backend now rejects suspicious 10-page captures before writing when the payload looks unlike short-video ranking data, especially batches with about 100 rows but too few video signals or no product image/payment/order evidence.
- Backend trusted reads now apply the same suspicious-quality filter, so old polluted batches are excluded even if they remain on disk.
- Ranking table headers now stay on one line and metric columns have minimum widths to avoid the Compass-like field names being squeezed vertically.

## 2026-06-17 Web UI Update

- `web-v1.7.46`: dashboard visual refresh toward Douyin Compass style. Reworked the web shell with a Compass-like top navigation, product-analysis sidebar, blue hero area, ranking tabs, filter card, and cleaner white data table. Also normalized visible Chinese labels on the main dashboard pages without changing capture/plugin/backend logic.
- `plugin-v3.2.61`: fixed first-capture instability for categories such as `玩具乐器/玩具`. Capture now clears stale API candidates at capture start, actively triggers the current Compass ranking filter to emit a fresh API template, waits longer for the live request, and blocks uploading a fake 10-row DOM fallback when the target is 10 pages.
- `plugin-v3.2.62`: strengthened collection for `支付区间 / 点击区间 / 成交区间`. API rows now detect metric fields by common English keys and Chinese metric labels such as `短视频用户支付金额`, `短视频点击次数`, and `短视频成交件数`; DOM fallback also filters the table header row so it no longer uploads a fake product named `商品`.
- `plugin-v3.2.63`: visible Compass rows now merge payment/click/order ranges into API rows when the product matches. This preserves the visible first-page metric ranges even when the API row field names are missing or delayed.
- `web-v1.7.47`: added a `首次上榜` filter button after `仅变化` in ranking details. It currently uses the same `isNewcomer` source as the green first-list badge so operators can quickly filter those rows.
- `web-v1.7.48`: removed the unused top product navigation (`首页/罗盘/商品/内容/达人/直播/店铺`) and the ranking tab strip (`总榜/搜索榜/直播榜/...`). The ranking page now starts directly from the useful filter card and data table.
- `web-v1.7.49`: changed `榜单类型` and `数据口径` from disabled dropdowns to fixed read-only values (`短视频榜`, `实时数据`) in the ranking filter card.
- `web-v1.7.50`: moved the account/exit entry to the top-right header and removed the duplicate user card from the bottom of the left sidebar. When no user is present, the header shows a `登录入口` link.
- `web-v1.7.51`: refreshed the top-left brand area to a custom `抖音电商·选品罗盘` identity with an `运营` badge and a Douyin-inspired mark while keeping the product subtitle `短视频榜单采集工作台`.
- `plugin-v3.2.64` + server guard: added hard quality gates for incomplete first captures. Uploads are now blocked when a multi-page capture only has one visible page (`<=10` rows) or when a 10-page capture has fewer than `80` rows. The backend also rejects and excludes these incomplete batches from trusted latest data, protecting the dashboard even if an older content script is still running.

## Latest Fix Log

- Milestone `初步跑通`:
  - date: `2026-06-17`
  - plugin: `plugin-v3.2.52`
  - web: `web-v1.7.40`
  - status: current Compass category can be read as Chinese text, 10-page capture can upload about 100 records in the tested flow.
  - known gaps: product image is still missing on the web side; video covers after later pages may be missing; future cover collection should use URL extraction plus server-side async caching instead of one-by-one browser loading.
- `2026-06-17` `plugin-v3.2.51`: category detection was narrowed back to the visible Compass filter row only.
- The extension now prioritizes the text beside the visible `行业类目` label, such as `玩具乐器/玩具`.
- Do not add broad category guessing, API ID guessing, or category-tree expansion before this visible-label read path is verified.
- Panel diagnostics were reduced to the fields needed for this issue: detected category, label node, field node, `positionTexts`, and `fieldTexts`.
- `2026-06-17` `plugin-v3.2.52`: fixed normal Chinese category text being wrongly decoded into strings like `sa9Q77N50V68/sa9Q77`.
- The extension panel diagnostics now show only the category name plus the basic capture result counts.
- `2026-06-17` `plugin-v3.2.53`: experimental media URL enrichment for product images and video covers.
- This version only extracts more image/cover URLs from API payloads; it does not download images or open videos, so it should have low impact on capture speed.
- Panel diagnostics now show product image and video cover coverage counts for quick testing.
- `2026-06-17` `plugin-v3.2.54`: reverted the risky media URL enrichment from `v3.2.53` because it caused product images and video covers to disappear.
- Keep the media URL extractor conservative until the live API payload shape is inspected from a real failed capture.
- `2026-06-17` `plugin-v3.2.55`: low-risk media merge.
- This version merges already-rendered product images and video covers from the visible Compass table into API capture rows for the current visible page only.
- It does not load extra images, open videos, or broaden API media guessing.
- `2026-06-17` `plugin-v3.2.56` + `web-v1.7.41`: product images from `ecom-shop-material` are no longer filtered as shop logos; batch timestamps are formatted as local Chinese time; DOM product image extraction also checks `currentSrc`, lazy-load attributes, and `srcset`.
- `2026-06-17` `web-v1.7.42`: removed the table operation column. Product title now links directly to the captured product URL, and video opening remains on video thumbnails.
- `2026-06-17` `plugin-v3.2.57` + `web-v1.7.43`: product links now use the Compass-compatible format `/ecommerce/trade/detail/index.html?id=...&origin_type=pc_compass_manage` instead of `/views/product/item2?id=...`.
- Web pages also convert old stored `item2?id=` links to the Compass-compatible format at display time.
- `2026-06-17` `web-v1.7.44`: removed the separate left-nav `新增上榜` entry because it overlaps with `榜单明细` filter `仅新增`; sidebar labels were also normalized to readable Chinese.
- `2026-06-17` `plugin-v3.2.58` + `web-v1.7.45`: after upload success, the extension opens/focuses the dashboard at `/ranking?categoryId=...&refresh=...`; the ranking page reads the URL category and refresh marker to show the latest captured category automatically.
- Web cache will be cleared on next load because `APP_VERSION` changed to `web-v1.7.45`; backend capture data was cleared for retest after backup `apps/server/data/store.backup-before-clean-20260616184812.json`.
- `2026-06-17` `plugin-v3.2.59`: when the API template is not ready for the first category and returns 0 successful pages, the extension now falls back to uploading the current visible table rows instead of failing outright.
- `2026-06-17` `plugin-v3.2.60`: startup/capture speed optimization. Capture no longer preloads the full category tree before reading rows, API template wait was reduced from `1500ms` to `600ms`, and panel category render idle timeout was shortened.
- Backend now creates stable category ids from category names when the plugin uploads without a Compass category id, so fast visible-category capture can still be grouped and shown.

## Project Goal

Build a stable internal system for Douyin Compass short-video ranking analysis:

- Edge extension for silent capture on Compass pages
- backend service for upload, storage, diffing, and export
- web dashboard for operators to inspect ranking data in a Compass-like style
- later deploy to Alibaba Cloud

## Confirmed Requirements

### Capture scope

- target page: Douyin Compass / Jinritemai Compass short-video ranking
- capture first `10` pages only
- expected result: about `100` records when each page has `10` rows
- capture must be silent, not visible page-by-page pagination

### Team usage

- about `7-8` operators will use the system
- each operator may work on different categories
- category ownership and filtering must be considered in the dashboard

### Data / operations

- show video publish time directly in the dashboard
- click product to open product link
- click video to preview or open the video
- export ranking data
- keep history snapshots and support newcomer / compare views

### UI direction

- dashboard should feel close to Douyin Compass style
- extension panel and web UI should use Chinese
- plugin should use the live Compass category as the source of truth

## Current Versions

- plugin: `plugin-v3.2.50`
- web: `web-v1.7.40`

## Latest Completed Work

### Extension

- panel/config/silent-capture key text paths were rewritten into encoding-safe versions
- current Compass category is shown in the panel before capture
- silent API pagination now tries multiple page strategies:
  - `page`
  - `page_no`
  - `current`
  - `offset`
- API page signatures are tracked to detect repeated-page responses
- cross-page dedupe that previously caused `98 / 97 / 66` style record loss was removed
- when multi-page API capture does not reach enough pages, upload is now blocked instead of silently falling back to one visible page
- background upload failure text was normalized to Chinese
- plugin-v3.2.20 removes the duplicate category display block from the extension panel
- plugin-v3.2.20 adds staged capture progress feedback in the extension panel
- plugin-v3.2.20 prevents product images from falling back to avatar/logo/video-cover candidates
- plugin-v3.2.21 reads the visible Compass category label directly without expanding or trimming it through the category tree
- plugin-v3.2.21 clears stale API candidates at the start of each capture to reduce second-run slowdown and wrong-candidate reuse
- plugin-v3.2.21 limits video cover extraction to explicit video cover fields and visible short-video thumbnails
- web-v1.7.11 clears stale browser-side cache while preserving login state
- backend category/record/batch cache was cleared after backing up `store.json`

### Backend

- only trusted short-video batches are now used for:
  - ranking rows
  - diffs
  - history
- trusted batch rule:
  - `captureSchemaVersion >= 4`
  - `rankingType === 短视频榜`
- store normalization now repairs:
  - default ranking tabs
  - seed user display names
  - seed category names

### Web

- rewrote key workbench pages back to stable Chinese:
  - `RankingPage`
  - `HistoryPage`
  - `NewcomersPage`
  - `ShiftsPage`
  - `RecordsTable`
  - `VideoModal`
  - `useDashboardData`
- dashboard now shows cleaner data because history/ranking/diff pages no longer mix in non-trusted batches

## Build / Check Status

Passed:

- `node --check dy-monitor-extension/content/silent-capture.js`
- `node --check dy-monitor-extension/background.js`
- `node --check apps/server/src/services/record-service.js`
- `npm.cmd run build:server`
- `npm.cmd run build:web`

## Current Known Remaining Problems

### 1. Real live 10-page verification is still pending

We still need one fresh real capture on the actual short-video ranking page to confirm:

- page strategies now truly reach `10` pages
- newest uploaded batch reaches about `100` rows
- newest batch contains the correct short-video ranking payload rather than another Compass list

### 2. Video field completeness still needs a fresh payload check

We still need one fresh trusted batch to verify whether newest rows truly contain:

- `productUrl`
- `videoUrl`
- `videoPublishedAt`
- `shopName`
- `videos[]`

### 3. Historical bad batches still exist on disk

File:

- `C:\Users\Administrator\OneDrive\文档\lp\apps\server\data\store.json`

Current state:

- trusted views already filter them out
- old bad batches are still physically present
- physical cleanup can be done after one fresh successful live capture

## Important Files To Read First Next Time

### Extension

- `C:\Users\Administrator\OneDrive\文档\lp\dy-monitor-extension\content\silent-capture.js`
- `C:\Users\Administrator\OneDrive\文档\lp\dy-monitor-extension\content\panel.js`
- `C:\Users\Administrator\OneDrive\文档\lp\dy-monitor-extension\content\runtime.js`
- `C:\Users\Administrator\OneDrive\文档\lp\dy-monitor-extension\background.js`
- `C:\Users\Administrator\OneDrive\文档\lp\dy-monitor-extension\manifest.json`

### Backend

- `C:\Users\Administrator\OneDrive\文档\lp\apps\server\src\services\record-service.js`
- `C:\Users\Administrator\OneDrive\文档\lp\apps\server\src\data\store.js`
- `C:\Users\Administrator\OneDrive\文档\lp\apps\server\data\store.json`

### Web

- `C:\Users\Administrator\OneDrive\文档\lp\apps\web\src\pages\RankingPage.jsx`
- `C:\Users\Administrator\OneDrive\文档\lp\apps\web\src\pages\HistoryPage.jsx`
- `C:\Users\Administrator\OneDrive\文档\lp\apps\web\src\pages\NewcomersPage.jsx`
- `C:\Users\Administrator\OneDrive\文档\lp\apps\web\src\pages\ShiftsPage.jsx`
- `C:\Users\Administrator\OneDrive\文档\lp\apps\web\src\components\RecordsTable.jsx`
- `C:\Users\Administrator\OneDrive\文档\lp\apps\web\src\components\VideoModal.jsx`

## Current Local Runtime

- backend health: `http://localhost:4318/api/health`
- web app: `http://localhost:5173`
- extension unpacked path:
  - `C:\Users\Administrator\OneDrive\文档\lp\dy-monitor-extension`

## Recommended Next Steps

1. Reload plugin `plugin-v3.2.15` in `edge://extensions`
2. Refresh the Compass page
3. Run one fresh capture on the real short-video ranking page
4. Confirm whether the panel now either:
   - uploads about `100` rows
   - or clearly stops with a “page count not enough” error
5. If it still stops, inspect the fresh live API request shape and tighten pagination fields again
6. After one fresh successful trusted batch, physically clean historical bad batches from `store.json`

## Operating Rule For Future Turns

Before continuing after a long chat:

1. Read `PROJECT_STATUS.md`
2. Read `TODO.md`
3. Read `DECISIONS.md`
4. Then inspect the current key code files

## Restart Handoff

- latest validated versions before reboot:
  - plugin: `plugin-v3.2.21`
  - web: `web-v1.7.11`
- backend cache cleanup already completed:
  - `categories = 0`
  - `captureBatches = 0`
  - `records = 0`
- backup created before cleanup:
  - `C:\Users\Administrator\OneDrive\文档\lp\apps\server\data\store.backup-20260616-223203.json`
- key behavior changes already implemented:
  - Compass category is now read directly from the visible dropdown text
  - stale API candidates are cleared at the start of each capture
  - video cover extraction is limited to explicit video-cover fields plus visible Compass short-video thumbnails
  - web startup clears stale browser cache while preserving login state
- first things to verify after reboot:
  - reload the Edge extension so it shows `plugin-v3.2.21`
  - refresh the Compass page
  - open the web app once so `web-v1.7.11` clears old browser cache
  - run one fresh capture
  - confirm row count is about `100`
  - confirm uploaded category text exactly matches the visible Compass category
  - confirm video covers are visible in the ranking page
  - confirm the second capture is not much slower than the first
- if video covers are still empty after the first fresh capture:
  - inspect the fresh live API payload shape before changing UI again
## 2026-06-17 - plugin-v3.2.65

- Fixed first-capture pagination request construction for Compass ranking APIs.
- Pagination fields are now updated inside nested JSON request bodies, not only top-level body fields.
- Added support for more common Compass pagination keys: `pageNo`, `pageIndex`, `page_id`, `start`, and related size fields.
## 2026-06-17 - snapshot: current baseline before next changes

- Created archive `_archives/dy-monitor-snapshot-plugin-v3.2.107-web-v1.7.75-20260617-235912.zip`.
- Snapshot versions: plugin `plugin-v3.2.107`, manifest `3.2.107`, web `web-v1.7.75`.
- Purpose: preserve the current state before further collection/category/backend changes.
- Runtime data under `apps/server/data` and heavy/generated folders such as `node_modules`, `dist`, `.git`, and `_archives` were excluded from the archive.

- Kept the incomplete multi-page upload guard unchanged so bad 10-row captures are still blocked.
## 2026-06-17 - plugin-v3.2.66

- Improved first-capture pagination probing to try larger page sizes before falling back to smaller ones.
- The capture flow now prefers the page size that returns the most rows on the first request, then continues with that size.
- Kept the upload guard unchanged so incomplete 10-row batches are still blocked.
## 2026-06-17 - plugin-v3.2.67

- Remembered the last successful Compass API template and added per-category template reuse.
- Capture now prefers a previously successful template for the current category before probing again.
- This is meant to reduce the "first category fails, second try works" pattern without touching the UI.
## 2026-06-17 - plugin-v3.2.68

- Stopgap recovery version after `v3.2.66` and `v3.2.67` made all categories fail.
- Removed the large page-size probing path and remembered-template reuse path.
- Kept the safer nested pagination field support from `v3.2.65` and kept incomplete upload guards.
## 2026-06-17 - plugin-v3.2.69

- Fixed the case where operators manually click `实时` before capture.
- If `实时` is already selected, the extension now briefly switches to `近1天` and then back to `实时` to force Compass to emit a fresh ranking API request.
- 2026-06-18 - plugin-v4.0.0-test17 + web-v1.7.92
  - Fixed short-video metric range fallback extraction after product titles/prices leaked into payment fields.
  - Visible table fallback now accepts compact currency/unit ranges such as `¥0-¥25万` while rejecting long product text.
  - Server range normalization keeps values from `支付金额/点击次数/成交件数 + 区间值` labels and drops long mixed product text.
  - Verified: `node --check` for extension content files, `npm run build:web`, and `npm run build:server`.

- Backend and web dashboard were not changed.
## 2026-06-17 - plugin-v3.2.70

- Corrected the realtime handling from `v3.2.69`.
- If `实时` is already selected by the operator, the extension now starts capture directly and keeps existing captured API candidates instead of clicking or switching time filters.
- If `实时` is not selected, the extension still clicks it to trigger the Compass API request.
## 2026-06-17 - web-v1.7.52

- Fixed range fields displaying as `[object Object]` in the dashboard.
- Backend range normalization now converts object-shaped range values into readable text for new captures.
- Web table rendering also formats old object-shaped range values defensively.
## 2026-06-17 - web-v1.7.53

- Expanded the range-value cleanup to catch `[objectObject]` in addition to `[object Object]`.
- Change-list rendering now replaces both placeholder variants with `-`.
- Backend normalization also treats object placeholder strings as empty range values.
## 2026-06-17 - web-v1.7.54

- Updated the main ranking table headers to mirror the Douyin Compass short-video ranking fields.
- Replaced the main table's `较上次变化` column with a Compass-like `操作` column.
- Product actions now show `查看详情` and `找货源`, while product title linking remains unchanged.
## 2026-06-17 - web-v1.7.55

- Removed the unused `最新视频时间` column from the main ranking table.
- Video publish times remain visible under each video thumbnail.
## 2026-06-17 - web-v1.7.56

- Removed the duplicate `操作` column from the main ranking table.
- Product title remains the entry point for opening the product detail page.
## 2026-06-17 - plugin-v3.2.71 + web-v1.7.57

- `首次上榜` now means the green `首次上榜` label shown by Douyin Compass, not the dashboard's own batch-to-batch newcomer comparison.
- The extension captures the visible Compass first-listed label from the current page rows and merges it into API rows.
- The backend stores `isCompassFirstListed`, and the web `首次上榜` filter now uses that field.
## 2026-06-17 - plugin-v3.2.72

- Added conservative API payload detection for Compass `首次上榜` flags/text.
- Visible DOM labels still take priority when available, and API detection only marks true when the payload explicitly indicates first-listed status.
## 2026-06-17 - web-v1.7.58

- Removed the unused `仅新增` filter from the main ranking page.
- `首次上榜` remains and uses the Compass first-listed label captured from the source page.
## 2026-06-17 - web-v1.7.59

- In `仅变化` mode, the ranking table now displays range columns as `上一批 -> 当前批`.
- Backend ranking rows now include previous payment/click/order ranges for table rendering.
## 2026-06-17 - plugin-v3.2.73

- Fixed payment/click range extraction when Compass text includes the metric label and value together, such as `短视频用户支付金额¥10万-¥25万`.
- Range normalization now removes metric labels and keeps the actual range value instead of dropping the whole field.
- Object-shaped range values with min/max-like keys are also normalized more safely.
## 2026-06-17 - plugin-v3.2.74

- Expanded payment/click metric extraction with more Compass-style aliases such as `pay_amt`, `gmv_amt`, `userPayAmount`, `click_pv`, `pvRange`, `playRange`, and `watchRange`.
- Metric object parsing now also considers min/max/low/high/start/end/level/bucket-style fields.
## 2026-06-17 - plugin-v3.2.75 + web-v1.7.60

- Fixed click range values being incorrectly captured/displayed as `true`.
- Extension range normalization now rejects boolean values and non-numeric/non-range text.
- Backend range normalization also drops `true`/`false` strings for new uploads.
