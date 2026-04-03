/**
 * Core news + economic calendar logic — reads from TradingView's right sidebar widgets via DOM.
 */
import { evaluate } from '../connection.js';

export async function getNews({ symbol, max_items = 20 } = {}) {
  const result = await evaluate(`
    (function() {
      // TradingView stores news in the right sidebar widget
      // Try multiple selectors for different TV Desktop versions
      var items = [];

      // Strategy 1: Look for news items in the right widget panel
      var newsEls = document.querySelectorAll('[class*="headline"], [class*="news-item"], [class*="newsFeed"] [class*="item"], [data-name="news"] [class*="item"]');
      if (newsEls.length === 0) {
        // Strategy 2: Look in any widget area for news-like content
        newsEls = document.querySelectorAll('[class*="widgetbar"] [class*="item"], [class*="widget-"] [class*="title"]');
      }
      if (newsEls.length === 0) {
        // Strategy 3: Try the bottom panel news tab
        newsEls = document.querySelectorAll('[class*="news"] article, [class*="news"] [class*="row"]');
      }

      var maxItems = ${max_items};
      var count = 0;

      for (var i = 0; i < newsEls.length && count < maxItems; i++) {
        var el = newsEls[i];
        var text = (el.textContent || '').trim();
        if (text.length > 10 && text.length < 500) {
          // Try to extract time from a sibling or child element
          var timeEl = el.querySelector('time, [class*="time"], [class*="date"]');
          var time = timeEl ? timeEl.textContent.trim() : null;

          // Try to extract source
          var srcEl = el.querySelector('[class*="source"], [class*="provider"]');
          var source = srcEl ? srcEl.textContent.trim() : null;

          // Clean headline - remove time/source from the text if found
          var headline = text;
          if (time) headline = headline.replace(time, '').trim();
          if (source) headline = headline.replace(source, '').trim();

          items.push({
            headline: headline.substring(0, 200),
            time: time,
            source: source
          });
          count++;
        }
      }

      // Strategy 4: If nothing found via DOM, try TradingView's internal news API
      if (items.length === 0) {
        // Check if news widget is even open
        var rightPanel = document.querySelector('[class*="widgetbar-widget"]');
        var newsTab = document.querySelector('[data-name="news"], [aria-label*="news" i], [class*="newsWidget"]');
        return {
          success: true,
          items: [],
          count: 0,
          hint: rightPanel ? 'Right panel is open but no news items found. Try clicking the News tab.' : 'News panel not open. Click the newspaper icon in the right sidebar to open it.',
          news_tab_found: !!newsTab
        };
      }

      return {
        success: true,
        items: items,
        count: items.length
      };
    })()
  `);

  return result;
}

export async function getHeadlines({ symbol } = {}) {
  // Try to read headlines from TradingView's internal headline ticker / news flow
  const result = await evaluate(`
    (function() {
      var items = [];

      // Look for the headline ticker bar (sometimes at top or bottom of chart)
      var tickerEls = document.querySelectorAll('[class*="headline-"], [class*="ticker-news"], [class*="newsLine"]');
      for (var i = 0; i < tickerEls.length; i++) {
        var text = (tickerEls[i].textContent || '').trim();
        if (text.length > 5) items.push(text.substring(0, 200));
      }

      // Also check for any visible toast/notification with news
      var toasts = document.querySelectorAll('[class*="toast"], [class*="notification"]');
      for (var j = 0; j < toasts.length; j++) {
        var t = (toasts[j].textContent || '').trim();
        if (t.length > 10) items.push(t.substring(0, 200));
      }

      return { success: true, headlines: items, count: items.length };
    })()
  `);

  return result;
}

