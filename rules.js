(function(root){
'use strict';
const VERSION='v2.0.0';
const RE={
 text:/命名|取名|名稱徵選|標語|口號|短詩|小詩|對聯|徵聯|短文案|短句|slogan/i,
 music:/ai音樂|ai歌曲|歌曲徵件|音樂創作|作曲|作詞作曲|配樂創作|生成歌曲|音樂生成/i,
 design:/插畫|圖像|純圖|海報|四格漫畫|漫畫|貼圖|logo|標誌|視覺設計|平面設計|書法創藝|書法藝術|ai生成圖|生成圖片|圖像生成|攝影|動畫|影片|影音|短影音|mv|音樂錄影/i,
 single:/單張|單圖|一張圖|主圖|原圖|圖轉影|圖轉影片|圖片轉動畫|圖像轉動畫|生成動畫|靜圖.{0,8}動畫|圖片.{0,8}動畫|圖像.{0,8}影片/i,
 full:/完整影片|劇情片|短片製作|短片競賽|微電影|劇本|分鏡|多鏡頭|真人拍攝|實地拍攝|拍攝剪輯|影片剪輯|影音製作|影片製作|紀錄片/i,
 hand:/僅限手繪|只限手繪|只能手繪|手繪限定|不得使用電腦|不得使用數位工具|禁止數位繪圖/i,
 noMain:/禁止使用ai生成主圖|不得以ai生成主圖|不得使用ai生成主視覺|禁止使用ai生成主畫面|禁止ai生成主視覺|禁止ai生成主畫面|不得直接使用ai生成圖|不得以生成式ai生成作品主體/i,
 assist:/ai僅限輔助|僅可使用ai輔助|ai只可輔助|僅限ai輔助/i,
 noAI:/(?:禁止|不得|不可)使用(?:生成式)?ai(?!生成主圖|生成主畫面|生成主視覺|生成作品主體)|不得使用人工智慧|禁止人工智慧|禁止生成式ai|不得使用生成式ai/i,
 product:/產品設計|商品設計|工業設計|產品功能|結構設計|機構設計|材料工法|打樣|量產|製造成本|生產成本|實品製作|實體產品|模型製作|原型製作|包裝結構|刀模|工程圖/i,
 physical:/須繳交實品|提交實體作品|實物作品|寄送成品|實體模型|實品展|實體展件/i,
 popularity:/人氣票選|網路投票|票數入圍|投票決選|按票數|人氣決定|票選入圍|人氣投票/i,
 hardPop:/(?:主獎|總獎|主要獎項).{0,20}(?:人氣|投票).{0,20}(?:50%|50％|一半)|(?:人氣|投票).{0,20}(?:占比|佔比|權重|比重).{0,20}(?:50%|50％|一半)|(?:50%|50％|一半).{0,20}(?:人氣|投票)|(?:先|必須|須).{0,12}(?:靠|依靠|取得).{0,12}(?:票數|投票).{0,12}(?:入圍|晉級)/i,
 independent:/獨立人氣獎|人氣獎.{0,8}不影響|人氣獎另計|人氣獎另設|人氣獎不列入總分/i,
 aiAllowed:/使用生成式ai|ai生成|ai創作|ai工具|人工智慧生成|ai生圖|ai圖轉影|可使用ai|允許使用ai/i,
 fee:/報名費|參賽費|保證金|材料費|製作費|報名費用|參賽費用|付費工具|指定軟體|授權費|報名免費|免報名費/i,
 attachment:/附件|原始檔|源文件|作品說明|設計理念|授權同意書|切結書|證明文件/i,
 deadline:/截止|截止日期|收件至|徵件至|報名至|交件期限|投稿期限/i
};
const clean=s=>String(s||'').replace(/[\s　]+/g,'');
const has=(s,r)=>r.test(clean(s));
function category(s){return has(s,RE.text)&&!has(s,RE.design)&&!has(s,RE.music)&&!has(s,RE.single)?'文字':'設計';}
function format(s){
 if(has(s,RE.music))return 'AI音樂／歌曲';
 if(has(s,RE.product)||has(s,RE.physical))return '產品／實品設計（排除）';
 if(has(s,RE.single)&&!has(s,RE.full))return 'AI單圖＋短動畫延伸';
 if(has(s,RE.full))return '完整影片／多鏡頭影音（另行評估）';
 if(has(s,RE.text)&&!has(s,RE.design))return '低投入文字';
 if(has(s,RE.design))return '平面／圖像設計';
 return '作品形式待確認';
}
function aiPolicy(s){
 // Apply the strictest prohibition first so broader wording cannot mask it.
 if(has(s,RE.noAI))return {label:'疑似禁止一切 AI',level:'no-ai',detail:'需讀完整條文，確認是否禁止所有 AI 工具。'};
 if(has(s,RE.noMain))return {label:'禁止 AI 生成主畫面',level:'no-main',detail:'若允許電繪，須自行電繪，並確認其他 AI 輔助是否允許。'};
 if(has(s,RE.assist))return {label:'AI 僅限輔助',level:'assist',detail:'不能直接假定可用 AI 生成主畫面；核對輔助界線。'};
 if(has(s,RE.aiAllowed))return {label:'有 AI 允許線索，範圍待確認',level:'allowed',detail:'核對主畫面生成、工具限制、揭露方式與授權條款。'};
 return {label:'未確認',level:'unknown',detail:'未辨識到 AI 規範不代表允許 AI，須查完整簡章與附件。'};
}
function dates(s){const m=clean(s).match(/(?:20\d{2}[年./-]\d{1,2}[月./-]\d{1,2}日?|民國\d{2,3}年\d{1,2}月\d{1,2}日)/g);return m?[...new Set(m)].slice(0,6):[];}
function assess(text,opts){
 const s=String(text||''),o=opts||{},cat=category(s),fmt=format(s),ai=aiPolicy(s),reasons=[],warnings=[];
 let decision=cat==='文字'?'文字類候選，待核對規格':'設計類候選，待核對規格';
 const checks={
  '參賽資格':(o.identity?'身分選擇：'+o.identity+'；':'')+'仍須核對年齡、居住地、組別及團隊限制。',
  'AI 規範':ai.label+'。'+ai.detail,
  '費用':/報名免費|免報名費/.test(clean(s))?'有免報名費線索；仍須確認保證金、工具訂閱、材料與交件等其他成本。':(has(s,RE.fee)?'原文提及費用項目；確認金額、是否必繳及適用組別。':'未辨識到費用不等於免費；報名費、保證金、工具訂閱、製作與交件費用待確認。'),
  '評選方式':'待核對主獎是否評審主導、人氣權重及投票是否影響入圍。',
  '交件規格':'檔案格式、件數、附件、授權及交件方式待核對。',
  '截止日期':has(s,RE.deadline)?'有期限線索；日期：'+(dates(s).join('、')||'未辨識到明確日期')+'。須確認截止時間。':'截止日期與時間待確認。',
  '製作負擔':'待評估工作量與時間。'
 };
 if(has(s,RE.hand)){decision='跳過';reasons.push('限定手繪或禁止數位工具，不符合目前以電繪與 AI 指令為主的參賽方式。');}
 if(has(s,RE.product)||has(s,RE.physical)){decision='跳過';reasons.push('涉及實品交件或產品功能、結構、材料工法、打樣、量產等要求，超出目前參賽範圍。');}
 if(decision!=='跳過'&&ai.level==='no-ai'){decision='不列為 AI 友善；評估自行電繪';reasons.push('疑似禁止一切 AI；若允許電繪，需自行電繪，不能當作 AI 主畫面友善比賽。');}
 else if(decision!=='跳過'&&ai.level==='no-main'){decision='不列為 AI 主畫面友善';reasons.push('禁止 AI 生成主畫面；若允許電繪，須自行電繪，並確認其他 AI 輔助是否允許。');}
 else if(decision!=='跳過'&&ai.level==='assist'){decision='不列為 AI 主畫面友善';reasons.push('AI 僅能輔助，不能直接生成主要畫面；需確認是否值得自行電繪。');}
 if(decision!=='跳過'&&ai.level!=='no-ai'&&ai.level!=='no-main'&&ai.level!=='assist'){
  if(has(s,RE.single)&&!has(s,RE.full)){decision='納入候選';reasons.push('AI 生成單張主圖，再將同一張圖轉成短動畫；納入設計類，不因需要影片檔就自動跳過。');checks['製作負擔']='低至中：一張主圖＋單支圖轉影；核對片長、音效、後製與檔案大小。';}
  else if(has(s,RE.full)){decision='另行評估';reasons.push('涉及劇情、劇本、分鏡、多鏡頭、真人拍攝或大量剪輯，需另外估算投入。');checks['製作負擔']='中至高：估算劇本、分鏡、素材、動態生成、剪輯與聲音製作時間。';}
 }
 if(has(s,RE.hardPop)&&!has(s,RE.independent)){decision='跳過';reasons.push('疑似主獎人氣比重達 50% 或須先靠票數入圍，符合既定排除條件。');checks['評選方式']='疑似人氣主導；核對主獎人氣權重與投票是否影響入圍。';}
 else if(has(s,RE.popularity)&&!has(s,RE.independent)){warnings.push('發現人氣／投票線索；核對主獎人氣是否達 50%，或是否須先靠票數入圍。');checks['評選方式']='疑似有人氣機制；主獎評審權重待確認。';}
 if(has(s,RE.independent)){warnings.push('若人氣獎獨立且不影響主獎，仍可保留主獎機會。');checks['評選方式']='有獨立人氣獎線索；仍需確認不影響主獎評分或入圍。';}
 if(fmt==='AI音樂／歌曲'){warnings.push('AI 音樂須核對指定工具、外部音檔、參賽／商用授權、公開發行、檔案規格及完整費用。');checks['製作負擔']='依指定工具、曲長、音檔、授權與發行要求評估。';}
 if(cat==='文字')reasons.push('歸入文字類；核對字數、件數、題目限制、附件與投入時間。');
 if(!reasons.length)reasons.push('目前文字不足以定案，請補上當屆官方簡章、附件與完整評選規則。');
 warnings.unshift('本結果是關鍵字初篩，不是官方查證；未辨識到某項規定不代表沒有，最後以當屆官方簡章與附件為準。');
 if(o.sourceType==='社群貼文／廣告')warnings.unshift('社群貼文或廣告只能作為線索，須回到主辦方官方頁面與簡章核對。');
 return {version:VERSION,category:cat,workFormat:fmt,decision:decision,reasons:reasons,warnings:warnings,checks:checks,detectedDates:dates(s),sourceType:o.sourceType||'簡章／官方來源待核對'};
}
root.ContestScreenRules={VERSION:VERSION,RE:RE,category:category,format:format,aiPolicy:aiPolicy,dates:dates,assess:assess};
if(typeof module!=='undefined'&&module.exports)module.exports=root.ContestScreenRules;
})(typeof globalThis!=='undefined'?globalThis:this);
