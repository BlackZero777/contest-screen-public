const assert=require('node:assert/strict');const R=require('./rules.js');
const cases=[
['single image animation','使用 AI 生成單張主圖，再使用 AI 圖轉短動畫','設計','AI單圖＋短動畫延伸','納入候選'],
['full video','劇本、分鏡、多鏡頭真人拍攝並剪輯影片','設計','完整影片／多鏡頭影音（另行評估）','另行評估'],
['hand draw','插畫僅限手繪，不得使用數位工具','設計','平面／圖像設計','跳過'],
['product design','產品設計須提出結構、材料工法、打樣及量產成本','設計','產品／實品設計（排除）','跳過'],
['text','徵求 12 字內活動標語','文字','低投入文字','文字類候選，待核對規格'],
['AI music','AI歌曲徵件，需使用指定工具、外部音檔及公開發行','設計','AI音樂／歌曲','設計類候選，待核對規格'],
['fee unknown','AI插畫徵件，截止日期 2026 年 11 月 16 日','設計','平面／圖像設計','設計類候選，待核對規格'],
['popular main prize','主獎人氣投票比重 50%，依票數決定','設計','作品形式待確認','跳過'],
['independent popularity','評審決選，另設獨立人氣獎，不影響主獎','設計','作品形式待確認','設計類候選，待核對規格']
];
for(const [n,t,c,f,d] of cases){const r=R.assess(t);assert.equal(r.category,c,n+' category');assert.equal(r.workFormat,f,n+' format');assert.equal(r.decision,d,n+' decision');}
assert.equal(R.aiPolicy('禁止使用 AI 生成主畫面').level,'no-main');
assert.equal(R.aiPolicy('AI 僅限輔助，不可直接生成作品').level,'assist');
assert.equal(R.aiPolicy('本競賽禁止使用 AI 工具').level,'no-ai');
assert.match(R.assess('AI插畫徵件，截止日期 2026 年 11 月 16 日').checks['費用'],/不等於免費/);
assert.match(R.assess('AI歌曲徵件').warnings.join(' '),/指定工具/);
// AI policy conflicts: stricter prohibitions must not be hidden by earlier, broader matches.
assert.equal(R.aiPolicy('AI 僅限輔助，但本競賽禁止使用 AI 工具').level,'no-ai','no-AI prohibition must override assist-only wording');
assert.equal(R.aiPolicy('AI 僅限輔助，禁止使用 AI 生成主圖').level,'no-main','no-main-image prohibition must be surfaced over assist-only wording');
assert.equal(R.aiPolicy('禁止使用 AI 生成主圖，且不得使用 AI 工具').level,'no-ai','complete AI ban must override main-image-only prohibition');
console.log('Passed 17 regression checks (35 assertions).');
