import { z } from 'zod';
import { jsonResult } from './_format.js';
import * as core from '../core/news.js';

export function registerNewsTools(server) {
  server.tool('news_get', 'Read news headlines from TradingView news feed for the current symbol. Requires the News panel to be open in the right sidebar.', {
    symbol: z.string().optional().describe('Symbol to get news for (default: current chart symbol)'),
    max_items: z.coerce.number().optional().describe('Maximum headlines to return (default 20)'),
  }, async ({ symbol, max_items }) => {
    try { return jsonResult(await core.getNews({ symbol, max_items })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('news_headlines', 'Read headline ticker / breaking news notifications visible on the chart', {}, async () => {
    try { return jsonResult(await core.getHeadlines()); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('calendar_get', 'Read economic calendar events from TradingView (NFP, CPI, FOMC, etc.). Requires the Economic Calendar panel to be open in the right sidebar.', {
    importance: z.enum(['high', 'medium', 'low']).optional().describe('Filter by importance level (high = red/3-bull events only)'),
    max_items: z.coerce.number().optional().describe('Maximum events to return (default 30)'),
  }, async ({ importance, max_items }) => {
    try { return jsonResult(await core.getEconomicCalendar({ importance, max_items })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });
}
