import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'contest-feed.js');
const FEEDS = [
  { name: '文化部競賽活動', url: 'https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?category=13&method=doFindTypeJ', kind: '競賽' },
  { name: '文化部公開徵選', url: 'https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?category=14&method=doFindTypeJ', kind: '徵選' }
];
const TARGET_SITES = [
 {name:'獎金獵人',url:'https://bhuntr.com/tw'},
 {name:'點子秀',url:'https://news.idea-show.com/'},
 {name:'中華民國美術設計協會',url:'https://www.gda-tw.org/news/notelist.php'},
 {name:'臺灣藝術教育網',url:'https://ed.arte.gov.tw/'},
 {name:'臺藝大視傳系',url:'https://vcd.ntua.edu.tw/compnews'},
 {name:'文化部獎補助資訊網',url:'https://grants.moc.gov.tw/'}
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
function decodeHtml(v){return String(v||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();}
async function fetchTargetSite(site){
 const res=await fetch(site.url,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 ContestScreenWorkbench/3.0'},signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw new Error('HTTP '+res.status);
 const html=await res.text();
 const anchors=[...html.matchAll(/<a\b([^>]*)href=["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
 const items=anchors.map(m=>{const title=decodeHtml(m[4]);if(title.length<4)return null;let url;try{url=new URL(m[2],site.url).href;}catch{return null;}return normalizeItem({UID:'site:'+url,title,sourceWebName:site.name,sourceWebPromote:url,comment:'直接從指定網站擷取的線索，仍須回原始公告查核。'},'指定網站線索');}).filter(Boolean);
 const kept=dedupe(items.filter(isUsefulSearchClue));
 return {fetched:items.length,items:kept};
}
const STUDENT_ONLY = /(?:僅限|只限|限於|限)\s*(?:全國)?(?:大專院校|大學|研究所|高中職|高中|高職|專科)?\s*(?:在學)?學生(?:參賽|報名|參加)?|學生專屬(?:競賽|比賽|徵件|組)?|限學生(?:參加|報名|參賽)?|在學學生限定|學生限定(?:競賽|比賽|徵件)?/i;
function isUsefulSearchClue(item) {
  if (STUDENT_ONLY.test(searchableText(item))) return false;
  if (item._kind !== '網路搜尋線索') return RELEVANT.test(searchableText(item)) && !EXCLUDE.test(searchableText(item));
  const titleAndDescription = [item.title, item.descriptionFilterHtml].join(' ');
  const title = String(item.title || '');
  const hasTopic = /設計|插畫|繪畫|美術|海報|漫畫|圖像|書法|攝影|動畫|影像|短影音|影片|視覺|藝術|創意|生成式|貼圖|平面|文學|文藝|詩|對聯|徵聯|標語|命名|徵稿|徵文|散文|小說|歌詞|文字|文案|劇本|寫作|音樂|歌曲|作曲|作詞|配樂|聲音|樂曲|AI|logo/i.test(titleAndDescription);
  const hasContestSignal = /競賽|比賽|徵件|徵選|徵稿|徵文|投稿|創作大賽|獎項|參賽|作品募集|公開徵求/i.test(titleAndDescription);
  const obviousNoise = /維基百科|wikipedia|自由行|旅遊攻略|觀光資訊網|總統府|首頁|新聞首頁|天氣預報/i.test(title);
  return hasTopic && hasContestSignal && !obviousNoise && !EXCLUDE.test(titleAndDescription);
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

function cleanTitle(value) {
  return decodeHtml(value).toLowerCase()
    .replace(/[（(](?:歡迎參加|歡迎報名|截止[^）)]*)[）)]/g, '')
    .replace(/[，,、]\s*(?:20\d{2}[年./-]\s*)?\d{1,2}[月./-]\s*\d{1,2}日?截止.*$/i, '')
    .replace(/[，,、]\s*(?:歡迎參加|歡迎報名).*$/i, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}
function contestKey(item) {
  const title = cleanTitle(item.title || item.titile || '');
  const hasEditionYear = /20\d{2}/.test(title);
  const dateYear = String(item.startDate || item.endDate || '').match(/20\d{2}/)?.[0] || '';
  return title + (hasEditionYear ? '' : '|year:' + dateYear);
}
function announcementSnapshot(item, observedAt) {
  const title = decodeHtml(item.title || item.titile || '');
  const description = decodeHtml(item.descriptionFilterHtml || item.comment || '').slice(0, 500);
  const sourceUrl = item.sourceWebPromote || item.webSales || '';
  const sourceName = item.sourceWebName || item.showUnit || item.masterUnit || '來源未提供';
  const fingerprint = [cleanTitle(title), item.startDate || '', item.endDate || '', description].join('|');
  return {sourceName,sourceUrl,title,startDate:item.startDate||'',endDate:item.endDate||'',description,fingerprint,observedAt};
}
function mergeContestRecords(items, previous, observedAt) {
  const previousMap = new Map((previous?.records || []).map(item => [item.recordKey || contestKey(item), item]));
  const groups = new Map();
  for (const item of items) {
    const key = contestKey(item);
    if (!key || key === '|year:') continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const merged = [];
  for (const [key, group] of groups) {
    const primary = group.find(x => x._kind !== '指定網站線索') || group[0];
    const prior = previousMap.get(key);
    const priorHistory = prior?.announcementHistory || [];
    const currentSnapshots = group.map(x => announcementSnapshot(x, observedAt));
    let announcementUpdated = false;
    const nextHistory = [...priorHistory];
    for (const snapshot of currentSnapshots) {
      const sameSource = nextHistory.filter(x => (x.sourceUrl || x.sourceName) === (snapshot.sourceUrl || snapshot.sourceName));
      if (sameSource.length && !sameSource.some(x => x.fingerprint === snapshot.fingerprint)) announcementUpdated = true;
      if (!nextHistory.some(x => x.fingerprint === snapshot.fingerprint && x.sourceUrl === snapshot.sourceUrl && x.sourceName === snapshot.sourceName)) {
        snapshot.version = sameSource.length + 1;
        nextHistory.push(snapshot);
      }
    }
    const sourceLinks = [];
    for (const item of group) {
      const url = item.sourceWebPromote || item.webSales || '';
      const name = item.sourceWebName || item.showUnit || item.masterUnit || '來源未提供';
      if (!sourceLinks.some(x => x.url === url && x.name === name)) sourceLinks.push({name,url});
    }
    merged.push({
      ...primary,
      recordKey:key,
      editionKey:key,
      sourceLinks,
      announcementHistory:nextHistory.slice(-12),
      firstSeenAt:prior?.firstSeenAt || observedAt,
      lastSeenAt:observedAt,
      isNew:!prior,
      announcementUpdated
    });
  }
  return merged;
}

const outcomes = await Promise.allSettled(FEEDS.map(async feed => ({ feed, items: await fetchSource(feed) })));
const official = outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value.items : []);
if (!official.length) {
  const errors = outcomes.map((outcome, i) => outcome.status === 'rejected' ? FEEDS[i].name + ': ' + String(outcome.reason) : '').filter(Boolean);
  throw new Error('所有官方公開資料來源都失敗，為避免覆蓋舊快取而停止更新。' + errors.join('；'));
}
const siteOutcomes=await Promise.allSettled(TARGET_SITES.map(fetchTargetSite));
const siteResults=siteOutcomes.map((o,i)=>({name:TARGET_SITES[i].name,url:TARGET_SITES[i].url,status:o.status==='fulfilled'?'success':'failed',fetched:o.status==='fulfilled'?o.value.fetched:0,kept:o.status==='fulfilled'?o.value.items.length:0,error:o.status==='rejected'?String(o.reason?.message||o.reason):''}));
const siteItems=siteOutcomes.flatMap(o=>o.status==='fulfilled'?o.value.items:[]);
const all = [...official, ...siteItems];
const filtered = dedupe(all.filter(isUsefulSearchClue))
  .sort((a, b) => {
    const aSearch = a._kind === '指定網站線索' ? 1 : 0;
    const bSearch = b._kind === '指定網站線索' ? 1 : 0;
    return aSearch - bSearch || String(b.editModifyDate || b.startDate || '').localeCompare(String(a.editModifyDate || a.startDate || ''));
  });
if (!filtered.length) throw new Error('公開來源讀取成功，但沒有符合篩選條件的活動；為避免清空現有資料，停止更新。');
let previous=null;
try{const oldText=await readFile(OUTPUT,'utf8');const marker='window.ContestDiscoveryFeed = ';const begin=oldText.indexOf(marker);const finish=oldText.lastIndexOf(';');if(begin<0||finish<=begin)throw new Error('舊版資料格式無法辨識，為避免遺失更新紀錄，停止覆寫。');previous=JSON.parse(oldText.slice(begin+marker.length,finish));}catch(error){if(error.code!=='ENOENT')throw error;}
const observedAt=new Date().toISOString();
const mergedRecords=mergeContestRecords(filtered,previous,observedAt)
  .sort((a,b)=>Number(b.isNew)-Number(a.isNew)||Number(b.announcementUpdated)-Number(a.announcementUpdated)||String(b.editModifyDate||b.startDate||'').localeCompare(String(a.editModifyDate||a.startDate||'')))
  .slice(0,700);
const oldKeys=new Set((previous?.records||[]).map(x=>x.recordKey||contestKey(x)));
const added=mergedRecords.filter(x=>!oldKeys.has(x.recordKey)).length;
const updatedAnnouncements=mergedRecords.filter(x=>x.announcementUpdated).length;
const updateEntry={generatedAt:observedAt,added,updatedAnnouncements,total:mergedRecords.length,official:outcomes.map((o,i)=>({name:FEEDS[i].name,status:o.status==='fulfilled'?'success':'failed',fetched:o.status==='fulfilled'?o.value.items.length:0,error:o.status==='rejected'?String(o.reason?.message||o.reason):''})),sites:siteResults};
const syncHistory=[updateEntry,...(previous?.syncHistory||[])].slice(0,3);

const payload = {
  generatedAt: updateEntry.generatedAt,
  syncHistory,
  sources: [
    ...FEEDS.map(({ name, url }) => ({ name, url, type: 'official_public_data' })),    { name: '獎金獵人', url: 'https://bhuntr.com/tw', type: 'targeted_search_clue' },
    { name: '點子秀', url: 'https://news.idea-show.com/', type: 'targeted_search_clue' },
    { name: '中華民國美術設計協會', url: 'https://www.gda-tw.org/news/notelist.php', type: 'targeted_search_clue' },
    { name: '臺灣藝術教育網', url: 'https://ed.arte.gov.tw/', type: 'targeted_search_clue' },
    { name: '臺藝大視傳系', url: 'https://vcd.ntua.edu.tw/compnews', type: 'targeted_search_clue' },
    { name: '文化部獎補助資訊網', url: 'https://grants.moc.gov.tw/', type: 'targeted_search_clue' }
  ],
  totalFetched: all.length,
  officialFetched: official.length,
  targetSites: siteResults,
  recordCount: mergedRecords.length,
  records: mergedRecords
};
const content = '/* Auto-generated by scripts/sync-contests.mjs. Do not edit manually. */\nwindow.ContestDiscoveryFeed = ' + JSON.stringify(payload, null, 2) + ';\n';
await writeFile(OUTPUT, content, 'utf8');
console.log('Synced ' + official.length + ' official records and ' + siteItems.length + ' direct-site clues; kept ' + filtered.length + ' candidates.');
