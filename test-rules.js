const assert=require('node:assert/strict');const R=require('./rules.js');
const cases=[
['single image animation','使用 AI 生成單張主圖，再使用 AI 圖轉短動畫','設計／創意','AI單圖＋短動畫延伸','納入候選'],
['full video','劇本、分鏡、多鏡頭真人拍攝並剪輯影片','設計／創意','完整影片／多鏡頭影音（另行評估）','另行評估'],
['hand draw','插畫僅限手繪，不得使用數位工具','視覺設計','視覺傳達／平面圖像','跳過'],
['product design alone','產品設計須提出結構、材料工法、打樣及量產成本','設計／創意','產品／實品設計（需核對各階段要求）','需核實實體交件／產品要求；暫不整場排除'],
['text','徵求 12 字內活動標語','文字／文學','低投入文字','文字類候選，待核對規格'],
['AI music','AI歌曲徵件，需使用指定工具、外部音檔及公開發行','AI音樂','AI音樂／歌曲','設計類候選，待核對規格'],
['fee unknown','AI插畫徵件，截止日期 2026 年 11 月 16 日','視覺設計','視覺傳達／平面圖像','設計類候選，待核對規格'],
['popular main prize','主獎人氣投票比重 50%，依票數決定','設計／創意','作品形式待確認','跳過'],
['independent popularity','評審決選，另設獨立人氣獎，不影響主獎','設計／創意','作品形式待確認','設計類候選，待核對規格']
];
for(const [n,t,c,f,d] of cases){const r=R.assess(t);assert.equal(r.category,c,n+' category');assert.equal(r.workFormat,f,n+' format');assert.equal(r.decision,d,n+' decision');}
assert.equal(R.aiPolicy('禁止使用 AI 生成主畫面').level,'no-main');
assert.equal(R.aiPolicy('AI 僅限輔助，不可直接生成作品').level,'assist');
assert.equal(R.aiPolicy('本競賽禁止使用 AI 工具').level,'no-ai');
assert.match(R.assess('AI插畫徵件，截止日期 2026 年 11 月 16 日').checks['費用'],/不等於免費/);
assert.match(R.assess('AI歌曲徵件').warnings.join(' '),/指定工具/);
assert.equal(R.aiPolicy('AI 僅限輔助，但本競賽禁止使用 AI 工具').level,'no-ai');
assert.equal(R.aiPolicy('AI 僅限輔助，禁止使用 AI 生成主圖').level,'no-main');
assert.equal(R.aiPolicy('禁止使用 AI 生成主圖，且不得使用 AI 工具').level,'no-ai');
// Regression: multi-group sustainable design contest; do not apply product-group constraints to all.
const example='2026-2027 環境關懷友善設計競賽。概念設計組：鼓勵具創新創意且具未來實踐可行性的設計提案。產品設計組：以可實際使用與運作，且預計上市或已上市的作品為主。徵件類型包含工業／產品設計、建築／空間設計、包裝設計、機電工程設計、環境教育、視覺傳達設計、數位媒體設計、服務設計及相關技術應用與政策。初審交件：設計圖面與設計說明，製作 A2 橫式看板，最多 3 張。概念設計組進入決審後，須製作模型／原型，提交設計特點說明影片 90–150 秒，並親赴現場簡報。';
const c=R.assess(example);
assert.equal(c.category,'永續創意設計／環境議題提案','sustainable contest main category');
assert.equal(c.workFormat,'概念設計／數位提案','concept proposal work form');
assert.equal(c.decision,'初審可行／決審有實體交件或高投入風險','never exclude entire contest from prototype keyword');
assert.equal(c.feasibility,'初審可行；決審有實體交件或高投入風險');
assert.equal(c.groupAssessment.multiGroup,true);
assert.match(c.checks['初審交件'],/A2/);
assert.match(c.checks['決審交件'],/模型／原型/);
assert.match(c.checks['決審交件負擔'],/親赴現場簡報/);
assert.match(c.exclusionReason,/不因決審模型/);
// Multi-group without verified stage details must stay pending, not auto-excluded.
const unclear=R.assess('永續設計競賽，概念設計組、產品設計組，產品可能涉及模型與打樣。');
assert.notEqual(unclear.decision,'跳過');
assert.match(unclear.checks['決審交件負擔'],/核實/);
// Group-level barriers do not imply every other group is barred.
const visual=R.assess('創新設計競賽：產品設計組須製作實體模型；視覺傳達組提交海報與數位圖檔。');
assert.notEqual(visual.decision,'跳過');
assert.match(visual.checks['作品形式'],/視覺傳達/);
console.log('Passed design-group/stage feasibility regression suite (42 assertions).');
