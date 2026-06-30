const cardsEl = document.querySelector('#cards'), windCardsEl = document.querySelector('#windCards'), watchPanel = document.querySelector('#watchPanel'), rankPanel = document.querySelector('#rankPanel'), rankLayer = document.querySelector('#rankLayer'), rankModal = document.querySelector('#rankModal'), detailLayer = document.querySelector('#detailLayer'), detailEl = document.querySelector('#detail'), marketLayer = document.querySelector('#marketLayer'), marketModal = document.querySelector('#marketModal'), watchlistLayer = document.querySelector('#watchlistLayer'), watchlistModal = document.querySelector('#watchlistModal'), profileLayer = document.querySelector('#profileLayer'), profileModal = document.querySelector('#profileModal'), profileButton = document.querySelector('#profileButton'), sideUserAvatarEl = document.querySelector('#sideUserAvatar'), sideUserNameEl = document.querySelector('#sideUserName'), globalMarketEditBtn = document.querySelector('#globalMarketEditBtn'), globalMarketDoneBtn = document.querySelector('#globalMarketDoneBtn'), globalMarketCancelBtn = document.querySelector('#globalMarketCancelBtn'), marketWindEditBtn = document.querySelector('#marketWindEditBtn'), marketWindDoneBtn = document.querySelector('#marketWindDoneBtn'), marketWindCancelBtn = document.querySelector('#marketWindCancelBtn'), suggestEl = document.querySelector('#suggest'), searchEl = document.querySelector('#search'), marketEl = document.querySelector('#market'), refreshButton = document.querySelector('#refreshButton'), themeButton = document.querySelector('#themeButton'), themeButtons = [...document.querySelectorAll('[data-theme-toggle]')], refreshTimeEl = document.querySelector('#refreshTime'), sidebarEl = document.querySelector('#sidebar'), sidebarToggle = document.querySelector('#sidebarToggle'), sidebarResizeHandle = document.querySelector('#sidebarResizeHandle'), currencyFromSelect = document.querySelector('#currencyFromSelect'), currencyToSelect = document.querySelector('#currencyToSelect'), currencyAmountInput = document.querySelector('#currencyAmountInput'), currencyResultValueEl = document.querySelector('#currencyResultValue'), currencyRateTextEl = document.querySelector('#currencyRateText'), currencyChangeTextEl = document.querySelector('#currencyChangeText'), currencyUpdatedTimeEl = document.querySelector('#currencyUpdatedTime'), currencyFavoritesListEl = document.querySelector('#currencyFavoritesList'), currencyTableBodyEl = document.querySelector('#currencyTableBody'), currencyRefreshButton = document.querySelector('#currencyRefreshButton'), newsTabsEl = document.querySelector('#newsTabs'), newsGridEl = document.querySelector('#newsGrid'), newsUpdatedTimeEl = document.querySelector('#newsUpdatedTime'), newsRefreshButton = document.querySelector('#newsRefreshButton'), moduleViews = [...document.querySelectorAll('[data-module-view]')], moduleButtons = [...document.querySelectorAll('[data-module]')];
let detailData=null, detailFetchedAt=null, detailWatchAllowed=true, chartMode='k', kPeriod='d', chartState=null, latest=null, rankings=null, globalMarketState=null, globalMarketDraft=null, globalMarketEditMode=false, globalMarketDragging=false, marketWindState=null, marketWindDraft=null, marketWindEditMode=false, marketWindDragging=false, marketWindPickerIndex=null, marketWindOptions=null, marketWindOptionsPromise=null, currencyState=null, currencyOptions=null, currencyPickerMode=null, currencyPersistPromise=Promise.resolve(), currencyPersistRevision=0, currencyFavoriteThrottleUntil=0, currencyLocalSnapshot=null, newsState=null, newsLoading=false, activeNewsCategory=localStorage.getItem('activeNewsCategory')||'all', watchDragging=false, watchTabsDrag=null, watchTabsClickSuppressed=false, watchlistSortDrag=null, watchViewAnimating=false, watchViewMode=localStorage.getItem('watchViewMode')==='cards'?'cards':'table', activeWatchlistId=localStorage.getItem('activeWatchlistId')||'', watchlistPickerQuote=null, watchlistDialog=null, profileDraftAvatar='', globalMarketPickerIndex=null, globalMarketOptions=null, globalMarketOptionsPromise=null, rankMarkets={gainers:'tw',losers:'tw',volume:'tw'}, activeRankTab='gainers', searchTimer=null, loadTimer=null, activeModule=localStorage.getItem('activeModule')||'dashboard', sidebarCollapsed=localStorage.getItem('sidebarCollapsed')==='true', sidebarWidth=Number(localStorage.getItem('sidebarWidth'))||276, sidebarResizeState=null, moduleTransitionTimer=null;
const SIDEBAR_MIN_WIDTH=220, SIDEBAR_MAX_WIDTH=380, SIDEBAR_COLLAPSED_WIDTH=96, SIDEBAR_MOBILE_BREAKPOINT=900;
const NEWS_CATEGORIES=[['all','全部'],['tw','台股'],['us','美股'],['global','全球市場'],['tech','科技產業'],['crypto','加密貨幣'],['headline','財經要聞']];
const DEFAULT_PROFILE={ name:'投資者', avatar:'' };
let profileState={...DEFAULT_PROFILE};
loadProfile();
const fmtNumber=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:d}):'-';
const fmtInt=v=>Number.isFinite(v)?Math.round(v).toLocaleString('zh-TW'):'-';
const fmtTime=v=>v?new Date(v).toLocaleString('zh-TW',{hour12:false}):'-';
const cls=v=>v>0?'up':v<0?'down':'';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const profileAvatarMarkup=avatar=>avatar?'<img src="'+avatar+'" alt="使用者頭像">':'<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="currentColor" opacity=".95"/><path d="M5 19c1.8-3.1 4.2-4.6 7-4.6S17.2 15.9 19 19" fill="currentColor" opacity=".45"/></svg>';
const canWatch=q=>q?.type==='台股'||q?.type==='美股';
const globalMarketOptionLabel=o=>o?.region?o.region+' · '+o.name:o?.name||'-';
const sectionTitleIcon=kind=>kind==='watch'?'<span class="section-title-icon section-title-icon-watch" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.9l2.8 5.68 6.27.91-4.53 4.42 1.07 6.24L12 17.2 6.38 20.15l1.07-6.24L2.92 9.49l6.27-.91L12 2.9z"/></svg></span>':'';
const CURRENCY_FAVORITES_LIMIT=5;
const CURRENCY_FLAG_SVGS={
  USD:'<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#fff"/><path d="M0 2h28v2H0zm0 4h28v2H0zm0 4h28v2H0zm0 4h28v2H0zm0 4h28v2H0z" fill="#dc2626"/><rect width="12" height="10" rx="3" fill="#1d4ed8"/></svg>',
  CNY:'<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#ef4444"/><circle cx="8" cy="7" r="3" fill="#fde047"/></svg>',
  JPY:'<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#fff"/><circle cx="14" cy="10" r="5" fill="#e11d48"/></svg>',
  ZAR:'<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#dc2626"/><path d="M0 0h28v10H0z" fill="#059669"/><path d="M0 0l13 10L0 20z" fill="#111827"/><path d="M0 3l10 7L0 17z" fill="#fbbf24"/><path d="M13 10 28 4v12z" fill="#2563eb"/></svg>',
  EUR:'<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#1d4ed8"/><circle cx="14" cy="10" r="5" fill="none" stroke="#fde047" stroke-width="2" stroke-dasharray="1.2 2.4"/></svg>',
  TWD:'<svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#ef4444"/><rect width="12" height="9" rx="3" fill="#1d4ed8"/><circle cx="6" cy="4.5" r="2.2" fill="#fff"/></svg>'
};
const currencyFlag=quote=>'<span class="currency-flag-svg" aria-hidden="true">'+(CURRENCY_FLAG_SVGS[quote?.code]||CURRENCY_FLAG_SVGS.TWD)+'</span>';
const currencyDisplayName=quote=>quote?.name||quote?.code||'-';
const currencyLabel=quote=>quote?.label||((quote?.code||'-')+' '+currencyDisplayName(quote));
function currencyQuoteMap(){ return new Map((currencyState?.quotes||[]).map(quote=>[quote.code,quote])); }
function currencyOptionList(){ return Array.isArray(currencyOptions)&&currencyOptions.length?currencyOptions:(currencyState?.quotes||[]); }
function activeCurrencyQuote(code){ return currencyQuoteMap().get(code)||null; }
function currencyRate(code){ const quote=activeCurrencyQuote(code); return Number.isFinite(quote?.rate)?quote.rate:null; }
function currencySnapshot(state=currencyState){ return state?{favorites:[...(state.favorites||[])],from:state.from,to:state.to}:null; }
function applyCurrencyServerState(serverState){
  if(!serverState) return null;
  if(currencyLocalSnapshot){
    return { ...serverState, ...currencyLocalSnapshot, favorites:[...(currencyLocalSnapshot.favorites||[])] };
  }
  return serverState;
}
function convertCurrencyAmount(amount, fromCode, toCode){ const amountValue=Number(amount), fromRate=currencyRate(fromCode), toRate=currencyRate(toCode); if(!Number.isFinite(amountValue)) return null; if(fromCode===toCode) return amountValue; if(fromCode==='TWD'&&Number.isFinite(toRate)&&toRate) return amountValue/toRate; if(toCode==='TWD'&&Number.isFinite(fromRate)) return amountValue*fromRate; if(Number.isFinite(fromRate)&&Number.isFinite(toRate)&&toRate) return amountValue*fromRate/toRate; return null; }
function currencyUpdatedAt(){ const rows=(currencyState?.quotes||[]).filter(quote=>quote?.updatedAt).map(quote=>quote.updatedAt).sort(); return rows[rows.length-1]||currencyState?.fetchedAt||null; }
function cloneSlots(slots){ return Array.isArray(slots)?slots.slice(0,5).map(s=>s?{...s}:null):[]; }
function normalizeSlots(slots){ const rows=cloneSlots(slots); while(rows.length<5) rows.push(null); return rows; }
function cloneWindSlots(slots){ return Array.isArray(slots)?slots.slice(0,6).map(s=>s?{...s}:null):[]; }
function normalizeWindSlots(slots){ const rows=cloneWindSlots(slots); while(rows.length<6) rows.push(null); return rows; }
function quoteMap(){ return new Map([...(latest?.groups||[]).flatMap(g=>g.quotes||[]),...(latest?.watchlists||[]).flatMap(g=>g.quotes||[]),...(marketWindState?.slots||[]).filter(Boolean),...(currencyState?.quotes||[]).filter(Boolean)].map(q=>[q.symbol||q.code,q])); }
function optionMap(){ return new Map((globalMarketOptions||[]).map(q=>[q.symbol,q])); }
function currentMarketSlots(){ return normalizeSlots(globalMarketEditMode&&Array.isArray(globalMarketDraft)?globalMarketDraft:globalMarketState?.slots); }
function currentWindSlots(){ return normalizeWindSlots(marketWindEditMode&&Array.isArray(marketWindDraft)?marketWindDraft:marketWindState?.slots); }
function resolveMarketRow(slot, quotes, options){ if(!slot?.symbol)return null; return quotes.get(slot.symbol) || options.get(slot.symbol) || slot; }
function isMarketSlotUsed(symbol, index, slots){ return symbol && slots.some((slot,i)=>i!==index&&slot?.symbol===symbol); }
function flatGroups(data){ return Object.fromEntries(data.groups.map(g=>[g.name,g.quotes])); }
function loadProfile(){ return fetch('/api/profile',{cache:'no-store'}).then(r=>r.json()).then(data=>{ profileState={ ...DEFAULT_PROFILE, ...(data&&typeof data==='object'?data:{}) }; renderProfileCard(); }).catch(()=>{ profileState={ ...DEFAULT_PROFILE }; renderProfileCard(); }); }
function saveProfile(){ return fetch('/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(profileState)}).then(r=>r.json()).then(()=>renderProfileCard()).catch(()=>renderProfileCard()); }
function renderProfileCard(){ if(sideUserNameEl) sideUserNameEl.textContent=profileState.name||DEFAULT_PROFILE.name; if(sideUserAvatarEl) sideUserAvatarEl.innerHTML=profileAvatarMarkup(profileState.avatar); }
function setRefreshTime(){ const t=fmtTime(latest?.fetchedAt); document.querySelector('#sideTime').textContent=t; refreshTimeEl.textContent=t; }
function isDashboardModule(){ return activeModule==='dashboard'; }
function isMobileSidebar(){ return window.innerWidth<=SIDEBAR_MOBILE_BREAKPOINT; }
function clampSidebarWidth(width){ return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width||SIDEBAR_MIN_WIDTH))); }
function persistSidebarState(){ localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed)); localStorage.setItem('sidebarWidth', String(sidebarWidth)); }
function applySidebarState(){
  if(!sidebarEl) return;
  document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  const appliedWidth=sidebarCollapsed?SIDEBAR_COLLAPSED_WIDTH:clampSidebarWidth(sidebarWidth);
  document.body.style.setProperty('--sidebar-width', appliedWidth+'px');
  persistSidebarState();
}
function renderModuleState(){
  document.body.dataset.activeModule=activeModule;
  moduleViews.forEach(view=>{
    const active=view.dataset.moduleView===activeModule;
    view.classList.toggle('is-active', active);
    view.classList.toggle('is-leaving', false);
  });
  moduleButtons.forEach(button=>{
    const active=button.dataset.module===activeModule;
    button.classList.toggle('active', active);
    if(active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
function setActiveModule(nextModule){
  const previousModule=activeModule;
  if((nextModule||'dashboard')===previousModule) return;
  clearTimeout(moduleTransitionTimer);
  const previousView=moduleViews.find(view=>view.dataset.moduleView===previousModule);
  activeModule=nextModule||'dashboard';
  localStorage.setItem('activeModule', activeModule);
  if(previousView){
    previousView.classList.add('is-leaving');
    previousView.classList.remove('is-active');
  }
  renderModuleState();
  moduleTransitionTimer=setTimeout(()=>{
    previousView?.classList.remove('is-leaving');
    moduleTransitionTimer=null;
  }, 260);
  if(activeModule==='dashboard') renderAll();
  if(activeModule==='currency'){
    renderCurrency();
    if(!currencyState) refreshCurrencyOnly().catch(console.error);
  }
  if(activeModule==='news'){
    renderNews();
    if(!newsState) refreshNewsOnly().catch(console.error);
  }
}
function toggleSidebar(){ sidebarCollapsed=!sidebarCollapsed; applySidebarState(); }
function beginSidebarResize(event){
  if(isMobileSidebar()||sidebarCollapsed) return;
  sidebarResizeState={ pointerId:event.pointerId, startX:event.clientX, startWidth:sidebarEl.getBoundingClientRect().width };
  document.body.classList.add('sidebar-resizing');
  sidebarResizeHandle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}
function updateSidebarResize(event){
  if(!sidebarResizeState||event.pointerId!==sidebarResizeState.pointerId) return;
  sidebarWidth=clampSidebarWidth(sidebarResizeState.startWidth+(event.clientX-sidebarResizeState.startX));
  document.body.style.setProperty('--sidebar-width', sidebarWidth+'px');
}
function endSidebarResize(event){
  if(!sidebarResizeState) return;
  if(event?.pointerId!==undefined&&event.pointerId!==sidebarResizeState.pointerId) return;
  sidebarResizeState=null;
  document.body.classList.remove('sidebar-resizing');
  applySidebarState();
}
function closeProfileSettings(){ document.body.classList.remove('profile-open'); profileModal.innerHTML=''; profileDraftAvatar=''; }
function openProfileSettings(){
  profileDraftAvatar=profileState.avatar||'';
  profileModal.innerHTML='<form class="profile-form" data-profile-form><div class="profile-modal-head"><div><h2>個人設定</h2><div class="market-modal-subtitle">更新你的顯示名稱與個人頭像。</div></div><button class="small-btn" type="button" data-close-profile>關閉</button></div><div class="profile-avatar-row"><div class="profile-avatar-preview" data-profile-avatar-preview>'+profileAvatarMarkup(profileDraftAvatar)+'</div><div class="profile-avatar-actions"><label class="profile-upload-label">上傳頭像<input type="file" accept="image/*" data-profile-avatar-input></label><button class="small-btn" type="button" data-profile-reset-avatar>移除頭像</button><div class="profile-helper">支援常見圖片格式，資料會保存在伺服器。</div></div></div><label class="watchlist-field"><span>顯示名稱</span><input class="watchlist-input" name="name" maxlength="24" autocomplete="off" placeholder="輸入你的名字" value="'+esc(profileState.name||DEFAULT_PROFILE.name)+'"></label><div class="watchlist-modal-actions"><button class="small-btn" type="button" data-close-profile>取消</button><button class="small-btn primary" type="submit">儲存設定</button></div></form>';
  document.body.classList.add('profile-open');
  requestAnimationFrame(()=>profileModal.querySelector('input[name="name"]')?.focus());
}
function updateProfileAvatarPreview(){ const preview=profileModal.querySelector('[data-profile-avatar-preview]'); if(preview) preview.innerHTML=profileAvatarMarkup(profileDraftAvatar); }
async function handleProfileAvatarChange(input){
  const file=input?.files?.[0];
  if(!file) return;
  profileDraftAvatar=await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result||'')); reader.onerror=()=>reject(reader.error); reader.readAsDataURL(file); });
  updateProfileAvatarPreview();
}
async function submitProfileForm(form){
  const name=(new FormData(form).get('name')||'').toString().trim();
  profileState.name=name||DEFAULT_PROFILE.name;
  profileState.avatar=profileDraftAvatar||'';
  await saveProfile();
  closeProfileSettings();
}
async function fetchJson(path){ const res=await fetch(path,{cache:'no-store'}); if(!res.ok) throw new Error(path+' HTTP '+res.status); return res.json(); }
function loadDashboardSideData(){
  const marketPromise=fetchJson('/api/global-market').then(data=>{ globalMarketState=data; if(isDashboardModule()) renderGlobalMarket(); return data; }).catch(console.error);
  const windPromise=fetchJson('/api/market-wind').then(data=>{ marketWindState=data; if(isDashboardModule()) renderWind(); return data; }).catch(console.error);
  const rankPromise=fetchJson('/api/rankings').then(data=>{ rankings=data; renderRankings(); return data; }).catch(console.error);
  return [marketPromise,windPromise,rankPromise];
}
async function load(){
  const quoteTask=fetchJson('/api/quotes');
  const sideTasks=loadDashboardSideData();
  try{
    latest=await quoteTask;
    setRefreshTime();
    renderAll();
    if(activeModule==='currency'){ if(!currencyState) refreshCurrencyOnly().catch(console.error); else renderCurrency(); }
    if(activeModule==='news'){ if(!newsState) refreshNewsOnly().catch(console.error); else renderNews(); }
    await refreshDetail().catch(()=>{});
  } catch(error){
    console.error(error);
  } finally {
    await Promise.allSettled(sideTasks);
    clearTimeout(loadTimer);
    loadTimer=setTimeout(load,(latest?.refreshSeconds||30)*1000);
  }
}
async function reloadWatch(){ const res=await fetch('/api/quotes',{cache:'no-store'}); latest=await res.json(); setRefreshTime(); if(!watchViewAnimating) renderWatch(); requestAnimationFrame(drawMiniCharts); }
function renderAll(){ if(!isDashboardModule()) return; if(!(globalMarketEditMode&&globalMarketDragging)) renderGlobalMarket(); if(!(marketWindEditMode&&marketWindDragging)) renderWind(); if(!watchDragging&&!watchViewAnimating) renderWatch(); requestAnimationFrame(drawMiniCharts); }
function renderCards(rows){ renderGlobalMarket(); }
function updateGlobalMarketControls(){ const editing=globalMarketEditMode; globalMarketEditBtn.hidden=editing; globalMarketDoneBtn.hidden=!editing; globalMarketCancelBtn.hidden=!editing; document.body.classList.toggle('global-market-edit',editing); }
function renderGlobalMarket(){ const quotes=quoteMap(), options=optionMap(), slots=currentMarketSlots(); cardsEl.innerHTML=slots.map((slot,i)=>renderMarketCard(slot,i,quotes,options)).join(''); updateGlobalMarketControls(); }
function renderMarketCard(slot,index,quotes,options){ const row=resolveMarketRow(slot,quotes,options); const editing=globalMarketEditMode; if(!row){ return '<div class="card market-slot empty" draggable="'+(editing?'true':'false')+'" data-open="" data-market-slot="'+index+'" data-market-symbol="" data-market-name="" data-market-type="" data-name="" data-type="" data-market-empty="true"><div class="market-slot-placeholder"><strong>點擊新增指數</strong><span>可替換成國際指數</span></div></div>'; } const title=esc(row.name||row.symbol), symbol=esc(row.symbol), type=esc(row.type||'指數'), name=esc(row.name||row.symbol), change=Number.isFinite(row.change)?row.change:null, changePercent=Number.isFinite(row.changePercent)?row.changePercent:null, price=Number.isFinite(row.price)?fmtNumber(row.price,2):'-', changeText=num(change)+' ('+pct(changePercent)+')', note=row.region?esc(row.region+' · '+(row.symbol||'')):''; return '<div class="card market-slot has-mini-chart" draggable="'+(editing?'true':'false')+'" data-open="'+symbol+'" data-name="'+name+'" data-type="'+type+'" data-market-slot="'+index+'" data-market-symbol="'+symbol+'" data-market-name="'+name+'" data-market-type="'+type+'">'+(editing?'<div class="market-slot-actions"><button class="small-btn danger market-slot-remove" type="button" data-market-remove="'+index+'">移除</button></div>':'')+'<div class="card-copy"><div class="card-title">'+title+'</div><div class="card-price">'+price+'</div><div class="card-change '+cls(change)+'">'+changeText+'</div></div>'+miniCanvas(row)+(note?'<div class="market-slot-note muted">'+note+'</div>':'')+'</div>'; }
function syncGlobalMarketDraftFromDom(){ const slots=[...cardsEl.querySelectorAll('[data-market-slot]')].map(card=>{ const symbol=card.dataset.marketSymbol; if(!symbol) return null; const options=globalMarketOptions||[]; const option=options.find(opt=>opt.symbol===symbol); return option?{...option}:{ symbol, name:card.dataset.marketName||symbol, type:card.dataset.marketType||'指數' }; }); globalMarketDraft=normalizeSlots(slots); }
function animateCardMoves(container, before){ [...container.children].forEach(card=>{ const prev=before.get(card), next=card.getBoundingClientRect(); if(!prev) return; const dx=prev.left-next.left, dy=prev.top-next.top; if(!dx&&!dy) return; card.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'translate(0,0)'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'}); }); }
function reorderGlobalMarketCard(targetCard, after){ const dragging=cardsEl.querySelector('.market-slot.dragging'); if(!dragging||!targetCard||dragging===targetCard) return; const before=new Map([...cardsEl.children].map(card=>[card,card.getBoundingClientRect()])); cardsEl.insertBefore(dragging, after?targetCard.nextSibling:targetCard); animateCardMoves(cardsEl, before); }
function getGlobalMarketCardAtPoint(x, y){ const cards=[...cardsEl.querySelectorAll('[data-market-slot]')].filter(card=>card!==cardsEl.querySelector('.market-slot.dragging')); if(!cards.length) return null; return cards.find(card=>{ const rect=card.getBoundingClientRect(); return x>=rect.left && x<=rect.right && y>=rect.top && y<=rect.bottom; }) || null; }
async function ensureGlobalMarketOptions(){ if(globalMarketOptions) return globalMarketOptions; if(!globalMarketOptionsPromise){ const fallback=(globalMarketState?.options||[]).filter(Boolean); globalMarketOptionsPromise=fetch('/api/global-market/options',{cache:'no-store'}).then(r=>r.json()).then(data=>{ globalMarketOptions=(data?.options||[]).filter(Boolean); return globalMarketOptions; }).catch(()=>{ globalMarketOptions=fallback; return globalMarketOptions; }).finally(()=>{ globalMarketOptionsPromise=null; }); } return globalMarketOptionsPromise; }
function openGlobalMarketPicker(index){ if(!globalMarketEditMode)return; globalMarketPickerIndex=index; renderGlobalMarketPicker(); document.body.classList.add('market-picker-open'); }
function closeGlobalMarketPicker(){ globalMarketPickerIndex=null; document.body.classList.remove('market-picker-open'); marketModal.innerHTML=''; }
function renderGlobalMarketPicker(){
  if(globalMarketPickerIndex===null){ marketModal.innerHTML=''; return; }
  const options=globalMarketOptions||[];
  const current=globalMarketDraft?.[globalMarketPickerIndex]||null;
  const used=new Map((globalMarketDraft||[]).map((slot,i)=>[slot?.symbol,i]).filter(([symbol])=>Boolean(symbol)));
  const title='替換第 '+(globalMarketPickerIndex+1)+' 格';
  const subtitle=current?current.name+' · '+current.symbol:'選一個新的國際指數放進這一格';
  const body=options.length?options.map(opt=>{
    const row=opt||{};
    const selected=current?.symbol===row.symbol;
    const usedIndex=used.get(row.symbol);
    const usedFlag=usedIndex!==undefined;
    const alt=usedFlag&&usedIndex!==globalMarketPickerIndex;
    const change=Number.isFinite(row.change)?row.change:null, changePercent=Number.isFinite(row.changePercent)?row.changePercent:null, price=Number.isFinite(row.price)?fmtNumber(row.price,2):'-';
    return '<button class="market-option" type="button" data-market-pick="'+esc(row.symbol)+'"'+(selected?' data-selected="true"':'')+(usedFlag?' data-used="true"':'')+'><div><strong>'+esc(row.name||row.symbol)+'</strong><div class="market-option-meta">'+esc((row.region?row.region+' · ':'')+row.symbol)+'</div></div><div class="market-option-price">'+price+'<span class="market-option-change '+cls(change)+'">'+num(change)+' ('+pct(changePercent)+')'+(alt?' · 已選用':'')+'</span></div></button>';
  }).join(''):'<div class="empty-state">載入中...</div>';
  marketModal.innerHTML='<div class="market-modal-head"><div><h2>'+title+'</h2><div class="market-modal-subtitle">'+esc(subtitle)+'</div></div><div class="detail-actions"><button class="small-btn" data-market-clear>清空此格</button><button class="small-btn" data-market-close-picker>關閉</button></div></div><div class="market-option-list">'+body+'</div>';
}
async function enterGlobalMarketEdit(){ if(globalMarketEditMode)return; await ensureGlobalMarketOptions(); globalMarketDragging=false; globalMarketDraft=cloneSlots(globalMarketState?.slots); globalMarketEditMode=true; globalMarketPickerIndex=null; renderGlobalMarket(); }
function cancelGlobalMarketEdit(){ if(!globalMarketEditMode)return; globalMarketDragging=false; globalMarketDraft=null; globalMarketEditMode=false; closeGlobalMarketPicker(); renderGlobalMarket(); }
function removeGlobalMarketSlot(index){ if(!globalMarketEditMode)return; globalMarketDraft[index]=null; renderGlobalMarket(); if(globalMarketPickerIndex===index) renderGlobalMarketPicker(); }
function applyGlobalMarketSelection(symbol){ if(!globalMarketEditMode||globalMarketPickerIndex===null)return; const option=(globalMarketOptions||[]).find(opt=>opt.symbol===symbol); if(!option)return; const next=cloneSlots(globalMarketDraft||globalMarketState?.slots); for(let i=0;i<next.length;i++) if(i!==globalMarketPickerIndex&&next[i]?.symbol===option.symbol) next[i]=null; next[globalMarketPickerIndex]={...option}; globalMarketDraft=next; renderGlobalMarket(); renderGlobalMarketPicker(); }
async function finishGlobalMarketEdit(){ if(!globalMarketEditMode)return; const payload={slots:normalizeSlots(globalMarketDraft)}; const res=await fetch('/api/global-market',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}); if(!res.ok) throw new Error('HTTP '+res.status); closeGlobalMarketPicker(); globalMarketDragging=false; globalMarketEditMode=false; globalMarketDraft=null; await refreshNow(); }
function updateMarketWindControls(){ const editing=marketWindEditMode; marketWindEditBtn.hidden=editing; marketWindDoneBtn.hidden=!editing; marketWindCancelBtn.hidden=!editing; document.body.classList.toggle('market-wind-edit',editing); }
function windOptionMap(){ return new Map((marketWindOptions||[]).flatMap(group=>(group.options||[]).map(option=>[option.symbol,{...option,group:option.group||group.name}]))); }
function renderWind(){ const options=windOptionMap(), slots=currentWindSlots(); windCardsEl.innerHTML=slots.map((slot,index)=>renderWindCard(slot,index,options)).join(''); updateMarketWindControls(); }
function renderWindCard(slot,index,options){ const row=resolveMarketRow(slot,new Map((marketWindState?.slots||[]).filter(Boolean).map(q=>[q.symbol,q])),options); const editing=marketWindEditMode; if(!row){ return '<div class="wind-card wind-slot empty" draggable="'+(editing?'true':'false')+'" data-wind-slot="'+index+'" data-wind-symbol=""><div class="market-slot-placeholder"><strong>點擊新增指標</strong><span>可替換市場風向項目</span></div></div>'; } const title=esc(row.name||row.symbol), symbol=esc(row.symbol), type=esc(row.type||'市場風向'), name=esc(row.name||row.symbol), change=Number.isFinite(row.change)?row.change:null, changePercent=Number.isFinite(row.changePercent)?row.changePercent:null, price=Number.isFinite(row.price)?fmtNumber(row.price,2):'-'; return '<div class="wind-card wind-slot has-mini-chart" draggable="'+(editing?'true':'false')+'" data-open="'+symbol+'" data-name="'+name+'" data-type="'+type+'" data-wind-slot="'+index+'" data-wind-symbol="'+symbol+'" data-wind-name="'+name+'" data-wind-type="'+type+'">'+(editing?'<div class="market-slot-actions"><button class="small-btn danger market-wind-slot-remove" type="button" data-wind-remove="'+index+'">移除</button></div>':'')+'<div class="card-copy"><div class="wind-title">'+title+'</div><div class="wind-price">'+price+'</div><div class="wind-change '+cls(change)+'">'+num(change)+' ('+pct(changePercent)+')</div></div>'+miniCanvas(row)+'</div>'; }
function syncMarketWindDraftFromDom(){ const options=windOptionMap(); marketWindDraft=normalizeWindSlots([...windCardsEl.querySelectorAll('[data-wind-slot]')].map(card=>{ const symbol=card.dataset.windSymbol; if(!symbol) return null; const option=options.get(symbol); return option?{ symbol:option.symbol,name:option.name,type:option.type,group:option.group }:{ symbol,name:card.dataset.windName||symbol,type:card.dataset.windType||'市場風向' }; })); }
function reorderMarketWindCard(targetCard,after){ const dragging=windCardsEl.querySelector('.wind-slot.dragging'); if(!dragging||!targetCard||dragging===targetCard)return; const before=new Map([...windCardsEl.children].map(card=>[card,card.getBoundingClientRect()])); windCardsEl.insertBefore(dragging,after?targetCard.nextSibling:targetCard); animateCardMoves(windCardsEl,before); }
function getMarketWindCardAtPoint(x,y){ return [...windCardsEl.querySelectorAll('[data-wind-slot]')].find(card=>card!==windCardsEl.querySelector('.wind-slot.dragging')&&x>=card.getBoundingClientRect().left&&x<=card.getBoundingClientRect().right&&y>=card.getBoundingClientRect().top&&y<=card.getBoundingClientRect().bottom)||null; }
async function ensureMarketWindOptions(){ if(marketWindOptions)return marketWindOptions; if(!marketWindOptionsPromise){ const fallback=marketWindState?.groups||[]; marketWindOptionsPromise=fetch('/api/market-wind/options',{cache:'no-store'}).then(r=>r.json()).then(data=>{ marketWindOptions=data?.groups||[]; return marketWindOptions; }).catch(()=>{ marketWindOptions=fallback; return marketWindOptions; }).finally(()=>{ marketWindOptionsPromise=null; }); } return marketWindOptionsPromise; }
function openMarketWindPicker(index){ if(!marketWindEditMode)return; marketWindPickerIndex=index; renderMarketWindPicker(); document.body.classList.add('market-picker-open'); }
function closeMarketWindPicker(){ marketWindPickerIndex=null; document.body.classList.remove('market-picker-open'); marketModal.innerHTML=''; }
function renderMarketWindPicker(){ if(marketWindPickerIndex===null){ marketModal.innerHTML=''; return; } const current=marketWindDraft?.[marketWindPickerIndex]||null, used=new Map((marketWindDraft||[]).map((slot,index)=>[slot?.symbol,index]).filter(([symbol])=>Boolean(symbol))); const body=(marketWindOptions||[]).map(group=>'<section class="market-option-group"><h3>'+esc(group.name)+'</h3><div class="market-option-list">'+(group.options||[]).map(option=>{ const selected=current?.symbol===option.symbol, usedIndex=used.get(option.symbol), usedElsewhere=usedIndex!==undefined&&usedIndex!==marketWindPickerIndex, change=Number.isFinite(option.change)?option.change:null, percent=Number.isFinite(option.changePercent)?option.changePercent:null; return '<button class="market-option" type="button" data-wind-pick="'+esc(option.symbol)+'"'+(selected?' data-selected="true"':'')+(usedIndex!==undefined?' data-used="true"':'')+'><div><strong>'+esc(option.name||option.symbol)+'</strong><div class="market-option-meta">'+esc(group.name+' · '+option.symbol)+'</div></div><div class="market-option-price">'+(Number.isFinite(option.price)?fmtNumber(option.price,2):'-')+'<span class="market-option-change '+cls(change)+'">'+num(change)+' ('+pct(percent)+')'+(usedElsewhere?' · 已選用':'')+'</span></div></button>'; }).join('')+'</div></section>').join(''); marketModal.innerHTML='<div class="market-modal-head"><div><h2>替換第 '+(marketWindPickerIndex+1)+' 格</h2><div class="market-modal-subtitle">'+esc(current?current.name+' · '+current.symbol:'選一個市場風向指標放進這一格')+'</div></div><div class="detail-actions"><button class="small-btn" data-wind-clear>清空此格</button><button class="small-btn" data-wind-close-picker>關閉</button></div></div>'+body; }
async function enterMarketWindEdit(){ if(marketWindEditMode)return; await ensureMarketWindOptions(); marketWindDragging=false; marketWindDraft=cloneWindSlots(marketWindState?.slots); marketWindEditMode=true; marketWindPickerIndex=null; renderWind(); }
function cancelMarketWindEdit(){ if(!marketWindEditMode)return; marketWindDragging=false; marketWindDraft=null; marketWindEditMode=false; closeMarketWindPicker(); renderWind(); }
function removeMarketWindSlot(index){ if(!marketWindEditMode)return; marketWindDraft[index]=null; renderWind(); if(marketWindPickerIndex===index)renderMarketWindPicker(); }
function applyMarketWindSelection(symbol){ if(!marketWindEditMode||marketWindPickerIndex===null)return; const option=windOptionMap().get(symbol); if(!option)return; const next=cloneWindSlots(marketWindDraft||marketWindState?.slots); for(let index=0;index<next.length;index++)if(index!==marketWindPickerIndex&&next[index]?.symbol===option.symbol)next[index]=null; next[marketWindPickerIndex]={ symbol:option.symbol,name:option.name,type:option.type,group:option.group }; marketWindDraft=next; renderWind(); renderMarketWindPicker(); }
async function finishMarketWindEdit(){ if(!marketWindEditMode)return; const res=await fetch('/api/market-wind',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slots:normalizeWindSlots(marketWindDraft)})}); if(!res.ok)throw new Error('HTTP '+res.status); closeMarketWindPicker(); marketWindDragging=false; marketWindEditMode=false; marketWindDraft=null; await refreshNow(); }
function miniCanvas(q,extra=''){ return '<canvas class="mini-chart '+extra+'" data-mini-chart data-symbol="'+esc(q.symbol)+'" aria-hidden="true"></canvas>'; }
function drawMiniCharts(){ const quotes=new Map([...optionMap(),...quoteMap()]); document.querySelectorAll('[data-mini-chart]').forEach(canvas=>{ const q=quotes.get(canvas.dataset.symbol), data=(q?.sparkline||[]).map(x=>Number(x.close)).filter(Number.isFinite), box=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1, ctx=canvas.getContext('2d'); canvas.width=Math.max(1,Math.floor(box.width*dpr)); canvas.height=Math.max(1,Math.floor(box.height*dpr)); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,box.width,box.height); if(data.length<2)return; const min=Math.min(...data), max=Math.max(...data), spread=Math.max(max-min,Math.abs(max)*.002,.01), lo=min-spread*.12, hi=max+spread*.12, x=i=>i/(data.length-1)*box.width, y=v=>8+(hi-v)/(hi-lo)*(box.height-16), up=(q?.change||0)>=0, color=getComputedStyle(document.body).getPropertyValue(up?'--red':'--green').trim(); const grad=ctx.createLinearGradient(0,0,0,box.height); grad.addColorStop(0,color+'40'); grad.addColorStop(1,color+'00'); ctx.beginPath(); data.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v))); ctx.lineTo(box.width,box.height-4); ctx.lineTo(0,box.height-4); ctx.closePath(); ctx.fillStyle=grad; ctx.fill(); ctx.beginPath(); data.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v))); ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.shadowColor=color+'55'; ctx.shadowBlur=8; ctx.stroke(); }); }
function formatCurrencyAmount(value){ return Number.isFinite(value)?Number(value).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2}):'-'; }
function renderCurrency(){
  if(!currencyState) return;
  currencyOptions=currencyOptionList();
  renderCurrencySelects();
  renderCurrencyFavorites();
  renderCurrencyTable();
  updateCurrencyResult();
  requestAnimationFrame(drawMiniCharts);
}
function renderCurrencySelects(){
  const options=(currencyOptions||[]).map(option=>'<option value="'+esc(option.code)+'">'+esc(currencyLabel(option))+'</option>').join('');
  if(currencyFromSelect){ currencyFromSelect.innerHTML=options; currencyFromSelect.value=currencyState?.from||'USD'; }
  if(currencyToSelect){ currencyToSelect.innerHTML=options; currencyToSelect.value=currencyState?.to||'TWD'; }
  if(currencyAmountInput && !currencyAmountInput.value) currencyAmountInput.value='1000';
}
function renderCurrencyFavorites(){
  if(!currencyFavoritesListEl) return;
  const rows=(currencyState?.favorites||[]).filter(code=>code!=='TWD').map(code=>activeCurrencyQuote(code)).filter(Boolean);
  currencyFavoritesListEl.innerHTML=rows.map(row=>'<button class="currency-favorite-chip '+((currencyState?.from===row.code||currencyState?.to===row.code)?'active':'')+'" type="button" data-currency-favorite="'+esc(row.code)+'"><span class="currency-flag">'+currencyFlag(row)+'</span><span class="currency-favorite-copy"><strong>'+esc(currencyLabel(row))+'</strong><span>點擊快速帶入</span></span></button>').join('');
}
function renderCurrencyTable(){
  if(!currencyTableBodyEl) return;
  const rows=(currencyState?.quotes||[]).filter(row=>row.code!=='TWD').map(row=>'<tr><td><div class="currency-row-main"><span class="currency-flag">'+currencyFlag(row)+'</span><div class="currency-row-copy"><strong>'+esc(currencyDisplayName(row))+'</strong><span>'+esc(currencyLabel(row))+'</span></div></div></td><td>'+esc(row.code||'-')+'</td><td>'+formatCurrencyAmount(row.rate)+'</td><td class="'+cls(row.change)+'">'+num(row.change)+'</td><td class="'+cls(row.changePercent)+'">'+pct(row.changePercent)+'</td><td>'+((row.sparkline||[]).length>1?miniCanvas({symbol:row.symbol||row.code,change:row.change,sparkline:row.sparkline},'table-mini-chart'):'<span class="muted">-</span>')+'</td><td><button class="currency-star-btn '+((currencyState?.favorites||[]).includes(row.code)?'active':'')+'" type="button" data-currency-toggle-favorite="'+esc(row.code)+'" aria-label="切換常用貨幣"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.9l2.8 5.68 6.27.91-4.53 4.42 1.07 6.24L12 17.2 6.38 20.15l1.07-6.24L2.92 9.49l6.27-.91L12 2.9z"/></svg></button></td></tr>').join('');
  currencyTableBodyEl.innerHTML=rows;
}
function updateCurrencyResult(){
  if(!currencyState) return;
  currencyState.from=currencyFromSelect?.value||currencyState.from||'USD';
  currencyState.to=currencyToSelect?.value||currencyState.to||'TWD';
  const amount=Number(currencyAmountInput?.value||0), value=convertCurrencyAmount(amount,currencyState.from,currencyState.to), fromQuote=activeCurrencyQuote(currencyState.from), pairRate=convertCurrencyAmount(1,currencyState.from,currencyState.to), updatedAt=currencyUpdatedAt();
  if(currencyResultValueEl) currencyResultValueEl.textContent=formatCurrencyAmount(value);
  if(currencyRateTextEl) currencyRateTextEl.textContent='1 '+(currencyState.from||'-')+' = '+formatCurrencyAmount(pairRate)+' '+(currencyState.to||'-');
  if(currencyChangeTextEl){ currencyChangeTextEl.textContent='TWD 基準: '+num(fromQuote?.change)+' ('+pct(fromQuote?.changePercent)+')'; currencyChangeTextEl.className=''; currencyChangeTextEl.classList.add(cls(fromQuote?.change)); }
  if(currencyUpdatedTimeEl) currencyUpdatedTimeEl.textContent=fmtTime(updatedAt);
}
async function persistCurrencyState(snapshot){
  if(!currencyState) return;
  const payload=snapshot||{favorites:[...(currencyState.favorites||[])],from:currencyState.from,to:currencyState.to};
  const revision=++currencyPersistRevision;
  currencyLocalSnapshot={...payload,favorites:[...(payload.favorites||[])]};
  currencyPersistPromise=currencyPersistPromise.catch(()=>{}).then(async()=>{
    if(revision!==currencyPersistRevision) return;
    const response=await fetch('/api/currency',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok) throw new Error('HTTP '+response.status);
    if(revision===currencyPersistRevision) currencyLocalSnapshot=null;
  });
  return currencyPersistPromise;
}
async function setCurrencyPair(from,to,{persist=true}={}){
  if(!currencyState) return;
  currencyState.from=from;
  currencyState.to=to;
  updateCurrencyResult();
  renderCurrencyFavorites();
  if(persist) await persistCurrencyState({favorites:[...(currencyState.favorites||[])],from,to});
}
function currencyFavoritePair(code){
  const currentFrom=currencyState?.from||'USD';
  const currentTo=currencyState?.to||'TWD';
  if(code===currentFrom) return { from:currentFrom, to:currentTo };
  if(code===currentTo) return { from:code, to:currentFrom===code?'TWD':currentFrom };
  return { from:code, to:currentTo===code?currentFrom:currentTo };
}
async function toggleCurrencyFavorite(code){
  if(!currencyState) return;
  if(code==='TWD') return;
  const next=[...(currencyState.favorites||[])];
  const index=next.indexOf(code);
  if(index>=0) next.splice(index,1);
  else {
    if(next.length>=CURRENCY_FAVORITES_LIMIT) next.shift();
    next.push(code);
  }
  currencyState.favorites=next;
  renderCurrencyFavorites();
  renderCurrencyTable();
  await persistCurrencyState({favorites:[...next],from:currencyState.from,to:currencyState.to});
}
function openCurrencyPicker(mode){
  currencyPickerMode=mode;
  const rows=currencyOptionList().filter(row=>mode==='favorites'?row.code!=='TWD':true);
  if(!rows.length) return;
  const favorites=new Set(currencyState?.favorites||[]);
  const title=mode==='favorites'?'管理常用貨幣':mode==='from'?'選擇來源幣別':'選擇目標幣別';
  const body=rows.map(row=>'<button class="currency-option-button" type="button" data-currency-option="'+esc(row.code)+'"'+((mode!=='favorites'&&currencyState?.[mode]===row.code)?' data-selected="true"':'')+((favorites.has(row.code)&&mode==='favorites')?' data-active="true"':'')+'><span class="currency-row-main"><span class="currency-flag">'+currencyFlag(row)+'</span><span class="currency-row-copy"><strong>'+esc(currencyLabel(row))+'</strong><small>'+esc(row.code)+' 對 TWD '+formatCurrencyAmount(row.rate)+'</small></span></span><strong>'+(mode==='favorites'?(favorites.has(row.code)?'已加入':'加入'):'選擇')+'</strong></button>').join('');
  marketModal.innerHTML='<div class="market-modal-head"><div><h2>'+title+'</h2><div class="market-modal-subtitle">'+(mode==='favorites'?'最多保留 '+CURRENCY_FAVORITES_LIMIT+' 個常用貨幣。':'切換後會立即更新換算結果。')+'</div></div><button class="small-btn" type="button" data-currency-close-picker>關閉</button></div><div class="currency-modal-grid">'+body+'</div>';
  document.body.classList.add('market-picker-open');
}
function closeCurrencyPicker(){ currencyPickerMode=null; if(document.body.classList.contains('market-picker-open')&&marketWindPickerIndex===null&&globalMarketPickerIndex===null){ document.body.classList.remove('market-picker-open'); } if(currencyPickerMode===null&&marketWindPickerIndex===null&&globalMarketPickerIndex===null) marketModal.innerHTML=''; }
async function handleCurrencyOptionPick(code){
  if(!currencyState||!currencyPickerMode) return;
  if(currencyPickerMode==='favorites'){ await toggleCurrencyFavorite(code); openCurrencyPicker('favorites'); return; }
  currencyState[currencyPickerMode]=code;
  if(currencyPickerMode==='from'&&currencyFromSelect) currencyFromSelect.value=code;
  if(currencyPickerMode==='to'&&currencyToSelect) currencyToSelect.value=code;
  updateCurrencyResult();
  renderCurrencyFavorites();
  await persistCurrencyState({favorites:[...(currencyState.favorites||[])],from:currencyState.from,to:currencyState.to});
  closeCurrencyPicker();
}
async function refreshCurrencyOnly(){
  if(currencyRefreshButton?.classList.contains('spinning')) return;
  currencyRefreshButton?.classList.add('spinning');
  try{
    const [currencyRes, currencyOptionsRes] = await Promise.all([fetch('/api/currency',{cache:'no-store'}), fetch('/api/currency/options',{cache:'no-store'})]);
    currencyState=applyCurrencyServerState(await currencyRes.json());
    const optionsData=await currencyOptionsRes.json();
    currencyOptions=optionsData?.options||currencyState?.quotes||[];
    if(activeModule==='currency') renderCurrency();
  } finally {
    setTimeout(()=>currencyRefreshButton?.classList.remove('spinning'),650);
  }
}

