/* V3 records workspace: local browser storage with JSON backup/import. */
(function(){
'use strict';
const KEY='contest-screen-v3-records-v1', $=id=>document.getElementById(id);
let records=[],editing=null,stateReady=false,storageError='';
const today=()=>new Date().toISOString().slice(0,10);
function inferEdition(title){const t=String(title||'');const range=t.match(/20\d{2}\s*[-–—至]\s*20\d{2}/);if(range)return range[0].replace(/\s+/g,'');const year=t.match(/20\d{2}/);return year?year[0]:'';}
function inferDeadline(sourceText){const t=String(sourceText||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');const re=/(?:截止收件|截止日期|收件截止|投稿截止|報名截止|徵件截止|徵件日期|報名期間|收件期間|投稿期間)[^。；;]{0,45}?(?:至|截止|[:：｜]?\s*)(?:民國)?(20\d{2}|1\d{2})[年./-]\s*(\d{1,2})[月./-]\s*(\d{1,2})日?/;const m=t.match(re);if(!m)return '';let y=Number(m[1]);if(y<1911)y+=1911;return y+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[3])).padStart(2,'0');}
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validRecordArray(value){return Array.isArray(value)&&value.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.id==='string'&&x.id.trim());}
function load(){
 stateReady=false;storageError='';
 try{
  const raw=localStorage.getItem(KEY);
  if(raw===null){records=[];stateReady=true;}
  else{
   const parsed=JSON.parse(raw);
   if(!validRecordArray(parsed))throw new Error('資料格式不符或紀錄缺少 ID');
   records=parsed;stateReady=true;
  }
 }catch(e){
  storageError=e.message||'未知錯誤';
  $('recordStorageStatus').textContent='資料讀取異常，已鎖定所有寫入操作；請先匯出／檢查備份。原因：'+storageError;
 }
 render();
}
function persist(){
 if(!stateReady)throw new Error('資料尚未安全載入，禁止寫入以免覆蓋原紀錄。');
 const next=JSON.stringify(records);
 try{
  const previous=localStorage.getItem(KEY);
  if(previous!==null){
   const parsed=JSON.parse(previous);
   if(!validRecordArray(parsed))throw new Error('現有資料格式異常，停止覆寫');
   const backups=JSON.parse(localStorage.getItem(KEY+'_snapshots')||'[]');
   if(!Array.isArray(backups))throw new Error('本機備份快照格式異常，停止覆寫');
   backups.unshift({savedAt:new Date().toISOString(),raw:previous});
   localStorage.setItem(KEY+'_snapshots',JSON.stringify(backups.slice(0,5)));
  }
  localStorage.setItem(KEY,next);
  const verify=JSON.parse(localStorage.getItem(KEY));
  if(!validRecordArray(verify)||verify.length!==records.length)throw new Error('寫入後驗證失敗');
  window.dispatchEvent(new Event('contest-records-updated'));
  $('recordStorageStatus').textContent='已保存 '+records.length+' 筆至目前瀏覽器，並保留最近 5 次本機快照 · '+new Date().toLocaleString('zh-TW');
  return true;
 }catch(e){
  $('recordStorageStatus').textContent='保存失敗，已停止後續操作。請勿重新整理或匯入空資料。原因：'+(e.message||e);
  throw e;
 }
}
function showForm(record){if(!stateReady){alert('資料尚未安全載入，為避免覆蓋原紀錄，目前暫停編輯。');return;}editing=record?record.id:null;$('recordForm').hidden=false;$('recordFormTitle').textContent=record?'編輯競賽紀錄':'新增競賽紀錄';const v={Title:'title',Organizer:'organizer',Edition:'edition',Deadline:'deadline',SourceType:'sourceType',Decision:'decision',DecisionScope:'decisionScope',Research:'researchStatus',Created:'createdAt',Sources:'sources',SourceText:'sourceText',Reason:'decisionReason',Notes:'notes'};for(const [suffix,key] of Object.entries(v)){const el=$('rf'+suffix);let value=record?record[key]:'';if(key==='sources')value=(value||[]).map(x=>typeof x==='string'?x:x.url||'').join('\n');if(key==='createdAt'&&!value)value=today();if(key==='sourceType'&&!value)value='官方網站';if(key==='decision'&&!value)value='未決定';if(key==='decisionScope'&&!value)value='本屆不參加';if(key==='researchStatus'&&!value)value='未研究';el.value=value||'';} $('recordForm').scrollIntoView({behavior:'smooth',block:'start'});}
function save(){if(!stateReady){alert('資料讀取異常，已停止儲存，避免覆蓋原紀錄。');return;}const title=$('rfTitle').value.trim();if(!title){alert('請填寫競賽名稱');return;}const urls=$('rfSources').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);const old=records.find(x=>x.id===editing);const row={...(old||{}),id:editing||('r_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)),title,organizer:$('rfOrganizer').value.trim(),edition:$('rfEdition').value.trim(),deadline:$('rfDeadline').value,sourceType:$('rfSourceType').value,decision:$('rfDecision').value,decisionScope:$('rfDecisionScope').value,researchStatus:$('rfResearch').value,createdAt:$('rfCreated').value||today(),decisionDate:old?.decision===$('rfDecision').value?(old.decisionDate||old.createdAt||today()):today(),sources:urls.map(url=>({url,type:$('rfSourceType').value,addedAt:new Date().toISOString()})),sourceText:$('rfSourceText').value.trim(),decisionReason:$('rfReason').value.trim(),notes:$('rfNotes').value.trim(),updatedAt:new Date().toISOString(),/* legacy researchResult retained on old records; no longer edited in the form */screeningResult:old?.screeningResult||null};if(old)records=records.map(x=>x.id===editing?row:x);else records.unshift(row);persist();$('recordForm').hidden=true;editing=null;render();}
let activeTab='全部紀錄';
function render(){
 if(!$('recordList'))return;
 const q=$('recordSearch').value.trim().toLowerCase(),d=$('recordDecision').value,r=$('recordResearch').value,s=$('recordSource')?.value||'';
 const base=records.filter(x=>(!d||x.decision===d)&&(!r||x.researchStatus===r)&&(!s||x.sourceType===s)&&(!q||[x.title,x.organizer,x.notes,x.decisionReason,x.sourceText,x.researchResult].join(' ').toLowerCase().includes(q)));
 const tabs=['全部紀錄','不參加','待研究','準備參賽','保留觀察','未決定','已參賽','已完成'];
 const matchTab=x=>activeTab==='全部紀錄'||(activeTab==='待研究'?(x.decision==='待研究'||(x.researchStatus||'未研究')!=='已完成'):x.decision===activeTab);
 const list=base.filter(matchTab);
 if(stateReady)$('recordStorageStatus').textContent='目前 '+records.length+' 筆紀錄';else $('recordStorageStatus').textContent='資料讀取異常，已鎖定寫入操作。原因：'+storageError;
 const stats=[['全部紀錄',records.length],['不參加',records.filter(x=>x.decision==='不參加').length],['待研究',records.filter(x=>x.decision==='待研究'||(x.researchStatus||'未研究')!=='已完成').length],['準備參賽',records.filter(x=>x.decision==='準備參賽').length]];
 $('recordStats').innerHTML=stats.map(([k,v])=>'<div class="cat"><b>'+k+'</b><small>'+v+' 筆</small></div>').join('');
 let tabsHtml='<div class="record-tabs" role="tablist">'+tabs.map(t=>'<button type="button" class="record-tab '+(activeTab===t?'active':'')+'" data-record-tab="'+esc(t)+'">'+esc(t)+' '+(t==='全部紀錄'?records.length:records.filter(x=>t==='待研究'?(x.decision==='待研究'||(x.researchStatus||'未研究')!=='已完成'):x.decision===t).length)+'</button>').join('')+'</div>';
 const statusClass=v=>v==='不參加'?'no':v==='準備參賽'?'ready':v==='保留觀察'?'watch':v==='待研究'?'research':'';
 const rows=list.map(x=>'<tr><td><div class="record-title">'+esc(x.title)+'</div><div class="record-sub">'+esc(x.organizer||'主辦單位未填')+' · '+esc(x.edition||'年度未填')+'</div></td><td><span class="record-status '+statusClass(x.decision)+'">'+esc(x.decision||'未決定')+'</span></td><td>'+esc(x.decisionDate||x.createdAt||'')+'</td><td><span class="record-sub">'+esc(x.sourceType||'來源未分類')+'</span></td><td>'+esc(x.decisionReason||x.notes||'—')+'</td><td><button class="record-row-action" data-act="edit" data-id="'+esc(x.id)+'">查看／編輯 →</button></td></tr>').join('');
 $('recordList').innerHTML=tabsHtml+'<div class="record-table-wrap"><table class="record-table"><thead><tr><th>競賽名稱／主辦單位</th><th>我的決策</th><th>記錄日期</th><th>來源</th><th>原因／備註</th><th>操作</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="record-empty">目前沒有符合條件的紀錄。</td></tr>')+'</tbody></table></div>';
}
function addFromDiscovery(item){if(!stateReady)return 'storage-error';const title=String(item.title||'').trim();if(!title)return 'invalid';const existing=records.find(x=>x.title===title&&(!x.edition||!item.edition||x.edition===item.edition));if(existing)return 'duplicate';const now=new Date().toISOString();records.unshift({id:'r_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),title,organizer:item.organizer||'',edition:item.edition||inferEdition(title),deadline:item.deadline||inferDeadline(item.sourceText||''),sourceType:item.sourceType||'公開資料庫',decision:'待研究',decisionScope:'不適用',researchStatus:'未研究',createdAt:today(),sources:item.sourceUrl?[{url:item.sourceUrl,type:item.sourceType||'公開資料庫',name:item.sourceName||'來源連結'}]:[],sourceText:item.sourceText||'',decisionReason:'',notes:item.notes||'由找比賽線索匯入；仍須回官方來源查核。',updatedAt:now,screeningResult:item.screeningResult||null});persist();render();return 'added';}
window.addContestRecord=addFromDiscovery;
window.prepareContestRecord=function(item){
 if(!stateReady){alert('資料讀取異常，已停止新增或修改，避免覆蓋原紀錄。');return;}
 const found=records.find(x=>x.title===String(item.title||'').trim()&&(!x.edition||!item.edition||x.edition===item.edition));
 if(found){showForm(found);if(!$('rfEdition').value)$('rfEdition').value=item.edition||inferEdition(item.title)||'';if(!$('rfDeadline').value)$('rfDeadline').value=item.deadline||inferDeadline(item.sourceText||'');document.querySelector('[data-view="records"]')?.click();$('recordFormTitle').textContent='這筆競賽已存在，請更新決策或補充資料';return;}
 showForm();
 $('rfTitle').value=String(item.title||'').trim();
 $('rfOrganizer').value=item.organizer||'';
 $('rfEdition').value=item.edition||inferEdition(item.title)||'';
 $('rfDeadline').value=item.deadline||inferDeadline(item.sourceText||'');
 $('rfSourceType').value=item.sourceType||'公開資料庫';
 $('rfDecision').value='待研究';
 $('rfDecisionScope').value='不適用';
 $('rfResearch').value='未研究';
 $('rfSources').value=item.sourceUrl||'';
 $('rfSourceText').value=item.sourceText||'';
 $('rfReason').value='';
 $('rfNotes').value='由找比賽線索收錄；尚未完成官方簡章查核。';
 
 document.querySelector('[data-view="records"]')?.click();
 $('recordFormTitle').textContent='確認競賽紀錄與參賽決策';
 $('recordForm').scrollIntoView({behavior:'smooth',block:'start'});
};
function researchPrompt(x){return ['【工作台紀錄 ID】'+x.id,'請接手研究以下競賽，依序查核官方規則並評估是否符合我的參賽偏好。','','【競賽】'+x.title,'【主辦單位】'+(x.organizer||'未提供'),'【年度／屆次】'+(x.edition||'未提供'),'【原始來源類型】'+(x.sourceType||'未提供'),'【來源連結】',...(x.sources||[]).map(s=>typeof s==='string'?s:s.url),'','【已提供簡章／貼文文字】',x.sourceText||'未提供','【我先前的決策】'+(x.decision||'未決定'),'【決策原因】'+(x.decisionReason||'未提供'),'【備註】'+(x.notes||'未提供'),'【先前快篩結果】'+(x.screeningResult?JSON.stringify(x.screeningResult,null,2):'無'),'','【我的參賽偏好】優先考慮 AI 圖像、數位插畫、海報、漫畫、Logo、貼圖、AI 音樂及低投入文字競賽；AI 單張主圖轉短動畫可納入；完整影片按負擔評估。排除限定手繪、實體原型、禁止 AI 卻需要 AI 創作、主要獎項人氣投票主導的活動。','','【研究要求】優先查當年度官方簡章、附件及公告；核對資格、截止日期與時間、作品規格、AI 規定、費用、評審、授權、實體製作及交件要求。未查到不代表沒有；不得推定 AI 可用或免費。明確區分已確認、待確認、不符合。不得代我報名、投稿或公開發布作品。','研究完成後，請提供查核結論與簡短決策原因，供我更新本筆紀錄。'].join('\n');}
async function copy(text){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}
function exportJSON(){if(!stateReady){alert('資料尚未安全載入，禁止匯出空白備份。請先排除讀取異常。');return;}const payload={schemaVersion:1,updatedAt:new Date().toISOString(),records};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='contest-records-'+today()+'.json';a.click();URL.revokeObjectURL(url);$('recordStorageStatus').textContent='已匯出 JSON；請將下載檔案存入 pCloud 資料庫資料夾。';}
function restoreSnapshot(){
 if(!stateReady){alert('目前資料讀取異常，請先排除問題，不能直接還原。');return;}
 let snapshots;
 try{snapshots=JSON.parse(localStorage.getItem(KEY+'_snapshots')||'[]');if(!Array.isArray(snapshots))throw new Error('快照清單格式異常');}
 catch(e){alert('無法讀取本機快照：'+e.message);return;}
 if(!snapshots.length){alert('目前沒有可還原的本機快照。');return;}
 const options=snapshots.map((s,i)=>({s,i})).filter(x=>typeof x.s.raw==='string');
 if(!options.length){alert('沒有有效的快照資料。');return;}
 const labels=options.map(x=>(x.i+1)+'. '+x.s.savedAt+'（'+(()=>{try{return JSON.parse(x.s.raw).length+' 筆'}catch(e){return '格式錯誤'}})()+'）').join('\\n');
 const pick=prompt('選擇要還原的快照編號（1 為最近一次）：\\n'+labels,'1');
 if(pick===null)return;
 const chosen=options[Number(pick)-1];
 if(!chosen){alert('編號無效，未變更資料。');return;}
 let restored;try{restored=JSON.parse(chosen.s.raw);if(!validRecordArray(restored))throw new Error('資料格式錯誤');}catch(e){alert('快照無法還原：'+e.message);return;}
 if(!confirm('即將還原 '+restored.length+' 筆紀錄。還原前會先保留目前資料快照，確定繼續？'))return;
 const current=records;records=restored;
 try{persist();render();alert('快照還原完成，共 '+records.length+' 筆。');}
 catch(e){records=current;alert('還原失敗，原始資料未被確認覆寫。原因：'+e.message);}
}
function importJSON(file){if(!stateReady){alert('資料讀取異常，已鎖定匯入，避免覆蓋原紀錄。請先排除讀取問題。');return;}const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result),incoming=Array.isArray(data)?data:data.records;if(!validRecordArray(incoming))throw new Error('格式不正確，或有紀錄缺少有效 ID；未變更目前資料。');if(!confirm('備份內有 '+incoming.length+' 筆紀錄。將與目前 '+records.length+' 筆資料合併；相同 ID 以備份資料更新。寫入前會保留目前版本快照。是否繼續？'))return;const map=new Map(records.map(x=>[x.id,x]));incoming.forEach(x=>{if(x&&x.id)map.set(x.id,x);});records=Array.from(map.values());persist();render();alert('匯入完成，共 '+records.length+' 筆。');}catch(e){alert('匯入失敗：'+e.message);}};reader.readAsText(file);}
function renderQueues(){const card=x=>'<article class="record-item"><h3>'+esc(x.title)+'</h3><div class="record-meta">'+esc(x.organizer||'主辦單位未填')+' · '+esc(x.edition||'年度未填')+'</div><div class="record-badges"><span class="record-badge">'+esc(x.decision||'未決定')+'</span><span class="record-badge warn">'+esc(x.researchStatus||'未研究')+'</span></div><div class="record-item-actions"><button data-act="edit" data-id="'+esc(x.id)+'">編輯紀錄</button><button data-act="handoff" data-id="'+esc(x.id)+'">複製研究任務</button></div></article>';if($('pendingList'))$('pendingList').innerHTML=records.filter(x=>x.researchStatus!=='已完成').map(card).join('')||'<div class="empty">目前沒有待研究項目。</div>';if($('readyList'))$('readyList').innerHTML=records.filter(x=>x.decision==='準備參賽').map(card).join('')||'<div class="empty">目前沒有準備參賽項目。</div>';}
const oldRender=render;render=function(){oldRender();renderQueues();};
function init(){if(!$('recordList'))return;load();$('newRecordBtn').addEventListener('click',()=>showForm());$('saveRecordBtn').addEventListener('click',save);$('cancelRecordBtn').addEventListener('click',()=>{$('recordForm').hidden=true;editing=null;});$('exportRecordsBtn').addEventListener('click',exportJSON);$('restoreSnapshotBtn')?.addEventListener('click',restoreSnapshot);$('importRecordsFile').addEventListener('change',e=>{if(e.target.files[0])importJSON(e.target.files[0]);e.target.value='';});['recordSearch','recordSource','recordDecision','recordResearch'].forEach(id=>$(id).addEventListener(id==='recordSearch'?'input':'change',render));['pendingList','readyList'].forEach(id=>$(id)?.addEventListener('click',e=>{const b=e.target.closest('button[data-act]');if(!b)return;const x=records.find(r=>r.id===b.dataset.id);if(!x)return;if(b.dataset.act==='edit')showForm(x);else if(b.dataset.act==='handoff'||b.dataset.act==='copy')copy(researchPrompt(x)).then(()=>alert('研究任務已複製，請貼至 ChatGPT。'));}));$('recordList').addEventListener('click',async e=>{const tab=e.target.closest('[data-record-tab]');if(tab){activeTab=tab.dataset.recordTab;render();return;}const b=e.target.closest('button[data-act]');if(!b)return;const x=records.find(r=>r.id===b.dataset.id);if(!x)return;switch(b.dataset.act){case'edit':showForm(x);break;case'handoff':case'copy':{const p=researchPrompt(x);await copy(p);if(b.dataset.act==='handoff'){x.researchStatus='研究中';x.handoffAt=new Date().toISOString();persist();render();window.open('https://chatgpt.com/','_blank','noopener');}alert('研究任務已複製。請在 ChatGPT 貼上並送出；完成後可將結果貼回本筆紀錄。');break;}case'done':x.researchStatus='已完成';x.lastResearchedAt=new Date().toISOString();persist();render();break;case'delete':if(confirm('確定刪除此筆紀錄？此動作會同步更新目前瀏覽器資料。')){records=records.filter(r=>r.id!==x.id);persist();render();}}});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();