export async function getEconomicCalendar({ importance, max_items = 30 } = {}) {
  const result = await evaluate(`
    (function() {
      var events = [];
      var maxItems = ${max_items};
      var importanceFilter = ${JSON.stringify(importance || null)};

      // Strategy 1: TradingView economic calendar widget in right sidebar
      // Events typically have time, currency, event name, impact level, actual/forecast/previous
      var calRows = document.querySelectorAll('[class*="economic-calendar"] [class*="row"], [class*="economicCalendar"] [class*="row"], [class*="calendar"] [class*="event"], [data-name="economic-calendar"] [class*="row"]');

      if (calRows.length === 0) {
        // Strategy 2: Broader search for calendar-like table rows
        calRows = document.querySelectorAll('[class*="calendar"] tr, [class*="calendar"] [class*="item"], [class*="econ"] [class*="row"]');
      }

      if (calRows.length === 0) {
        // Strategy 3: Look for the calendar in bottom panel or standalone widget
        calRows = document.querySelectorAll('[class*="widget"] [class*="calendar"] [class*="row"], [class*="widgetbar"] [class*="calendar"] [class*="item"]');
      }

      for (var i = 0; i < calRows.length && events.length < maxItems; i++) {
        var row = calRows[i];
        var text = (row.textContent || '').trim();
        if (text.length < 5) continue;

        // Try to extract structured data from the row
        var timeEl = row.querySelector('time, [class*="time"], [class*="date"]');
        var time = timeEl ? timeEl.textContent.trim() : null;

        // Currency/country
        var currEl = row.querySelector('[class*="currency"], [class*="country"], [class*="flag"]');
        var currency = currEl ? currEl.textContent.trim() || currEl.getAttribute('title') || null : null;

        // Impact/importance (stars, bulls, colored indicators)
        var impactEl = row.querySelector('[class*="impact"], [class*="importance"], [class*="bull"]');
        var impact = null;
        if (impactEl) {
          // Count stars or bull icons
          var stars = impactEl.querySelectorAll('[class*="star"], [class*="bull"], svg, i');
          impact = stars.length > 0 ? stars.length : (impactEl.textContent || '').trim();
          // Also check for color-based importance
          var cls = impactEl.className || '';
          if (cls.match(/high|red|3/i)) impact = 'high';
          else if (cls.match(/medium|orange|2/i)) impact = 'medium';
          else if (cls.match(/low|yellow|1/i)) impact = 'low';
        }

        // Actual / Forecast / Previous values
        var vals = row.querySelectorAll('[class*="actual"], [class*="forecast"], [class*="previous"], [class*="value"]');
        var actual = null, forecast = null, previous = null;
        if (vals.length >= 3) {
          actual = vals[0].textContent.trim() || null;
          forecast = vals[1].textContent.trim() || null;
          previous = vals[2].textContent.trim() || null;
        } else if (vals.length > 0) {
          // Just grab whatever values exist
          for (var v = 0; v < vals.length; v++) {
            var valText = vals[v].textContent.trim();
            var valClass = (vals[v].className || '').toLowerCase();
            if (valClass.includes('actual')) actual = valText;
            else if (valClass.includes('forecast')) forecast = valText;
            else if (valClass.includes('previous')) previous = valText;
          }
        }

        // Event name — the remaining text after removing time/currency/values
        var eventName = text;
        if (time) eventName = eventName.replace(time, '');
        if (currency) eventName = eventName.replace(currency, '');
        if (actual) eventName = eventName.replace(actual, '');
        if (forecast) eventName = eventName.replace(forecast, '');
        if (previous) eventName = eventName.replace(previous, '');
        eventName = eventName.replace(/\\s+/g, ' ').trim();

        // Apply importance filter if specified
        if (importanceFilter) {
          if (importanceFilter === 'high' && impact !== 'high' && impact < 3) continue;
          if (importanceFilter === 'medium' && impact === 'low') continue;
        }

        events.push({
          event: eventName.substring(0, 150),
          time: time,
          currency: currency,
          impact: impact,
          actual: actual,
          forecast: forecast,
          previous: previous
        });
      }

      if (events.length === 0) {
        var rightPanel = document.querySelector('[class*="widgetbar-widget"]');
        var calTab = document.querySelector('[data-name="economic-calendar"], [aria-label*="calendar" i], [class*="calendarWidget"]');
        return {
          success: true,
          events: [],
          count: 0,
          hint: rightPanel
            ? 'Right panel is open but no calendar events found. Try clicking the Economic Calendar tab.'
            : 'Economic calendar not open. Click the calendar icon in the right sidebar to open it.',
          calendar_tab_found: !!calTab
        };
      }

      return {
        success: true,
        events: events,
        count: events.length
      };
    })()
  `);

  return result;
}
