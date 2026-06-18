# Decisions

## Architecture

- Use a three-part system:
  - browser extension
  - backend service
  - web dashboard

Reason:

- plugin-only approach is too fragile for multi-operator use

## Capture strategy

- Silent capture is required
- Prefer direct API pagination over visible page-by-page pagination
- Current target is first `10` pages only

Reason:

- user explicitly wants silent capture
- each page should correspond to about `10` ranking rows

## Category strategy

- Category ids in the system should align with real Compass category ids

Reason:

- dashboard visibility broke when backend used random internal ids

## Final V1 category-source decision

- Remove category selection from the plugin UI
- Operator selects category directly in Compass
- Extension reads the current Compass category before capture/upload
- If the current Compass category cannot be identified reliably, capture must stop instead of uploading under a guessed category

Reason:

- plugin-side selection and page-side state repeatedly drifted out of sync
- the real page state should be the source of truth
- preventing wrong category uploads is more important than aggressive automation in V1

## Web UI direction

- Dashboard should be closer to Douyin Compass style
- Chinese UI should be preferred

Reason:

- the user explicitly requested a Compass-like style

## Data correctness rule

- Correctness of extracted records is higher priority than adding more features

Reason:

- the data chain is not trustworthy if one page becomes `18` rows or if key fields are empty

## Current V1 data-display decision

- Keep `新增上榜` as a lightweight dedicated page
- Keep `区间变化` page available, while ranking rows also carry diff markers
- Show video publish time directly in the ranking table
- Prefer real video playback; if only a Douyin page URL exists, fall back to opening the Douyin page

Reason:

- operators need one main operational page
- direct time visibility is a core operational requirement
- some live payloads expose page URLs before direct playable URLs

## Multi-page safety decision

- When target capture is more than `1` page, do not silently fall back to a single DOM page upload
- If API capture does not reach enough pages, stop and surface a clear error instead of uploading partial data

Reason:

- partial uploads made operators believe `10` pages had been captured when only `1` page was uploaded
- blocking wrong uploads is safer than showing superficially successful but incorrect data