function renderNewsTabs(){
  if(!newsTabsEl) return;
  newsTabsEl.innerHTML=NEWS_CATEGORIES.map(([key,label])=>'<button class="news-tab '+(key===activeNewsCategory?'active':'')+'" type="button" data-news-category="'+esc(key)+'">'+esc(label)+'</button>').join('');
}
function newsDate(value){
  if(!value) return '-';
  const date=new Date(value), now=Date.now(), diff=Math.max(0,now-date.getTime()), minutes=Math.floor(diff/60000);
  if(minutes<1) return '剛剛';
  if(minutes<60) return minutes+' 分鐘前';
  const hours=Math.floor(minutes/60);
  if(hours<24) return hours+' 小時前';
  return date.toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit'});
}
function newsImageMarkup(article,large=false){
  if(article?.image) return '<img class="'+(article.imageKind==='source'?'news-source-logo':'')+'" src="'+esc(article.image)+'" alt="" loading="lazy">';
  return '<div class="news-image-fallback '+(large?'large':'')+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5h16v11H4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 10h5M7 13h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>';
}
function renderNewsCard(article,featured=false){
  const label=NEWS_CATEGORIES.find(([key])=>key===article.category)?.[1]||article.category||'新聞';
  return '<article class="news-card '+(featured?'featured':'')+'" data-news-open="'+esc(article.url)+'"><div class="news-thumb">'+newsImageMarkup(article,featured)+'</div><div class="news-card-copy"><div class="news-meta"><span>'+esc(label)+'</span><span>'+esc(article.source||'新聞來源')+'</span><span>'+newsDate(article.publishedAt)+'</span></div><h2>'+esc(article.title)+'</h2><p>'+esc(article.summary||'')+'</p><div class="news-card-foot"><span>'+esc(article.language||'')+'</span><strong>閱讀原文</strong></div></div></article>';
}
function renderNews(){
  renderNewsTabs();
  if(!newsGridEl) return;
  if(newsLoading&&!newsState){ newsGridEl.innerHTML='<div class="news-empty">正在整理最新財經新聞...</div>'; return; }
  const rows=newsState?.articles||[];
  if(newsUpdatedTimeEl) newsUpdatedTimeEl.textContent=fmtTime(newsState?.fetchedAt);
  if(!rows.length){ newsGridEl.innerHTML='<div class="news-empty">暫時沒有取得新聞，稍後再試。</div>'; return; }
  const featured=rows[0], rest=rows.slice(1);
  const warnings=(newsState?.warnings||[]).length?'<div class="news-warning">部分來源暫時無法讀取，已顯示可用新聞。</div>':'';
  newsGridEl.innerHTML=warnings+'<div class="news-feature">'+renderNewsCard(featured,true)+'</div><div class="news-list">'+rest.map(article=>renderNewsCard(article,false)).join('')+'</div>';
}
async function refreshNewsOnly({force=false}={}){
  if(newsLoading&&!force) return;
  newsLoading=true;
  newsRefreshButton?.classList.add('spinning');
  renderNews();
  try{
    const res=await fetch('/api/news?category='+encodeURIComponent(activeNewsCategory),{cache:'no-store'});
    newsState=await res.json();
    renderNews();
  } finally {
    newsLoading=false;
    setTimeout(()=>newsRefreshButton?.classList.remove('spinning'),650);
  }
}

