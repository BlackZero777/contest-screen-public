import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'contest-feed.js');
const FEEDS = [
  { name: '文化部競賽活動', url: 'https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?category=13&method=doFindTypeJ', kind: '競賽' },
  { name: '文化部公開徵選', url: 'https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?category=14&method=doFindTypeJ', kind: '徵選' }
];
// Bing RSS is used only as a discovery clue source; each result still needs official-page verification.
const SEARCH_QUERIES = [
  '台灣 AI 插畫 AI繪圖 比賽 徵件 2026',
  '台灣 海報 視覺設計 漫畫 貼圖 比賽 徵件 2026',
  '台灣 AI 圖轉動畫 短動畫 創作競賽 徵件',
  '台灣 AI 音樂 歌曲 作曲 比賽 徵件 2026',
  '台灣 命名 標語 文案 徵件 比賽 2026',
  '台灣 詩詞 對聯 徵聯 短詩 徵稿 2026',
  'site:bhuntr.com/tw/competitions 插畫 設計 比賽 2026',
  'site:bhuntr.com/tw/competitions AI 音樂 文學 徵件 2026'
];
const RELEVANT = /設計|插畫|繪畫|美術|海報|漫畫|圖像|書法|攝影|動畫|影像|短影音|影片|視覺|藝術|創意|生成式|貼圖|平面|文學|文藝|詩|對聯|徵聯|標語|命名|徵稿|徵文|散文|小說|歌詞|文字|文案|劇本|寫作|音樂|歌曲|作曲|作詞|配樂|聲音|樂曲|徵件|競賽|比賽|徵選|公開徵求|創作|AI|logo/i;
const EXCLUDE = /才藝表演|舞蹈比賽|體育競賽|運動賽|歌唱選秀|合唱比賽|歌唱比賽|歌唱競賽|音樂會|演唱會|徵才|徵人|招聘/i;

function normalizePayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  throw new Error('來源回傳格式不是預期的 JSON 陣列');
}
function searchableText(item) {
  return [item.title, item.titile, item.category, item.showUnit, item.masterUnit,
    item.descriptionFilterHtml, item.comment, item.sourceWebName].flat().join(' ');
}
function hostName(item) {
  return [item.masterUnit, item.showUnit, item.sourceWebName].flat().filter(Boolean).join('、');
}
function normalizeItem(item, kind) {
  return {
    UID: item.UID ?? item.uid ?? '',
    title: item.title ?? '',
    titile: item.titile ?? '',
    category: item.category ?? '',
    showUnit: item.showUnit ?? '',
    masterUnit: item.masterUnit ?? '',
    descriptionFilterHtml: item.descriptionFilterHtml ?? '',
    comment: item.comment ?? '',
    sourceWebName: item.sourceWebName ?? '',
    sourceWebPromote: item.sourceWebPromote ?? '',
    webSales: item.webSales ?? '',
    startDate: item.startDate ?? '',
    endDate: item.endDate ?? '',
    editModifyDate: item.editModifyDate ?? '',
    _kind: kind
  };
}
async function fetchSource(feed) {
  const response = await fetch(feed.url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(feed.name + ' HTTP ' + response.status);
  const payload = await response.json();
  const items = normalizePayload(payload).filter(item => item && typeof item === 'object');
  return items.map(item => normalizeItem(item, feed.kind));
}
function decodeXml(value) {
  return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
}
function xmlValue(block, tag) {
  const match = block.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'i'));
  return match ? decodeXml(match[1]) : '';
}
async function fetchSearchQuery(query, index) {
  const url = 'https://www.bing.com/search?format=rss&q=' + encodeURIComponent(query);
  const response = await fetch(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'ContestScreenWorkbench/2.0 (public contest discovery)' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('Bing RSS HTTP ' + response.status);
  const xml = await response.text();
  if (!/<rss[\\s>]/i.test(xml)) throw new Error('搜尋來源未回傳 RSS');
  const items = [...xml.matchAll(/<item(?:\\s[^>]*)?>([\\s\\S]*?)<\\/item>/gi)].map(match => {
    const block = match[1];
    const title = xmlValue(block, 'title');
    const link = xmlValue(block, 'link');
    const description = xmlValue(block, 'description');
    if (!title || !/^https?:\\/\\//i.test(link)) return null;
    return normalizeItem({
      UID: 'bing:' + link,
      title,
      descriptionFilterHtml: description,
      sourceWebName: 'Bing 網頁搜尋（線索）',
      sourceWebPromote: link,
      comment: '此筆來自公開網頁搜尋摘要，不是主辦方核實資料。請開啟原始頁面確認是否為當年度有效徵件。'
    }, '網路搜尋線索');
  }).filter(Boolean);
  return items;
}
function dedupe(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.UID || ((item.title || item.titile) + '|' + hostName(item));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const outcomes = await Promise.allSettled(FEEDS.map(async feed => ({ feed, items: await fetchSource(feed) })));
const official = outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value.items : []);
if (!official.length) {
  const errors = outcomes.map((outcome, i) => outcome.status === 'rejected' ? FEEDS[i].name + ': ' + String(outcome.reason) : '').filter(Boolean);
  throw new Error('所有官方公開資料來源都失敗，為避免覆蓋舊快取而停止更新。' + errors.join('；'));
}
const searches = await Promise.allSettled(SEARCH_QUERIES.map((query, index) => fetchSearchQuery(query, index)));
const searchItems = searches.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value : []);
const all = [...official, ...searchItems];
const filtered = dedupe(all.filter(item => RELEVANT.test(searchableText(item)) && !EXCLUDE.test(searchableText(item))))
  .sort((a, b) => {
    const aSearch = a._kind === '網路搜尋線索' ? 1 : 0;
    const bSearch = b._kind === '網路搜尋線索' ? 1 : 0;
    return aSearch - bSearch || String(b.editModifyDate || b.startDate || '').localeCompare(String(a.editModifyDate || a.startDate || ''));
  })
  .slice(0, 700);
if (!filtered.length) throw new Error('公開來源讀取成功，但沒有符合篩選條件的活動；為避免清空現有資料，停止更新。');
const payload = {
  generatedAt: new Date().toISOString(),
  sources: [
    ...FEEDS.map(({ name, url }) => ({ name, url, type: 'official_public_data' })),
    { name: 'Bing RSS 公開網頁搜尋', type: 'discovery_clues_only', queryCount: SEARCH_QUERIES.length }
  ],
  totalFetched: all.length,
  officialFetched: official.length,
  searchResultsFetched: searchItems.length,
  searchQueriesSucceeded: searches.filter(outcome => outcome.status === 'fulfilled').length,
  searchQueriesFailed: searches.filter(outcome => outcome.status === 'rejected').length,
  recordCount: filtered.length,
  records: filtered
};
const content = '/* Auto-generated by scripts/sync-contests.mjs. Do not edit manually. */\nwindow.ContestDiscoveryFeed = ' + JSON.stringify(payload, null, 2) + ';\n';
await writeFile(OUTPUT, content, 'utf8');
console.log('Synced ' + official.length + ' official public records and ' + searchItems.length + ' search clues; kept ' + filtered.length + ' candidates. Search queries succeeded: ' + searches.filter(outcome => outcome.status === 'fulfilled').length + '/' + SEARCH_QUERIES.length + '.');