function watchlists(){
  if(Array.isArray(latest?.watchlists)&&latest.watchlists.length)return latest.watchlists;
  const legacy=(latest?.groups||[]).find(group=>group.name==='自選股');
  return legacy?[{id:'default',name:'自選股',locked:true,quotes:legacy.quotes||[]}]:[];
}
function activeWatchlist(){ const lists=watchlists(); if(!lists.length)return {id:'',name:'自選股',locked:true,quotes:[]}; let list=lists.find(x=>x.id===activeWatchlistId)||lists[0]; activeWatchlistId=list.id; localStorage.setItem('activeWatchlistId',activeWatchlistId); return list; }
function watchlistIdsForSymbol(symbol){ return watchlists().filter(list=>(list.quotes||[]).some(q=>q.symbol===symbol)).map(list=>list.id); }
function isInAnyWatchlist(symbol){ return watchlistIdsForSymbol(symbol).length>0; }
function watchlistTabs(lists,activeId){ return '<div class="watch-tabs">'+lists.map(list=>'<button class="watch-tab '+(list.id===activeId?'active':'')+'" type="button" data-watchlist-tab="'+esc(list.id)+'"><span>'+esc(list.name)+'</span><em>'+(list.quotes||[]).length+'</em></button>').join('')+'</div>'; }
function getWatchTabsScrollLeft(){ return watchPanel.querySelector('.watch-tabs')?.scrollLeft||0; }
function restoreWatchTabsScrollLeft(left){
  const tabs=watchPanel.querySelector('.watch-tabs');
  if(!tabs) return;
  const max=Math.max(0,tabs.scrollWidth-tabs.clientWidth);
  tabs.scrollLeft=Math.min(Math.max(left,0),max);
}
function renderWatch(){
  const tabsScrollLeft=getWatchTabsScrollLeft();
  const lists=watchlists(), current=activeWatchlist(), rows=current.quotes||[];
  const head='<div class="panel-head watch-head"><div class="watch-title"><div class="section-title">'+sectionTitleIcon('watch')+'<h2>自選股</h2></div></div><div class="watch-toolbar">'+watchlistTabs(lists,current.id)+'<div class="watch-head-actions"><button class="small-btn" type="button" data-watchlist-create>新增清單</button><button class="small-btn" type="button" data-watchlist-manage>管理</button><div class="watch-view-toggle" role="group" aria-label="自選股顯示模式"><button class="small-btn '+(watchViewMode==='cards'?'active':'')+'" type="button" data-watch-view="cards">卡片</button><button class="small-btn '+(watchViewMode==='table'?'active':'')+'" type="button" data-watch-view="table">列表</button></div></div></div></div>';
  watchPanel.innerHTML=head+'<div class="watch-body" data-watch-mode="'+watchViewMode+'">'+(watchViewMode==='cards'?renderWatchCards(rows):renderWatchTable(rows))+'</div>';
  requestAnimationFrame(()=>restoreWatchTabsScrollLeft(tabsScrollLeft));
}
function renderWatchTable(rows){ return '<div class="watch-scroll">'+table(['名稱','代號','現價','漲跌','漲跌幅','成交量','市場','走勢','操作'], rows.map(q=>[q.name,q.symbol,fmtNumber(q.price,2),num(q.change),pct(q.changePercent),fmtInt(q.volume),q.type, miniCanvas(q,'table-mini-chart'), '<button class="small-btn danger" data-remove="'+esc(q.symbol)+'">刪除</button>',q]), true)+'</div>'; }
function renderWatchCards(rows){ return '<div class="watch-card-grid">'+(rows.length?rows.map(q=>{ const change=Number.isFinite(q.change)?q.change:null, changePercent=Number.isFinite(q.changePercent)?q.changePercent:null; return '<div class="card watch-card has-mini-chart" draggable="true" data-watch-card data-open="'+esc(q.symbol)+'" data-name="'+esc(q.name)+'" data-type="'+esc(q.type)+'"><button class="small-btn danger watch-card-remove" type="button" data-remove="'+esc(q.symbol)+'">刪除</button><div class="card-copy"><div class="card-title">'+esc(q.name||q.symbol)+'</div><div class="watch-card-symbol muted">'+esc(q.symbol)+' · '+esc(q.type||'')+'</div><div class="card-price">'+fmtNumber(q.price,2)+'</div><div class="card-change '+cls(change)+'">'+num(change)+' ('+pct(changePercent)+')</div><div class="watch-card-volume muted">量 '+fmtInt(q.volume)+'</div></div>'+miniCanvas(q)+'</div>'; }).join(''):'<div class="empty-state">尚未加入自選股</div>')+'</div>'; }
function beginWatchTabsDrag(e){
  const tabs=e.target.closest('.watch-tabs');
  if(!tabs||e.button!==0||e.target.closest('button')?.disabled) return;
  watchTabsDrag={tabs,startX:e.clientX,startY:e.clientY,startScrollLeft:tabs.scrollLeft,pointerId:e.pointerId,dragging:false,dragged:false};
}
function updateWatchTabsDrag(e){
  if(!watchTabsDrag||e.pointerId!==watchTabsDrag.pointerId) return;
  const dx=e.clientX-watchTabsDrag.startX;
  const dy=e.clientY-watchTabsDrag.startY;
  if(!watchTabsDrag.dragging && Math.max(Math.abs(dx),Math.abs(dy))<6) return;
  if(!watchTabsDrag.dragging){
    watchTabsDrag.dragging=true;
    watchTabsDrag.tabs.classList.add('dragging');
    document.body.classList.add('watch-tabs-dragging');
    watchTabsDrag.tabs.setPointerCapture?.(e.pointerId);
  }
  watchTabsDrag.dragged=true;
  watchTabsDrag.tabs.scrollLeft=watchTabsDrag.startScrollLeft-dx;
  e.preventDefault();
}
function endWatchTabsDrag(e){
  if(!watchTabsDrag||e.pointerId!==watchTabsDrag.pointerId) return;
  const tabs=watchTabsDrag.tabs;
  tabs.releasePointerCapture?.(e.pointerId);
  tabs.classList.remove('dragging');
  document.body.classList.remove('watch-tabs-dragging');
  if(watchTabsDrag.dragged){
    watchTabsClickSuppressed=true;
    setTimeout(()=>{ watchTabsClickSuppressed=false; },0);
  }
  watchTabsDrag=null;
}
async function switchWatchlist(nextId){
  if(nextId===activeWatchlistId||watchViewAnimating)return;
  const lists=watchlists();
  const currentIndex=lists.findIndex(list=>list.id===activeWatchlistId);
  const nextIndex=lists.findIndex(list=>list.id===nextId);
  const direction=nextIndex>currentIndex?1:-1;
  const body=watchPanel.querySelector('.watch-body');
  const oldHeight=watchPanel.offsetHeight;
  watchDragging=false;
  watchViewAnimating=true;
  watchPanel.classList.add('watch-view-animating');
  if(body){
    await body.animate([
      {opacity:1,transform:'translateX(0) scale(1)'},
      {opacity:0,transform:'translateX('+(direction*-12)+'px) scale(.985)'}
    ],{duration:140,easing:'cubic-bezier(.4,0,.2,1)'}).finished.catch(()=>{});
  }
  activeWatchlistId=nextId;
  localStorage.setItem('activeWatchlistId',activeWatchlistId);
  watchPanel.style.minHeight=oldHeight+'px';
  renderWatch();
  drawMiniCharts();
  const nextBody=watchPanel.querySelector('.watch-body');
  const newHeight=watchPanel.scrollHeight;
  const heightAnim=watchPanel.animate([{minHeight:oldHeight+'px'},{minHeight:newHeight+'px'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});
  const bodyAnim=nextBody?.animate([
    {opacity:0,transform:'translateX('+(direction*12)+'px) scale(.985)'},
    {opacity:1,transform:'translateX(0) scale(1)'}
  ],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'});
  Promise.allSettled([heightAnim.finished,bodyAnim?.finished]).finally(()=>{watchPanel.style.minHeight=''; watchViewAnimating=false; watchPanel.classList.remove('watch-view-animating'); drawMiniCharts();});
}
async function switchWatchView(nextMode){
  if(nextMode===watchViewMode||watchViewAnimating)return;
  const rows=activeWatchlist().quotes||[], body=watchPanel.querySelector('.watch-body'), oldHeight=watchPanel.offsetHeight;
  watchDragging=false; watchViewAnimating=true;
  watchPanel.classList.add('watch-view-animating');
  if(body){
    await body.animate([
      {opacity:1,transform:'translateY(0) scale(1)'},
      {opacity:0,transform:'translateY(-8px) scale(.985)'}
    ],{duration:140,easing:'cubic-bezier(.4,0,.2,1)'}).finished.catch(()=>{});
  }
  watchViewMode=nextMode;
  localStorage.setItem('watchViewMode',watchViewMode);
  watchPanel.style.minHeight=oldHeight+'px';
  renderWatch(rows);
  drawMiniCharts();
  const nextBody=watchPanel.querySelector('.watch-body'), newHeight=watchPanel.scrollHeight;
  const heightAnim=watchPanel.animate([{minHeight:oldHeight+'px'},{minHeight:newHeight+'px'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});
  const bodyAnim=nextBody?.animate([
    {opacity:0,transform:'translateY(12px) scale(.985)'},
    {opacity:1,transform:'translateY(0) scale(1)'}
  ],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'});
  Promise.allSettled([heightAnim.finished,bodyAnim?.finished]).finally(()=>{watchPanel.style.minHeight=''; watchViewAnimating=false; watchPanel.classList.remove('watch-view-animating'); drawMiniCharts();});
}
function renderRankings(){ if(!rankPanel)return; const tabs=[['gainers','熱門股漲幅'],['losers','熱門股跌幅'],['volume','成交量排行'],['global','國際指數排行']], key=activeRankTab; let body; if(key==='global'){ const rows=rankings?.global||[]; body=rankList(rows.slice(0,10),key)+'<button class="rank-more" data-rank-more="global">查看更多 ›</button>'; } else { const market=rankMarkets[key], rows=rankings?.markets?.[market]?.[key]||[]; body='<div class="rank-head">'+marketSelect(key,market)+'</div>'+rankNote(key,market)+rankList(rows.slice(0,10),key)+'<button class="rank-more" data-rank-more="'+key+'">查看更多 ›</button>'; } rankPanel.innerHTML='<div class="rank-tabs">'+tabs.map(([k,label])=>'<button class="rank-tab'+(k===key?' active':'')+'" data-rank-tab="'+k+'">'+label+'</button>').join('')+'</div><div class="rank-scroll">'+body+'</div>'; }
function marketSelect(key,market){ return '<select class="rank-select" data-rank-market="'+key+'"><option value="tw" '+(market==='tw'?'selected':'')+'>台股</option><option value="us" '+(market==='us'?'selected':'')+'>美股</option></select>'; }
function rankNote(key,market){ if(key!=='gainers'&&key!=='losers')return ''; const fallback=market==='tw'&&(rankings?.meta?.twFallbackReason||rankings?.meta?.tw?.twFallbackReason)==='missing_turnover'; const text=fallback?'資料不足，暫用原排行':market==='tw'?'排除 ETF，成交金額 ≥ 5 億，市值 ≥ 500 億':'大型股優先'; return '<div class="rank-note">'+text+'</div>'; }
function rankList(rows,mode){ return '<div class="rank-list">'+(rows.length?rows.map((q,i)=>{ const mid=mode==='volume'?fmtInt(q.volume):num(q.change), tail=pct(q.changePercent); return '<div class="rank-row" data-open="'+esc(q.symbol)+'" data-name="'+esc(q.name)+'" data-type="'+esc(q.type)+'"><span class="rank-no">'+(i+1)+'</span><span class="rank-name"><strong>'+esc(q.name)+'</strong><em>'+esc(q.symbol.replace(/^\^/,''))+'</em></span><span class="rank-price">'+fmtNumber(q.price,2)+'</span><span class="'+(mode==='volume'?'':cls(q.change))+'">'+mid+'</span><span class="'+cls(q.changePercent)+'">'+tail+'</span></div>'; }).join(''):'<div class="rank-empty">目前沒有符合條件的標的</div>')+'</div>'; }
function openRankModal(key){ const market=rankMarkets[key]||'tw', title=key==='global'?'國際大盤指數漲幅排行':(key==='gainers'?'熱門股漲幅':key==='losers'?'熱門股跌幅':'成交量排行')+(key==='global'?'':' · '+(market==='tw'?'台股':'美股')), rows=key==='global'?(rankings?.global||[]):rankings?.markets?.[market]?.[key]||[]; rankModal.innerHTML='<div class="rank-modal-head"><h2>'+title+'</h2><button class="small-btn" data-close-rank>關閉</button></div>'+rankNote(key,market)+rankList(rows.slice(0,20),key); document.body.classList.add('rank-open'); }
function closeRankModal(){ document.body.classList.remove('rank-open'); rankModal.innerHTML=''; }
async function refreshNow(){ if(refreshButton.classList.contains('spinning'))return; refreshButton.classList.add('spinning'); const quoteTask=fetchJson('/api/quotes'); const sideTasks=loadDashboardSideData(); try{ latest=await quoteTask; setRefreshTime(); renderAll(); if(activeModule==='currency') renderCurrency(); await refreshDetail().catch(()=>{}); } finally{ await Promise.allSettled(sideTasks); setTimeout(()=>refreshButton.classList.remove('spinning'),800); } }
function table(headers, rows, draggable=false){ return '<table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>{ const q=r[r.length-1]; return '<tr '+(draggable?'draggable="true" data-watch-row ':'')+'data-open="'+esc(q.symbol)+'" data-name="'+esc(q.name)+'" data-type="'+esc(q.type)+'">'+r.slice(0,-1).map((c,i)=>'<td class="'+(String(c).includes('▲')?'up':String(c).includes('▼')?'down':String(c).includes('+')?'up':String(c).includes('-')?'down':'')+'">'+c+'</td>').join('')+'</tr>'; }).join('')+'</tbody></table>'; }
function num(v){ return Number.isFinite(v)?(v>0?'+':'')+fmtNumber(v,2):'-'; } function pct(v){ return Number.isFinite(v)?(v>0?'▲ ':v<0?'▼ ':'')+fmtNumber(Math.abs(v),2)+'%':'-'; } function money(v){ return Number.isFinite(v)?(v>0?'+':'')+fmtNumber(v,2):'-'; }
async function search(){ const q=searchEl.value.trim(); if(!q){suggestEl.innerHTML='';return;} suggestEl.innerHTML='<div class="pick muted">搜尋中...</div>'; const res=await fetch('/api/search?market='+encodeURIComponent(marketEl.value)+'&q='+encodeURIComponent(q),{cache:'no-store'}); const items=await res.json(); suggestEl.innerHTML=items.map(x=>{const inW=isInAnyWatchlist(x.symbol);return '<div class="pick" data-open="'+esc(x.symbol)+'" data-name="'+esc(x.name)+'" data-type="'+esc(x.type)+'"><div><strong>'+esc(x.symbol)+'</strong> <span>'+esc(x.type)+' '+esc(x.name)+'</span></div><button class="'+(inW?'small-btn':'')+'" data-watch-pick="'+esc(x.symbol)+'" data-name="'+esc(x.name)+'" data-type="'+esc(x.type)+'">'+(inW?'管理自選':'加入自選')+'</button></div>';}).join('')||'<div class="pick muted">沒有結果</div>'; }
function openWatchlistPicker(symbol,name,type){ watchlistPickerQuote={symbol,name,type}; renderWatchlistPicker(); document.body.classList.add('watchlist-picker-open'); }
function closeWatchlistPicker(){ watchlistPickerQuote=null; watchlistDialog=null; document.body.classList.remove('watchlist-picker-open'); watchlistModal.innerHTML=''; }
function renderWatchlistPicker(){ const q=watchlistPickerQuote; if(!q){watchlistModal.innerHTML='';return;} const ids=new Set(watchlistIdsForSymbol(q.symbol)); const rows=watchlists().map(list=>'<label class="watchlist-choice"><input type="checkbox" data-watchlist-membership="'+esc(list.id)+'" '+(ids.has(list.id)?'checked':'')+'><span><strong>'+esc(list.name)+'</strong><em>'+(list.quotes||[]).length+' 檔</em></span></label>').join(''); watchlistModal.innerHTML='<div class="watchlist-modal-head"><div><h2>加入自選清單</h2><div class="market-modal-subtitle">'+esc(q.symbol)+' · '+esc(q.name||'')+'</div></div><button class="small-btn" data-close-watchlist-picker>關閉</button></div><div class="watchlist-choice-list">'+rows+'</div>'; }
async function toggleWatchlistMembership(listId, checked){ const q=watchlistPickerQuote; if(!q)return; const url='/api/watchlists/'+encodeURIComponent(listId)+'/'+(checked?'add':'remove'); await post(url,{symbol:q.symbol,name:q.name,type:q.type}); await reloadWatch(); if(detailData)renderDetail(); if(searchEl.value.trim())await search(); renderWatchlistPicker(); }
async function post(url, body){ const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error('HTTP '+r.status); }
async function patchJson(url, body){ const r=await fetch(url,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
async function deleteJson(url){ const r=await fetch(url,{method:'DELETE'}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
async function reorderWatchlistsApi(watchlistIds){ const r=await fetch('/api/watchlists/reorder',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({watchlistIds})}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
function openWatchlistNameDialog(mode){ const current=activeWatchlist(), isRename=mode==='rename', title=isRename?'重新命名清單':'新增清單', value=isRename?current.name:''; watchlistPickerQuote=null; watchlistDialog={mode,id:current.id}; watchlistModal.innerHTML='<form class="watchlist-form" data-watchlist-form><div class="watchlist-modal-head"><div><h2>'+title+'</h2><div class="market-modal-subtitle">'+(isRename?'替「'+esc(current.name)+'」取一個更清楚的名稱':'建立新的自選分類，例如台股、美股、ETF')+'</div></div><button class="small-btn" type="button" data-close-watchlist-picker>關閉</button></div><label class="watchlist-field"><span>清單名稱</span><input class="watchlist-input" name="name" maxlength="40" autocomplete="off" placeholder="輸入清單名稱" value="'+esc(value)+'"></label><div class="watchlist-error" data-watchlist-error hidden></div><div class="watchlist-modal-actions"><button class="small-btn" type="button" data-close-watchlist-picker>取消</button><button class="small-btn primary" type="submit" data-watchlist-submit>'+(isRename?'儲存名稱':'建立清單')+'</button></div></form>'; document.body.classList.add('watchlist-picker-open'); requestAnimationFrame(()=>{ const input=watchlistModal.querySelector('.watchlist-input'); input?.focus(); input?.select(); }); }
function openWatchlistDeleteDialog(){ const current=activeWatchlist(); if(watchlists().length<=1)return; watchlistPickerQuote=null; watchlistDialog={mode:'delete',id:current.id,name:current.name}; watchlistModal.innerHTML='<div class="watchlist-modal-head"><div><h2>刪除清單</h2><div class="market-modal-subtitle">這只會移除清單，不會刪除股票資料。</div></div><button class="small-btn" type="button" data-close-watchlist-picker>關閉</button></div><div class="watchlist-danger-box"><strong>確定要刪除「'+esc(current.name)+'」嗎？</strong><span>清單內的 '+((current.quotes||[]).length)+' 檔股票會從這個分類移除。</span></div><div class="watchlist-error" data-watchlist-error hidden></div><div class="watchlist-modal-actions"><button class="small-btn" type="button" data-close-watchlist-picker>取消</button><button class="small-btn danger-confirm" type="button" data-watchlist-confirm-delete>確認刪除</button></div>'; document.body.classList.add('watchlist-picker-open'); }
function openWatchlistManageDialog(){ const current=activeWatchlist(), canDelete=watchlists().length>1, canSort=watchlists().length>1; watchlistPickerQuote=null; watchlistDialog={mode:'manage',id:current.id}; watchlistModal.innerHTML='<div class="watchlist-modal-head"><div><h2>管理清單</h2><div class="market-modal-subtitle">'+esc(current.name)+' · '+((current.quotes||[]).length)+' 檔</div></div><button class="small-btn" type="button" data-close-watchlist-picker>關閉</button></div><div class="watchlist-manage-list"><button class="watchlist-manage-item" type="button" data-watchlist-manage-sort '+(canSort?'':'disabled')+'><strong>變更排序</strong><span>拖曳調整各清單順序</span></button><button class="watchlist-manage-item" type="button" data-watchlist-manage-rename><strong>重新命名</strong><span>修改目前清單名稱</span></button><button class="watchlist-manage-item danger" type="button" data-watchlist-manage-delete '+(canDelete?'':'disabled')+'><strong>刪除清單</strong><span>'+(canDelete?'移除目前清單，不刪除股票資料':'至少需要保留一個清單')+'</span></button></div>'; document.body.classList.add('watchlist-picker-open'); }
function openWatchlistSortDialog(){ const lists=watchlists(); if(lists.length<=1){ return; } watchlistPickerQuote=null; watchlistDialog={mode:'sort',orderIds:lists.map(list=>list.id)}; renderWatchlistSortDialog(); }
function renderWatchlistSortDialog(){ const lists=watchlists(); const byId=new Map(lists.map(list=>[list.id,list])); const orderIds=Array.isArray(watchlistDialog?.orderIds)&&watchlistDialog.orderIds.length?watchlistDialog.orderIds.filter(id=>byId.has(id)) : lists.map(list=>list.id); const rows=orderIds.map(id=>byId.get(id)).filter(Boolean); watchlistDialog={...(watchlistDialog||{}),mode:'sort',orderIds}; watchlistModal.innerHTML='<div class="watchlist-modal-head"><div><h2>變更排序</h2><div class="market-modal-subtitle">按住右側把手拖曳即可調整清單順序。</div></div><button class="small-btn" type="button" data-watchlist-sort-back>返回</button></div><div class="watchlist-sort-note">拖動清單列來重新排序，完成後請按「完成」。</div><div class="watchlist-sort-list" data-watchlist-sort-list>'+rows.map((list,index)=>'<button class="watchlist-sort-item'+(list.id===activeWatchlistId?' active':'')+'" type="button" draggable="true" data-watchlist-sort-item="'+esc(list.id)+'"><span class="watchlist-sort-rank">'+(index+1)+'</span><span class="watchlist-sort-copy"><strong>'+esc(list.name)+'</strong><em>'+(list.quotes||[]).length+' 檔</em></span><span class="watchlist-sort-handle" aria-hidden="true">⋮⋮</span></button>').join('')+'</div><div class="watchlist-modal-actions"><button class="small-btn" type="button" data-watchlist-sort-cancel>取消</button><button class="small-btn primary" type="button" data-watchlist-sort-save>完成</button></div>'; document.body.classList.add('watchlist-picker-open'); }
function syncWatchlistSortDraftFromDom(){ if(watchlistDialog?.mode!=='sort') return; const orderIds=[...watchlistModal.querySelectorAll('[data-watchlist-sort-item]')].map(el=>el.dataset.watchlistSortItem).filter(Boolean); watchlistDialog.orderIds=orderIds; }
function animateWatchlistSortMoves(container, before){ [...container.children].forEach(item=>{ const old=before.get(item), now=item.getBoundingClientRect(); if(!old) return; const dy=old.top-now.top; if(dy) item.animate([{transform:'translateY('+dy+'px)'},{transform:'translateY(0)'}],{duration:150,easing:'ease-out'}); }); }
function beginWatchlistSortDrag(e){ const item=e.target.closest('[data-watchlist-sort-item]'); if(!item||e.button!==0) return; watchlistSortDrag={item}; item.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',item.dataset.watchlistSortItem||''); }
function updateWatchlistSortDrag(e){ const dragging=watchlistModal.querySelector('.watchlist-sort-item.dragging'); if(!dragging) return; const target=e.target.closest('[data-watchlist-sort-item]'); if(!target||target===dragging) return; e.preventDefault(); const list=watchlistModal.querySelector('[data-watchlist-sort-list]'); if(!list) return; watchlistModal.querySelectorAll('.drag-over').forEach(node=>node.classList.remove('drag-over')); target.classList.add('drag-over'); const before=new Map([...list.children].map(node=>[node,node.getBoundingClientRect()])); const rect=target.getBoundingClientRect(); const after=e.clientY>rect.top+rect.height/2; list.insertBefore(dragging, after?target.nextSibling:target); animateWatchlistSortMoves(list, before); syncWatchlistSortDraftFromDom(); }
function endWatchlistSortDrag(){ watchlistModal.querySelectorAll('.drag-over').forEach(node=>node.classList.remove('drag-over')); const dragging=watchlistModal.querySelector('.watchlist-sort-item.dragging'); dragging?.classList.remove('dragging'); watchlistSortDrag=null; syncWatchlistSortDraftFromDom(); }
function setWatchlistError(message){ const el=watchlistModal.querySelector('[data-watchlist-error]'); if(!el)return; el.textContent=message; el.hidden=false; }
function setWatchlistBusy(busy){ watchlistModal.querySelectorAll('button,input').forEach(el=>el.disabled=busy); }
function createWatchlist(){ openWatchlistNameDialog('create'); }
function renameWatchlist(){ openWatchlistNameDialog('rename'); }
function deleteActiveWatchlist(){ openWatchlistDeleteDialog(); }
function manageWatchlist(){ openWatchlistManageDialog(); }
async function saveWatchlistOrder(){ const ids=[...watchlistModal.querySelectorAll('[data-watchlist-sort-item]')].map(el=>el.dataset.watchlistSortItem).filter(Boolean); if(ids.length<=1){ closeWatchlistPicker(); return; } setWatchlistBusy(true); try{ await reorderWatchlistsApi(ids); closeWatchlistPicker(); await reloadWatch(); }catch{ setWatchlistBusy(false); setWatchlistError('排序失敗，請再試一次'); } }
async function submitWatchlistNameForm(form){ const name=(new FormData(form).get('name')||'').toString().trim(); if(!name){setWatchlistError('請輸入清單名稱');return;} const mode=watchlistDialog?.mode, id=watchlistDialog?.id; setWatchlistBusy(true); try{ if(mode==='rename'){ await patchJson('/api/watchlists/'+encodeURIComponent(id),{name}); } else { const r=await fetch('/api/watchlists',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})}); if(!r.ok)throw new Error('HTTP '+r.status); const data=await r.json(); activeWatchlistId=data.watchlist?.id||activeWatchlistId; } closeWatchlistPicker(); await reloadWatch(); }catch{ setWatchlistBusy(false); setWatchlistError(mode==='rename'?'重新命名失敗，名稱可能已存在':'新增失敗，名稱可能已存在'); } }
async function confirmDeleteWatchlist(){ const id=watchlistDialog?.id; if(!id)return; setWatchlistBusy(true); try{ await deleteJson('/api/watchlists/'+encodeURIComponent(id)); activeWatchlistId=''; closeWatchlistPicker(); await reloadWatch(); }catch{ setWatchlistBusy(false); setWatchlistError('刪除失敗，至少需要保留一個清單'); } }
async function refreshDetail(button){ const current=detailData?.quote; if(!current)return; button?.classList.add('spinning'); try{ const symbol=current.symbol; const r=await fetch('/api/detail?symbol='+encodeURIComponent(symbol)+'&name='+encodeURIComponent(current.name||'')+'&type='+encodeURIComponent(current.type||''),{cache:'no-store'}); const next=await r.json(); if(detailData?.quote?.symbol!==symbol)return; detailData=next; detailFetchedAt=new Date().toISOString(); renderDetail(); } finally{ if(button)setTimeout(()=>button.classList.remove('spinning'),800); } }
async function openDetail(symbol,name,type,source,allowWatch=true){ const from=source?.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight/2,width:1,height:1}; detailWatchAllowed=allowWatch; document.body.classList.add('detail-open'); detailEl.innerHTML='<div class="placeholder">載入 '+esc(symbol)+'...</div>'; requestAnimationFrame(()=>animateDetail(from,detailEl.getBoundingClientRect())); const r=await fetch('/api/detail?symbol='+encodeURIComponent(symbol)+'&name='+encodeURIComponent(name||'')+'&type='+encodeURIComponent(type||''),{cache:'no-store'}); detailData=await r.json(); detailFetchedAt=new Date().toISOString(); chartMode='k'; kPeriod='d'; renderDetail(); }
function renderDetail(){
  const q = detailData.quote, s = detailData.stats;
  const inWatch = isInAnyWatchlist(q.symbol);
  const watchBtn = !detailWatchAllowed || !canWatch(q) ? '' : '<button class="small-btn '+(inWatch?'':'')+'" data-watch-pick="'+esc(q.symbol)+'" data-name="'+esc(q.name)+'" data-type="'+esc(q.type)+'">'+(inWatch?'管理自選':'加入自選')+'</button>';
  const detailRefresh = '<span class="detail-refresh-time">\u5237\u65b0\u6642\u9593\uff1a'+fmtTime(detailFetchedAt)+'</span><button class="refresh-btn detail-refresh-btn" type="button" data-refresh-detail title="\u5237\u65b0\u8a73\u60c5"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.8 11A7 7 0 0 0 6.1 7.1M5.2 13A7 7 0 0 0 17.9 16.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>\u624b\u52d5\u5237\u65b0</span></button>';
  detailEl.innerHTML =
    '<div class="detail-head"><div class="detail-title"><div><strong>'+esc(q.name)+'</strong> <span class="mono muted">'+esc(q.symbol)+'</span><div class="muted">'+esc(q.type)+' '+esc(q.market)+'</div></div><div class="detail-actions">'+detailRefresh+watchBtn+' <button class="small-btn" data-close-detail>\u95dc\u9589</button></div></div><div class="price">'+fmtNumber(q.price,2)+'</div><div class="'+cls(q.change)+'">'+num(q.change)+' ('+pct(q.changePercent)+')</div></div>'+
    '<div class="tabs"><button data-chart="k" data-period="d" class="'+(chartMode==='k'&&kPeriod==='d'?'active':'')+'">\u65e5 K</button><button data-chart="k" data-period="w" class="'+(chartMode==='k'&&kPeriod==='w'?'active':'')+'">\u9031 K</button><button data-chart="k" data-period="m" class="'+(chartMode==='k'&&kPeriod==='m'?'active':'')+'">\u6708 K</button><button data-chart="line" class="'+(chartMode==='line'?'active':'')+'">\u5206\u6642</button></div>'+
    '<div class="chart-wrap"><canvas id="chart"></canvas><div class="chart-tip" id="chartTip"></div></div><div class="legend">'+legend()+'</div>'+
    '<div class="stats">'+stat('\u958b\u76e4',fmtNumber(s.open,2))+stat('\u6700\u9ad8',fmtNumber(s.high,2))+stat('\u6700\u4f4e',fmtNumber(s.low,2))+stat('\u6628\u6536',fmtNumber(s.previousClose,2))+stat('\u6210\u4ea4\u91cf',fmtInt(s.volume))+stat('20\u65e5\u5747\u91cf',fmtInt(s.avgVolume20))+stat('\u4e00\u5e74\u9ad8\u9ede',fmtNumber(s.high252||s.fiftyTwoWeekHigh,2))+stat('\u4e00\u5e74\u4f4e\u9ede',fmtNumber(s.low252||s.fiftyTwoWeekLow,2))+'</div>';
  drawChart();
}
function stat(a,b){return '<div class="stat"><span>'+a+'</span><strong>'+b+'</strong></div>'} function legend(){return chartMode==='line'?'<span><i class="dot" style="background:#ff5b52"></i>平盤上方</span><span><i class="dot" style="background:#38e083"></i>平盤下方</span>':'<span><i class="dot" style="background:#a78bfa"></i>MA5</span><span><i class="dot" style="background:#f7b955"></i>MA10</span><span><i class="dot" style="background:#38e083"></i>MA20</span><span><i class="dot" style="background:#5b8cff"></i>MA60</span>'}
function chartData(){ if(chartMode==='line') return detailData.intraday; const d=kPeriod==='d'?detailData.daily:aggregate(detailData.daily,kPeriod); return addMA(d).slice(-160); }
function aggregate(rows,p){ const m=new Map(); rows.forEach(r=>{ const dt=new Date(r.time), key=p==='w'?dt.getFullYear()+'-W'+week(dt):dt.getFullYear()+'-'+dt.getMonth(); const v=m.get(key); if(!v)m.set(key,{...r,volume:r.volume||0}); else{v.high=Math.max(v.high,r.high);v.low=Math.min(v.low,r.low);v.close=r.close;v.volume+=r.volume||0;} }); return [...m.values()]; }
function week(dt){ const d=new Date(Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate())); d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7)); const s=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-s)/86400000)+1)/7); }
function addMA(rows){ return rows.map((r,i)=>({...r,ma5:ma(rows,i,5),ma10:ma(rows,i,10),ma20:ma(rows,i,20),ma60:ma(rows,i,60)})); } function ma(rows,i,n){ if(i+1<n)return null; const a=rows.slice(i+1-n,i+1).map(x=>x.close); return a.reduce((s,x)=>s+x,0)/n; }
function drawChart(){ const c=document.querySelector('#chart'); if(!c)return; const ctx=c.getContext('2d'), r=c.getBoundingClientRect(), d=window.devicePixelRatio||1, css=getComputedStyle(document.body); c.width=r.width*d;c.height=r.height*d;ctx.scale(d,d);ctx.clearRect(0,0,r.width,r.height); const bg=css.getPropertyValue('--chart-bg').trim()||'#0b1627', pad=chartMode==='line'?{l:58,r:68,t:26,b:52}:{l:50,r:14,t:18,b:28}, data=chartData(); const wash=ctx.createLinearGradient(0,0,0,r.height); wash.addColorStop(0,bg); wash.addColorStop(1,css.getPropertyValue('--panel2').trim()||bg); ctx.fillStyle=wash;ctx.fillRect(0,0,r.width,r.height); if(!data.length)return; const base=chartMode==='line'?detailData.stats.previousClose:null, rawVals=data.flatMap(x=>chartMode==='line'?[x.close,base]:[x.high,x.low,x.ma5,x.ma10,x.ma20,x.ma60]).filter(Number.isFinite), min0=Math.min(...rawVals), max0=Math.max(...rawVals), spread=Math.max(max0-min0,Math.abs(max0)*.002,.01), min=min0-spread*.12, max=max0+spread*.12, session=detailData.session||{}, timeX=chartMode==='line'&&Number.isFinite(session.start)&&Number.isFinite(session.end)&&session.end>session.start, x=i=>timeX?pad.l+(data[i].time-session.start)/(session.end-session.start)*(r.width-pad.l-pad.r):pad.l+i/Math.max(data.length-1,1)*(r.width-pad.l-pad.r), y=v=>pad.t+(max-v)/Math.max(max-min,.0001)*(r.height-pad.t-pad.b); chartState={data,x,y,pad,w:r.width,h:r.height,min,max,base}; grid(ctx,r.width,r.height,pad,min,max); if(chartMode==='line'){ volumeBars(ctx,data,x,pad,r.width,r.height); lineByBase(ctx,data,x,y,base,pad.l,r.width-pad.r); priceBadge(ctx,data[data.length-1],x(data.length-1),y(data[data.length-1].close)); } else { candles(ctx,data,x,y); line(ctx,data,x,y,'ma5','#a78bfa',1.2);line(ctx,data,x,y,'ma10','#f7b955',1.2);line(ctx,data,x,y,'ma20','#38e083',1.2);line(ctx,data,x,y,'ma60','#5b8cff',1.2); } markExtremes(ctx,data,x,y); c.onmousemove=e=>tip(e); c.onmouseleave=()=>{const t=document.querySelector('#chartTip'); if(t)t.style.display='none'; drawChart();}; }
function grid(ctx,w,h,p,min,max){ const plotH=h-p.t-p.b, plotW=w-p.l-p.r; ctx.save(); ctx.strokeStyle='rgba(148,163,184,.18)';ctx.fillStyle='#8fa3bd';ctx.font='12px system-ui';ctx.lineWidth=1; for(let i=0;i<=4;i++){const yy=p.t+i/4*plotH,v=max-i/4*(max-min);ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(w-p.r,yy);ctx.stroke();ctx.fillText(fmtNumber(v,2),8,yy+4);} ctx.strokeStyle='rgba(148,163,184,.10)'; for(let i=1;i<4;i++){const xx=p.l+i/4*plotW;ctx.beginPath();ctx.moveTo(xx,p.t);ctx.lineTo(xx,h-p.b);ctx.stroke();} ctx.restore(); }
function volumeBars(ctx,d,x,p,w,h){ const maxVol=Math.max(...d.map(r=>Number(r.volume)||0)); if(!maxVol)return; ctx.save(); d.forEach((r,i)=>{ const vol=Number(r.volume)||0,bh=Math.max(1,vol/maxVol*38),xx=x(i),barW=Math.max(2,(w-p.l-p.r)/Math.max(d.length,1)*.52); ctx.fillStyle=(r.close>=chartState.base?'rgba(255,91,82,.20)':'rgba(56,224,131,.20)'); ctx.fillRect(xx-barW/2,h-p.b-bh,barW,bh); }); ctx.restore(); }
function priceBadge(ctx,row,px,py){ if(!row||!Number.isFinite(row.close))return; const up=row.close>=chartState.base, color=up?'#ff5b52':'#38e083', text=fmtNumber(row.close,2); ctx.save(); ctx.font='700 12px system-ui'; const tw=ctx.measureText(text).width, w=tw+18, h=24, x=Math.min(chartState.w-w-6,px+10), y=Math.max(h/2+4,Math.min(chartState.h-chartState.pad.b-h/2-4,py)); ctx.fillStyle=color; ctx.beginPath(); ctx.roundRect(x,y-h/2,w,h,7); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillText(text,x+9,y+4); ctx.fillStyle=color; ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2); ctx.fill(); ctx.restore(); }
function line(ctx,d,x,y,k,c,w){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();let on=false;d.forEach((r,i)=>{if(!Number.isFinite(r[k]))return;on?ctx.lineTo(x(i),y(r[k])):(ctx.moveTo(x(i),y(r[k])),on=true)});ctx.stroke();}
function segment(ctx,x1,y1,x2,y2,color){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function lineByBase(ctx,d,x,y,base,left,right){ if(!Number.isFinite(base)){line(ctx,d,x,y,'close',getComputedStyle(document.body).getPropertyValue('--text').trim()||'#fff',2);return;} const baseY=y(base); ctx.save(); ctx.strokeStyle='rgba(148,163,184,.45)';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(left,baseY);ctx.lineTo(right,baseY);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(148,163,184,.9)';ctx.font='12px system-ui';ctx.fillText('昨收 '+fmtNumber(base,2),left+8,baseY-7); const top=ctx.createLinearGradient(0,chartState.pad.t,0,baseY), bottom=ctx.createLinearGradient(0,baseY,0,chartState.h-chartState.pad.b); top.addColorStop(0,'rgba(255,91,82,.18)');top.addColorStop(1,'rgba(255,91,82,.02)'); bottom.addColorStop(0,'rgba(56,224,131,.02)');bottom.addColorStop(1,'rgba(56,224,131,.16)'); area(ctx,d,x,y,base,top,true);area(ctx,d,x,y,base,bottom,false); ctx.shadowColor='rgba(255,91,82,.35)';ctx.shadowBlur=8; for(let i=1;i<d.length;i++){const a=d[i-1].close,b=d[i].close;if(!Number.isFinite(a)||!Number.isFinite(b))continue;const x1=x(i-1),y1=y(a),x2=x(i),y2=y(b);if((a-base)*(b-base)<0){const t=(base-a)/(b-a),xm=x1+(x2-x1)*t,ym=baseY;segment(ctx,x1,y1,xm,ym,a>=base?'#ff5b52':'#38e083');segment(ctx,xm,ym,x2,y2,b>=base?'#ff5b52':'#38e083');}else segment(ctx,x1,y1,x2,y2,a>=base||b>=base?'#ff5b52':'#38e083');} ctx.restore(); }
function area(ctx,d,x,y,base,fill,above){ ctx.save(); ctx.beginPath(); let started=false,lastX=0; d.forEach((r,i)=>{ if(!Number.isFinite(r.close))return; const xx=x(i), yy=y(r.close); if(!started){ctx.moveTo(xx,y(base));started=true;} ctx.lineTo(xx, above?Math.min(yy,y(base)):Math.max(yy,y(base))); lastX=xx; }); if(started){ctx.lineTo(lastX,y(base));ctx.closePath();ctx.fillStyle=fill;ctx.fill();} ctx.restore(); }
function candles(ctx,d,x,y){const bw=Math.max(2,(x(1)-x(0))*.58);d.forEach((r,i)=>{if(![r.open,r.high,r.low,r.close].every(Number.isFinite))return;const up=r.close>=r.open,xx=x(i);ctx.strokeStyle=ctx.fillStyle=up?'#ff5b52':'#38e083';ctx.beginPath();ctx.moveTo(xx,y(r.high));ctx.lineTo(xx,y(r.low));ctx.stroke();ctx.fillRect(xx-bw/2,y(Math.max(r.open,r.close)),bw,Math.max(y(Math.min(r.open,r.close))-y(Math.max(r.open,r.close)),1));});}
function markExtremes(ctx,d,x,y){ const hiKey=chartMode==='line'?'close':'high', loKey=chartMode==='line'?'close':'low', last=d.length-1, highs=d.map((r,i)=>({i,v:r[hiKey]})).filter(p=>Number.isFinite(p.v)&&p.i!==last), lows=d.map((r,i)=>({i,v:r[loKey]})).filter(p=>Number.isFinite(p.v)&&p.i!==last); if(!highs.length||!lows.length)return; const hi=highs.reduce((a,b)=>b.v>a.v?b:a), lo=lows.reduce((a,b)=>b.v<a.v?b:a); labelPrice(ctx,x(hi.i),y(hi.v),hi.v,true); labelPrice(ctx,x(lo.i),y(lo.v),lo.v,false); }
function labelPrice(ctx,px,py,value,isHigh){ const text=fmtNumber(value,2), color=isHigh?'#ff5b52':'#38e083'; ctx.save(); ctx.font='700 12px system-ui'; const w=ctx.measureText(text).width+16, right=px<chartState.w-130, x=right?px+10:px-10-w, y=Math.max(18,Math.min(chartState.h-chartState.pad.b-18,py+(isHigh?-18:18))); ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(right?x:x+w,py);ctx.stroke();ctx.globalAlpha=.12;ctx.fillRect(x,y-13,w,24);ctx.globalAlpha=1;ctx.fillText(text,x+8,y+4); ctx.restore(); }
function tip(e){ const c=e.currentTarget,r=c.getBoundingClientRect(),mouseX=e.clientX-r.left,i=chartState.data.reduce((best,_,idx)=>Math.abs(chartState.x(idx)-mouseX)<Math.abs(chartState.x(best)-mouseX)?idx:best,0),row=chartState.data[i],t=document.querySelector('#chartTip'); drawChart(); const ctx=c.getContext('2d'), xx=chartState.x(i), yy=chartState.y(row.close); ctx.save(); ctx.strokeStyle='rgba(148,163,184,.55)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(xx,chartState.pad.t);ctx.lineTo(xx,chartState.h-chartState.pad.b);ctx.moveTo(chartState.pad.l,yy);ctx.lineTo(chartState.w-chartState.pad.r,yy);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#eef4ff';ctx.beginPath();ctx.arc(xx,yy,4,0,Math.PI*2);ctx.fill();ctx.restore(); t.style.display='block';t.style.left=Math.min(Math.max(e.clientX-r.left+14,8),r.width-240)+'px';t.style.top=Math.max(e.clientY-r.top-18,8)+'px'; const change=Number.isFinite(chartState.base)&&Number.isFinite(row.close)?row.close-chartState.base:null; t.innerHTML=chartMode==='line'?'<b>'+fmtTime(row.time)+'</b><br>價格：'+fmtNumber(row.close,4)+'<br>漲跌：'+num(change)+' ('+pct(change&&chartState.base?change/chartState.base*100:null)+')<br>量：'+fmtInt(row.volume):'<b>'+new Date(row.time).toLocaleDateString('zh-TW')+'</b><br>開：'+fmtNumber(row.open,2)+' 高：'+fmtNumber(row.high,2)+'<br>低：'+fmtNumber(row.low,2)+' 收：'+fmtNumber(row.close,2)+'<br>MA5：'+fmtNumber(row.ma5,2)+' MA20：'+fmtNumber(row.ma20,2); }
function animateDetail(from, to) {
  const dx = from.left - to.left, dy = from.top - to.top;
  const sx = from.width / Math.max(to.width, 1), sy = from.height / Math.max(to.height, 1);
  detailEl.animate([
    { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')', opacity: .92 },
    { transform: 'translate(0,0) scale(1,1)', opacity: 1 }
  ], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
}
function closeDetail(){ if(!document.body.classList.contains('detail-open'))return; detailEl.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.96)'}],{duration:140,easing:'ease-out'}).finished.finally(()=>{document.body.classList.remove('detail-open'); detailData=null; detailFetchedAt=null; detailWatchAllowed=true; detailEl.innerHTML='';}); }
function setTheme(theme){ document.body.classList.toggle('light',theme==='light'); themeButtons.forEach(button=>{ button.title=theme==='light'?'切換到暗色主題':'切換到白色主題'; button.setAttribute('aria-label', button.title); }); localStorage.setItem('theme',theme); requestAnimationFrame(()=>{drawMiniCharts(); if(detailData)drawChart();}); }
function animateRows(tbody, before){ [...tbody.children].forEach(row=>{ const old=before.get(row), now=row.getBoundingClientRect(); if(!old)return; const dy=old.top-now.top; if(dy) row.animate([{transform:'translateY('+dy+'px)'},{transform:'translateY(0)'}],{duration:150,easing:'ease-out'}); }); }
async function saveWatchOrder(){ const symbols=[...watchPanel.querySelectorAll('[data-watch-row], [data-watch-card]')].map(row=>row.dataset.open).filter(Boolean); await post('/api/watchlists/'+encodeURIComponent(activeWatchlist().id)+'/reorder',{symbols}); await load(); }
function getWatchDragTarget(e){ return watchViewMode==='cards'?e.target.closest('[data-watch-card]'):e.target.closest('[data-watch-row]'); }
watchPanel.addEventListener('dragstart',e=>{ const item=getWatchDragTarget(e); if(!item)return; watchDragging=true; item.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',item.dataset.open); });
watchPanel.addEventListener('dragover',e=>{ const item=getWatchDragTarget(e), dragging=watchPanel.querySelector('.dragging'); if(!item||!dragging||item===dragging)return; e.preventDefault(); item.classList.add('drag-over'); const container=item.parentNode, before=new Map([...container.children].map(x=>[x,x.getBoundingClientRect()])); const rect=item.getBoundingClientRect(), after=watchViewMode==='cards'?(e.clientX>rect.left+rect.width/2 || e.clientY>rect.top+rect.height/2):e.clientY>rect.top+rect.height/2; container.insertBefore(dragging, after?item.nextSibling:item); watchViewMode==='cards'?animateCardMoves(container,before):animateRows(container,before); });
watchPanel.addEventListener('dragleave',e=>getWatchDragTarget(e)?.classList.remove('drag-over'));
watchPanel.addEventListener('dragend',async e=>{ const item=e.target.closest('[data-watch-row], [data-watch-card]'); if(!item)return; item.classList.remove('dragging'); watchPanel.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over')); watchDragging=false; await saveWatchOrder(); });
watchPanel.addEventListener('pointerdown',beginWatchTabsDrag);
watchPanel.addEventListener('pointermove',updateWatchTabsDrag);
watchPanel.addEventListener('pointerup',endWatchTabsDrag);
watchPanel.addEventListener('pointercancel',endWatchTabsDrag);
watchlistModal.addEventListener('dragstart',e=>{ if(watchlistDialog?.mode!=='sort') return; beginWatchlistSortDrag(e); });
watchlistModal.addEventListener('dragover',e=>{ if(watchlistDialog?.mode!=='sort') return; updateWatchlistSortDrag(e); });
watchlistModal.addEventListener('dragend',()=>{ if(watchlistDialog?.mode!=='sort') return; endWatchlistSortDrag(); });
watchlistModal.addEventListener('drop',e=>{ if(watchlistDialog?.mode!=='sort') return; e.preventDefault(); endWatchlistSortDrag(); });
cardsEl.addEventListener('dragstart',e=>{ if(!globalMarketEditMode) return; const slot=e.target.closest('[data-market-slot]'); if(!slot) return; globalMarketDragging=true; slot.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',slot.dataset.marketSlot||''); });
cardsEl.addEventListener('dragover',e=>{ if(!globalMarketEditMode||!globalMarketDragging) return; const dragging=cardsEl.querySelector('.market-slot.dragging'); if(!dragging) return; const target=e.target.closest('[data-market-slot]')||getGlobalMarketCardAtPoint(e.clientX,e.clientY); if(!target||target===dragging) return; e.preventDefault(); target.classList.add('drag-over'); const rect=target.getBoundingClientRect(); reorderGlobalMarketCard(target, e.clientX>rect.left+rect.width/2 || e.clientY>rect.top+rect.height/2); });
cardsEl.addEventListener('dragleave',e=>e.target.closest('[data-market-slot]')?.classList.remove('drag-over'));
cardsEl.addEventListener('dragend',()=>{ cardsEl.querySelectorAll('.drag-over').forEach(card=>card.classList.remove('drag-over')); const dragging=cardsEl.querySelector('.market-slot.dragging'); dragging?.classList.remove('dragging'); globalMarketDragging=false; if(globalMarketEditMode){ syncGlobalMarketDraftFromDom(); renderGlobalMarket(); } });
cardsEl.addEventListener('click',e=>{ if(globalMarketDragging) return; const remove=e.target.closest('[data-market-remove]'); if(remove){e.stopPropagation(); removeGlobalMarketSlot(Number(remove.dataset.marketRemove)); return;} const slot=e.target.closest('[data-market-slot]'); if(!slot) return; const symbol=slot.dataset.marketSymbol; if(globalMarketEditMode){ e.stopPropagation(); openGlobalMarketPicker(Number(slot.dataset.marketSlot)); return; } if(symbol){ e.stopPropagation(); const name=slot.dataset.name||slot.dataset.marketName||symbol, type=slot.dataset.type||slot.dataset.marketType||'\u6307\u6578'; openDetail(symbol,name,type,slot,false); } });
windCardsEl.addEventListener('dragstart',e=>{ if(!marketWindEditMode)return; const slot=e.target.closest('[data-wind-slot]'); if(!slot)return; marketWindDragging=true; slot.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',slot.dataset.windSlot||''); });
windCardsEl.addEventListener('dragover',e=>{ if(!marketWindEditMode||!marketWindDragging)return; const dragging=windCardsEl.querySelector('.wind-slot.dragging'); if(!dragging)return; const target=e.target.closest('[data-wind-slot]')||getMarketWindCardAtPoint(e.clientX,e.clientY); if(!target||target===dragging)return; e.preventDefault(); target.classList.add('drag-over'); const rect=target.getBoundingClientRect(); reorderMarketWindCard(target,e.clientX>rect.left+rect.width/2||e.clientY>rect.top+rect.height/2); });
windCardsEl.addEventListener('dragleave',e=>e.target.closest('[data-wind-slot]')?.classList.remove('drag-over'));
windCardsEl.addEventListener('dragend',()=>{ windCardsEl.querySelectorAll('.drag-over').forEach(card=>card.classList.remove('drag-over')); windCardsEl.querySelector('.wind-slot.dragging')?.classList.remove('dragging'); marketWindDragging=false; if(marketWindEditMode){syncMarketWindDraftFromDom();renderWind();} });
windCardsEl.addEventListener('click',e=>{ if(marketWindDragging)return; const remove=e.target.closest('[data-wind-remove]'); if(remove){e.stopPropagation();removeMarketWindSlot(Number(remove.dataset.windRemove));return;} const slot=e.target.closest('[data-wind-slot]'); if(!slot)return; const symbol=slot.dataset.windSymbol; if(marketWindEditMode){e.stopPropagation();openMarketWindPicker(Number(slot.dataset.windSlot));return;} if(symbol){e.stopPropagation();openDetail(symbol,slot.dataset.name||slot.dataset.windName||symbol,slot.dataset.type||slot.dataset.windType||'市場風向',slot,false);} });
marketModal.addEventListener('click',e=>{ const pick=e.target.closest('[data-wind-pick]'); if(pick){e.stopPropagation();applyMarketWindSelection(pick.dataset.windPick);return;} const clear=e.target.closest('[data-wind-clear]'); if(clear){e.stopPropagation();if(marketWindPickerIndex!==null)removeMarketWindSlot(marketWindPickerIndex);return;} if(e.target===marketLayer||e.target.closest('[data-wind-close-picker]')){e.stopPropagation();closeMarketWindPicker();} });
marketModal.addEventListener('click',e=>{ const pick=e.target.closest('[data-market-pick]'); if(pick){e.stopPropagation(); applyGlobalMarketSelection(pick.dataset.marketPick); return;} const clear=e.target.closest('[data-market-clear]'); if(clear){e.stopPropagation(); if(globalMarketPickerIndex!==null) removeGlobalMarketSlot(globalMarketPickerIndex); return;} if(e.target===marketLayer||e.target.closest('[data-market-close-picker]')){e.stopPropagation(); closeGlobalMarketPicker(); return;} });
marketLayer.addEventListener('click',e=>{ if(e.target===marketLayer){ if(marketWindPickerIndex!==null)closeMarketWindPicker(); else closeGlobalMarketPicker(); } });
globalMarketEditBtn.addEventListener('click',async()=>{ try{ await enterGlobalMarketEdit(); }catch(error){ console.error(error); } });
globalMarketDoneBtn.addEventListener('click',async()=>{ try{ await finishGlobalMarketEdit(); }catch(error){ console.error(error); } });
globalMarketCancelBtn.addEventListener('click',()=>cancelGlobalMarketEdit());
marketWindEditBtn.addEventListener('click',async()=>{ try{await enterMarketWindEdit();}catch(error){console.error(error);} });
marketWindDoneBtn.addEventListener('click',async()=>{ try{await finishMarketWindEdit();}catch(error){console.error(error);} });
marketWindCancelBtn.addEventListener('click',()=>cancelMarketWindEdit());
document.body.addEventListener('click',async e=>{
  if(e.target.closest('[data-profile-open]')){ openProfileSettings(); return; }
  if(e.target===profileLayer||e.target.closest('[data-close-profile]')){ closeProfileSettings(); return; }
  if(e.target.closest('[data-profile-reset-avatar]')){ profileDraftAvatar=''; updateProfileAvatarPreview(); return; }
  const currencyAdd=e.target.closest('[data-currency-add]');
  if(currencyAdd){ const current=Number(currencyAmountInput?.value||0); if(currencyAmountInput) currencyAmountInput.value=String((Number.isFinite(current)?current:0)+Number(currencyAdd.dataset.currencyAdd||0)); updateCurrencyResult(); return; }
  if(e.target.closest('[data-currency-clear]')){ if(currencyAmountInput) currencyAmountInput.value=''; updateCurrencyResult(); return; }
  if(e.target.closest('#currencySwapButton')){ if(currencyState){ const nextFrom=currencyToSelect?.value||currencyState.to; const nextTo=currencyFromSelect?.value||currencyState.from; if(currencyFromSelect) currencyFromSelect.value=nextFrom; if(currencyToSelect) currencyToSelect.value=nextTo; await setCurrencyPair(nextFrom,nextTo); } return; }
  const currencyFavorite=e.target.closest('[data-currency-favorite]');
  if(currencyFavorite){ const now=Date.now(); if(now<currencyFavoriteThrottleUntil) return; currencyFavoriteThrottleUntil=now+120; const code=currencyFavorite.dataset.currencyFavorite; if(currencyState){ const pair=currencyFavoritePair(code); if(currencyFromSelect) currencyFromSelect.value=pair.from; if(currencyToSelect) currencyToSelect.value=pair.to; await setCurrencyPair(pair.from,pair.to); } return; }
  if(e.target.closest('[data-currency-manage-favorites]')){ openCurrencyPicker('favorites'); return; }
  const currencyToggle=e.target.closest('[data-currency-toggle-favorite]');
  if(currencyToggle){ await toggleCurrencyFavorite(currencyToggle.dataset.currencyToggleFavorite); return; }
  const newsCategory=e.target.closest('[data-news-category]');
  if(newsCategory){ activeNewsCategory=newsCategory.dataset.newsCategory||'all'; localStorage.setItem('activeNewsCategory',activeNewsCategory); newsState=null; await refreshNewsOnly({force:true}); return; }
  if(e.target.closest('[data-news-refresh]')){ await refreshNewsOnly({force:true}); return; }
  const newsOpen=e.target.closest('[data-news-open]');
  if(newsOpen){ const url=newsOpen.dataset.newsOpen; if(url) window.open(url,'_blank','noopener'); return; }
  const moduleTrigger=e.target.closest('[data-module]');
  if(moduleTrigger){
    e.preventDefault();
    setActiveModule(moduleTrigger.dataset.module);
    return;
  }
  const watchView=e.target.closest('[data-watch-view]');
  if(watchView){await switchWatchView(watchView.dataset.watchView==='cards'?'cards':'table'); return;}
  const watchTab=e.target.closest('[data-watchlist-tab]');
  if(watchTab){ if(watchTabsClickSuppressed){ e.preventDefault(); return; } await switchWatchlist(watchTab.dataset.watchlistTab); return;}
  if(e.target.closest('[data-watchlist-manage-sort]')){openWatchlistSortDialog(); return;}
  if(e.target.closest('[data-watchlist-create]')){await createWatchlist(); return;}
  if(e.target.closest('[data-watchlist-manage]')){manageWatchlist(); return;}
  if(e.target.closest('[data-watchlist-manage-rename]')){renameWatchlist(); return;}
  if(e.target.closest('[data-watchlist-manage-delete]')){deleteActiveWatchlist(); return;}
  if(e.target.closest('[data-watchlist-rename]')){await renameWatchlist(); return;}
  if(e.target.closest('[data-watchlist-delete]')){await deleteActiveWatchlist(); return;}
  if(e.target.closest('[data-watchlist-sort-back]')){openWatchlistManageDialog(); return;}
  if(e.target.closest('[data-watchlist-sort-cancel]')){closeWatchlistPicker(); return;}
  if(e.target.closest('[data-watchlist-sort-save]')){await saveWatchlistOrder(); return;}
  const watchPick=e.target.closest('[data-watch-pick]');
  if(watchPick){e.stopPropagation(); openWatchlistPicker(watchPick.dataset.watchPick,watchPick.dataset.name,watchPick.dataset.type); return;}
  const rem=e.target.closest('[data-remove]');
  if(rem){e.stopPropagation(); await post('/api/watchlists/'+encodeURIComponent(activeWatchlist().id)+'/remove',{symbol:rem.dataset.remove}); await reloadWatch(); if(detailData)renderDetail(); if(searchEl.value.trim())search(); return;}
  const rankTab=e.target.closest('[data-rank-tab]');
  if(rankTab){activeRankTab=rankTab.dataset.rankTab; renderRankings(); return;}
  const more=e.target.closest('[data-rank-more]');
  if(more){e.stopPropagation(); openRankModal(more.dataset.rankMore); return;}
  if(e.target===rankLayer||e.target.closest('[data-close-rank]')){closeRankModal();return;}
  if(e.target===watchlistLayer||e.target.closest('[data-close-watchlist-picker]')){closeWatchlistPicker();return;}
  if(e.target.closest('[data-watchlist-confirm-delete]')){await confirmDeleteWatchlist();return;}
  const detailRefresh=e.target.closest('[data-refresh-detail]');
  if(detailRefresh){e.stopPropagation(); await refreshDetail(detailRefresh); return;}
  if(e.target===detailLayer){closeDetail();return;}
  const close=e.target.closest('[data-close-detail]');
  if(close){closeDetail();return;}
  const tab=e.target.closest('[data-chart]');
  if(tab){chartMode=tab.dataset.chart;if(tab.dataset.period)kPeriod=tab.dataset.period;renderDetail();return;}
  const open=e.target.closest('[data-open]');
  if(open){ if(open.closest('#rankLayer'))closeRankModal(); openDetail(open.dataset.open,open.dataset.name,open.dataset.type,open); }
});
document.body.addEventListener('submit',async e=>{ const profileForm=e.target.closest('[data-profile-form]'); if(profileForm){ e.preventDefault(); await submitProfileForm(profileForm); return; } const form=e.target.closest('[data-watchlist-form]'); if(!form)return; e.preventDefault(); await submitWatchlistNameForm(form); });
document.body.addEventListener('change',async e=>{ const profileAvatarInput=e.target.closest('[data-profile-avatar-input]'); if(profileAvatarInput){ try{ await handleProfileAvatarChange(profileAvatarInput); }catch(error){ console.error(error); } return; } const membership=e.target.closest('[data-watchlist-membership]'); if(membership){await toggleWatchlistMembership(membership.dataset.watchlistMembership,membership.checked); return;} const select=e.target.closest('[data-rank-market]'); if(!select)return; rankMarkets[select.dataset.rankMarket]=select.value; renderRankings(); });

currencyRefreshButton?.addEventListener('click', async()=>{ try{ await refreshCurrencyOnly(); }catch(error){ console.error(error); } });
currencyAmountInput?.addEventListener('input',()=>updateCurrencyResult());
currencyFromSelect?.addEventListener('change',async()=>{ if(!currencyState) return; await setCurrencyPair(currencyFromSelect.value,currencyToSelect.value); });
currencyToSelect?.addEventListener('change',async()=>{ if(!currencyState) return; await setCurrencyPair(currencyFromSelect.value,currencyToSelect.value); });
marketModal.addEventListener('click',async e=>{ const currencyOption=e.target.closest('[data-currency-option]'); if(currencyOption){ e.stopPropagation(); await handleCurrencyOptionPick(currencyOption.dataset.currencyOption); return; } if(e.target===marketLayer||e.target.closest('[data-currency-close-picker]')){ if(currencyPickerMode){ e.stopPropagation(); closeCurrencyPicker(); } } });

refreshButton.addEventListener('click', refreshNow);
themeButtons.forEach(button=>button.addEventListener('click',()=>setTheme(document.body.classList.contains('light')?'dark':'light')));
sidebarToggle?.addEventListener('click', toggleSidebar);
sidebarResizeHandle?.addEventListener('pointerdown', beginSidebarResize);
window.addEventListener('pointermove', updateSidebarResize);
window.addEventListener('pointerup', endSidebarResize);
window.addEventListener('pointercancel', endSidebarResize);
searchEl.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,250);});
searchEl.addEventListener('focus',()=>{if(searchEl.value.trim())search();});
marketEl.addEventListener('change',search);
document.addEventListener('click',e=>{if(!e.target.closest('.search'))suggestEl.innerHTML='';},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.body.classList.contains('profile-open')){closeProfileSettings();return;} if(document.body.classList.contains('watchlist-picker-open')){closeWatchlistPicker();return;} if(currencyPickerMode){closeCurrencyPicker();return;} if(marketWindPickerIndex!==null){closeMarketWindPicker();return;} if(globalMarketPickerIndex!==null){closeGlobalMarketPicker();return;} if(marketWindEditMode){cancelMarketWindEdit();return;} if(globalMarketEditMode){cancelGlobalMarketEdit();return;} closeDetail();closeRankModal();}});
window.addEventListener('resize',()=>{
  if(isMobileSidebar() && sidebarResizeState){
    sidebarResizeState=null;
    document.body.classList.remove('sidebar-resizing');
  }
  applySidebarState();
  if(detailData)drawChart();
  requestAnimationFrame(drawMiniCharts);
  if(activeModule==='currency') renderCurrency();
});
applySidebarState();
renderModuleState();
renderProfileCard();
setTheme(localStorage.getItem('theme')||'dark');
load();
