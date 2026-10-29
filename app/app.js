/* BoxUp Logistics Hub: screens */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grad = (a, b) => `linear-gradient(145deg,${a},${b})`;
const H = window.hub;

/* ---------------- app catalogue ---------------- */
const BUILTIN = [
  {id:'labels', name:'Shipping Label Generator', short:'Labels', icon:'&#127991;', color:grad('#27b47b','#08724e'), url:'https://logisticsboxup.github.io/boxup-labels/'},
  {id:'orders', name:'Order Tracker', short:'Order Tracker', icon:'&#128269;', color:grad('#3c94ff','#0752c7'), url:'https://logisticsboxup.github.io/boxup-sales/'},
  {id:'gate', name:'Gate Scanner', short:'Gate Scanner', icon:'&#128737;', color:grad('#e7ad3e','#88560b'), url:'https://logisticsboxup.github.io/boxup-gate/'},
  {id:'gsys', name:'Gate System', short:'Gate System', icon:'&#128202;', color:grad('#a75be6','#6023ae'), url:'https://logisticsboxup.github.io/boxup-gate/dashboard.html'},
  {id:'log', name:'Label Log', short:'Label Log', icon:'&#128203;', color:grad('#36c79d','#07805e'), url:'https://docs.google.com/spreadsheets/d/17IMy6t47Y0q895rvQsAEdgsGM6w_2lSDWso8BIWHEtg/edit'},
  {id:'deliv', name:'Delivery Tracker', short:'Delivery', icon:'&#9989;', color:grad('#ff9b2d','#c85b00'), url:'https://docs.google.com/spreadsheets/d/1WDZMJaT7Lr8rUEEFwgQwX7Khzb7D_OGaQUwKIwmIk_Q/edit', screen:'deliv'},
  {id:'wa', name:'WhatsApp', short:'WhatsApp', icon:'&#128172;', color:grad('#3ddc84','#128c4a'), url:'https://web.whatsapp.com/'},
  {id:'google', name:'Google', short:'Google', icon:'G', color:grad('#5e97f6','#2a56c6'), url:'https://www.google.com/', homeOff:true},
];
const THEMES = [
  ['light','Light'], ['dark','Dark'], ['nature','Nature'], ['minimal','Minimal'],
  ['ocean','Ocean'], ['sunset','Sunset'], ['forest','Forest'], ['aurora','Aurora'],
];
const SITES = [
  ['DTDC', 'https://www.dtdc.in/', '#ef5350'], ['Porter', 'https://porter.in/', '#42a5f5'], ['Shadowfax', 'https://www.shadowfax.in/', '#43a047'],
  ['Shree Anjani', 'https://shreeanjani.co.in/', '#ff7043'], ['Zoho Inventory', 'https://inventory.zoho.in/', '#e53935'], ['Gmail', 'https://mail.google.com/', '#c62828'],
];
const PROGRAMS = [['excel','Excel','X','#2e7d32'], ['word','Word','W','#1e88e5'], ['downloads','Downloads folder','&#128193;','#f9a825'], ['photos','Photos','&#128444;','#8e24aa'], ['notepad','Notepad','&#128221;','#546e7a'], ['calc','Calculator','=','#455a64']];
const COLORS = ['#7b6cf6,#4334b8','#27b47b,#08724e','#3c94ff,#0752c7','#e7ad3e,#88560b','#a75be6,#6023ae','#ff6464,#c90e19','#36c79d,#07805e','#ff9b2d,#c85b00','#546e7a,#263238'];
const DEFAULT_TEMPLATES = [
  {name:'Ready for dispatch', text:'Hello {name}, your BoxUp order {order} is packed and ready for dispatch.'},
  {name:'Dispatched', text:'Hello {name}, your BoxUp order {order} has been dispatched. Courier: {courier}, AWB: {awb}. Track: {link}'},
  {name:'Out for delivery', text:'Hello {name}, your BoxUp order {order} is out for delivery today.'},
  {name:'Delivered', text:'Hello {name}, your BoxUp order {order} has been delivered. Thank you for choosing BoxUp!'},
  {name:'Delayed', text:'Hello {name}, your BoxUp order {order} is slightly delayed. We are following up with the courier.'},
];
const DEFAULT_LABEL = {company:'BoxUp Luxury Gifting', address:'4th Floor, No. 19/3, off Kanakapura Main Road, behind Metro Cash & Carry, Yelachenahalli Glass building beside TATA Key Motor Service center\nBangalore – 560062', phone:'9663993971', alt:'93640 85209', footer:"Goods once sold will only be taken back or exchanged as per the store's exchange/return policy. No Dangerous Good.", fest:{on:false, name:'Diwali', text:'DIWALI GIFT', from:'', to:''}};
const FESTS = [['Diwali','DIWALI GIFT'],['Raksha Bandhan','RAKHI GIFT'],['Christmas','CHRISTMAS GIFT'],['New Year','NEW YEAR GIFT'],['Holi','HOLI GIFT'],['Eid','EID GIFT'],['Event','EVENT GIFT']];

let S = {};            // saved settings
let ME = {name:'Logistics', email:''};
let ORDERS = [];       // from the Label Log
let feedAt = 0;
let current = null;    // open tab id, null = home
const TABS = {};       // id -> {app, wv}
let updateInfo = null;

/* ---------------- helpers ---------------- */
function toast(msg, actions){
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<span>${esc(msg)}</span>`;
  (actions || []).forEach(([label, fn]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); t.remove(); }; t.appendChild(b); });
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), actions && actions.length ? 9000 : 3200);
}
async function save(patch){ S = await H.settings.set(patch); return S; }
const allApps = () => BUILTIN.concat((S.customApps || []));
const appById = id => allApps().find(a => a.id === id);
function homeOrder(){
  const ids = allApps().map(a => a.id);
  const order = (S.home && S.home.order || []).filter(id => ids.includes(id));
  ids.forEach(id => { if(!order.includes(id)) order.push(id); });
  return order;
}
function isOnHome(a){ const off = (S.home && S.home.off) || {}; return off[a.id] === undefined ? !a.homeOff : !off[a.id]; }
const W = k => { const w = (S.home && S.home.widgets) || {}; return w[k] !== false; };
function closeLayer(){ $('#layer').innerHTML = ''; }
function dialog(html, cls){ $('#layer').innerHTML = `<div class="ov" data-act="closeov"><div class="dlg ${cls || ''}">${html}</div></div>`; }

/* ---------------- dates + orders (same rules as Order Tracker) ---------------- */
const MON = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function parseDate(t){
  t = String(t || '').trim(); if(!t) return null;
  let m = t.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[A-Za-z]*[-\/ ,]+(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})\s*([ap]m)?)?/i);
  if(m){ let h = +(m[4] || 0); if(m[6]){ const pm = /p/i.test(m[6]); if(pm && h < 12) h += 12; if(!pm && h === 12) h = 0; } return new Date(+m[3], MON[m[2].toLowerCase()] ?? 0, +m[1], h, +(m[5] || 0)); }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if(m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  const d = new Date(t); return isNaN(d) ? null : d;
}
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtD = d => d ? d.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : '';
const fmtT = d => d ? d.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}) : '';
function whenText(d){ if(!d) return ''; const n = new Date(); const y = new Date(n.getTime() - 86400000); return (sameDay(d, n) ? 'Today' : sameDay(d, y) ? 'Yesterday' : fmtD(d)) + ', ' + fmtT(d); }
function buildOrders(headers, rows){
  const Hd = headers.map(h => String(h || '').trim().toLowerCase());
  const col = n => Hd.indexOf(n.toLowerCase()), find = re => Hd.findIndex(h => re.test(h));
  const ix = {at:col('logged at'), id:col('order id'), hub:col('city code'), name:col('name'), co:col('company'), phone:col('phone'), city:col('city'), courier:col('courier'), trk:col('tracking id'), boxes:col('total boxes'), status:col('dispatch status'), cat:find(/^(category|order category)$/), dd:find(/^dispatch(ed)? date$/), dt:find(/^dispatch(ed)? time$/), deliv:find(/^deliver(y|ed)( status)?$/)};
  const g = (r, i) => i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : '';
  return rows.map((r, n) => {
    const id = g(r, ix.id); if(!id && !g(r, ix.name)) return null;
    const statusTxt = g(r, ix.status), delivTxt = g(r, ix.deliv);
    const dispAt = parseDate(g(r, ix.dd) + (g(r, ix.dt) ? ' ' + g(r, ix.dt) : ''));
    let st;
    if(/deliver/i.test(delivTxt) || /deliver/i.test(statusTxt)) st = 'delivered';
    else if(/return|rto/i.test(delivTxt)) st = 'returned';
    else if(/transit/i.test(delivTxt)) st = 'transit';
    else if(/partly|partial/i.test(statusTxt)) st = 'partly';
    else if((/dispatch|out|picked|shipped/i.test(statusTxt) && !/ready/i.test(statusTxt)) || (dispAt && !/ready/i.test(statusTxt))) st = 'dispatched';
    else if(/ready/i.test(statusTxt)) st = 'ready';
    else st = 'held';
    const cat = g(r, ix.cat) || (/^boxup\s*\d/i.test(id) ? 'B2C' : 'B2B');
    return {n, id, at:parseDate(g(r, ix.at)), name:g(r, ix.name), co:g(r, ix.co), phone:g(r, ix.phone), city:g(r, ix.city), hub:g(r, ix.hub), courier:g(r, ix.courier), trk:g(r, ix.trk), boxes:parseInt(g(r, ix.boxes), 10) || 1, st, statusTxt, dispAt, delivTxt, cat:/b2c/i.test(cat) ? 'B2C' : 'B2B'};
  }).filter(Boolean);
}
const ST = {delivered:['Delivered','s-g'], returned:['Returned (RTO)','s-r'], transit:['In transit','s-b'], dispatched:['Dispatched','s-b'], partly:['Partly dispatched','s-o'], ready:['Ready for dispatch','s-o'], held:['Not dispatched','s-n']};
async function loadFeed(force){
  if(!force && ORDERS.length && Date.now() - feedAt < 15000) return;
  const d = await H.data.sales();
  if(d && d.ok){ ORDERS = buildOrders(d.headers || [], d.rows || []); feedAt = Date.now(); window.__feedErr = ''; }
  else window.__feedErr = (d && d.error) || 'Could not load the Label Log';
}

/* ---------------- sign in ---------------- */
function show(id){ ['boot','login','shell'].forEach(x => $('#' + x).classList.toggle('hide', x !== id)); }
$('#gsign').onclick = async () => { const b = $('#gsign'); b.disabled = true; b.innerHTML = '<i>G</i>Checking…'; const r = await H.auth.status(); b.disabled = false; b.innerHTML = '<i>G</i>Check again'; afterAuth(r); };
function afterAuth(r){
  if(r && r.ok){ ME = {name:r.name || 'Logistics', email:r.email}; enter(); return; }
  const e = $('#lerr');
  if(!r || r.noExt) e.innerHTML = `<b>The BoxUp Chrome extension is not installed in this Chrome.</b><br>1. Open <b>chrome://extensions</b><br>2. Turn on <b>Developer mode</b> (top right)<br>3. Click <b>Load unpacked</b> and choose <b>C:\Project\boxup-hub-chrome</b><br>Then click Check again.`;
  else if(r.noChromeAccount) e.innerHTML = `<b>This Chrome is not signed in to a Google account.</b><br>Click your profile picture at the top right of Chrome and sign in as <b>${esc(r.allowed)}</b>, then click Check again.`;
  else e.innerHTML = `This Chrome is signed in as <b>${esc(r.email)}</b>. Only <b>${esc(r.allowed)}</b> can use the BoxUp Hub. Switch to that Chrome profile, then click Check again.`;
  e.classList.remove('hide');
}

/* ---------------- top bar ---------------- */
function topbar(){
  // Only apps opened from Home or the + menu show in the bar.
  const pinned = [];
  const extra = Object.keys(TABS).map(id => TABS[id].app);
  const btn = a => { const open = !!TABS[a.id], on = current === a.id;
    return `<button class="tb${on ? ' on' : ''}${open ? ' open' : ''}" data-open="${esc(a.id)}" title="${esc(a.name)}"><i style="background:${a.color}">${a.icon}</i>${esc(a.short || a.name)}${'<span class="cx" data-close="' + esc(a.id) + '" title="Close">&#10005;</span>'}</button>`; };
  $('#topbar').innerHTML = `<button class="lgo${current === null ? ' on' : ''}" data-act="home" title="Home"><img src="assets/logo.png" alt="BOXUP"></button>`
    + pinned.concat(extra).map(btn).join('')
    + `<span class="tsp"></span>`
    + (current && TABS[current] ? `<button class="tb ic" data-act="reload" title="Reload">&#8635;</button><button class="tb ic" data-act="print" title="Print this page">&#128424;</button>` : '')
    + `<button class="tb bell" data-act="bell" title="Updates">&#128276;${updateInfo ? '<b>1</b>' : ''}</button>`
    + `<button class="tb dots" data-act="plus" title="BoxUp apps"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="5" r="2.1"/><circle cx="12" cy="5" r="2.1"/><circle cx="19" cy="5" r="2.1"/><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/><circle cx="5" cy="19" r="2.1"/><circle cx="12" cy="19" r="2.1"/><circle cx="19" cy="19" r="2.1"/></svg></button>`
    + `<button class="chip" data-act="menu"><span class="av">${esc((ME.name || 'L')[0].toUpperCase())}</span>${esc(ME.name || 'Logistics')}</button>`;
}

/* ---------------- tabs ---------------- */
function open(id, opts){
  opts = opts || {};
  const a = appById(id) || opts.app;
  if(!a) return;
  if(a.screen){ H.openTab(location.origin + location.pathname + '#delivery', 'deliv'); H.log.add(a.name, 'Opened'); return; }
  if(a.kind === 'program'){ toast('Programs on the PC are not available in the Chrome version'); return; }
  let url = opts.url || a.url, key = id;
  if(id === 'orders' && opts.query !== undefined) url = a.url + '?q=' + encodeURIComponent(opts.query);
  else if(opts.url && id !== 'wa') key = null;            // searches open a fresh tab
  H.openTab(url, key, opts.query !== undefined);
  H.log.add(a.name, opts.query ? 'Searched ' + opts.query : 'Opened');
}
function activate(id){
  current = id;
  $('#home').classList.toggle('hide', id !== null);
  $('#acct').classList.add('hide');
  Object.keys(TABS).forEach(k => { const t = TABS[k]; const on = k === id; t.wv.classList.toggle('off', !on); t.bar.style.display = on ? '' : 'none'; });
  topbar();
}
function closeTab(id){
  const t = TABS[id]; if(!t) return;
  if(t.wv.stop) t.wv.stop();
  t.wv.remove(); t.bar.remove(); delete TABS[id];
  if(current === id) goHome(); else topbar();
}
function goHome(){ current = null; $('#acct').classList.add('hide'); activate(null); renderHome(); }

/* what the program hands to its own web apps */
function injectInto(id, wv){
  const t = TABS[id]; if(t) t.ready = true;
  const url = wv.getURL();
  if(/logisticsboxup\.github\.io/.test(url)){
    const label = JSON.stringify(S.labelDetails || DEFAULT_LABEL), tpl = JSON.stringify(S.waTemplates || DEFAULT_TEMPLATES);
    wv.executeJavaScript(`try{localStorage.setItem('boxup.labelDetails', ${JSON.stringify(label)});localStorage.setItem('boxup.waTemplates', ${JSON.stringify(tpl)});window.dispatchEvent(new Event('boxup-settings'));}catch(e){}`).catch(() => {});
  }
  if(id === 'orders' && t && t.query){
    const q = t.query; t.query = undefined;
    wv.executeJavaScript(`(function go(n){var q=document.getElementById('q');if(!q){if(n<40)setTimeout(function(){go(n+1)},250);return;}q.value=${JSON.stringify(q)};q.dispatchEvent(new Event('input',{bubbles:true}));})(0)`).catch(() => {});
  }
}
function pushSettingsToApps(){ Object.keys(TABS).forEach(k => { if(TABS[k].ready) injectInto(k, TABS[k].wv); }); }

H.on('open-whatsapp', url => {
  let target = 'https://web.whatsapp.com/';
  try {
    const u = new URL(url);
    const text = u.searchParams.get('text') || '';
    let phone = u.searchParams.get('phone') || '';
    if(/wa\.me$/i.test(u.hostname)) phone = u.pathname.replace(/\D/g, '');
    target = 'https://web.whatsapp.com/send?' + (phone ? 'phone=' + phone + '&' : '') + 'text=' + encodeURIComponent(text);
  } catch(e){}
  open('wa', {url:target});
  H.log.add('WhatsApp', 'Opened chat with the message ready');
});
H.on('open-url', url => {
  let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch(e){}
  const id = 'web:' + host;
  const a = appById(id) || {id, name:host, short:host.length > 18 ? host.slice(0, 16) + '…' : host, icon:esc(host[0] || 'W').toUpperCase(), color:grad('#546e7a','#263238'), url, temp:true};
  open(id, {app:a, url});
});
H.on('download', d => {
  if(!d.ok){ toast('Download failed: ' + d.name); return; }
  toast('Saved ' + d.name + ' in Downloads › BoxUp', [['Open', () => H.openFile(d.path)], ['Show in folder', () => H.showFile(d.path)]]);
});
H.on('toast', m => toast(m));
H.on('update-available', c => { updateInfo = c; topbar(); if(S.notifyUpdates !== false) updateNotice(); });
H.on('update-progress', p => {
  const st = $('#ust'); if(!st) return;
  if(p.step === 'download'){ $('#ubar').style.width = Math.round(p.done / p.total * 60) + '%'; $('#ud1 span').textContent = p.done + ' / ' + p.total + ' files'; }
  if(p.step === 'verified'){ $('#ud1').className = 'done'; $('#ud2').className = 'done'; $('#ud3').className = 'now'; $('#ubar').style.width = '80%'; }
  if(p.step === 'installed'){ $('#ud3').className = 'done'; $('#ud4').className = 'now'; $('#ubar').style.width = '100%'; }
});

/* ---------------- home ---------------- */
let mode = 'orders', sugSel = -1;
function renderHome(){
  const h = (S.home || {}), bg = h.bg || 'photo';
  const glass = h.glass == null ? .55 : h.glass;
  document.documentElement.style.setProperty('--glass', glass);
  const bgCss = bg === 'green' ? 'linear-gradient(135deg,#0b281c,#164631)' : bg === 'blue' ? 'linear-gradient(135deg,#1f2a44,#3b4a6b)' : bg === 'custom' && h.bgData ? `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.35)),url(${h.bgData}) center/cover` : '';
  const th = THEMES.some(t => t[0] === bg) ? bg : '';
  const apps = homeOrder().map(appById).filter(a => a && isOnHome(a));
  $('#home').innerHTML = `<div class="bgwrap${bg !== 'photo' ? ' plain' : ''}${th ? ' th' : ''}"${th ? ` data-th="${th}"` : ''} style="${!th && bgCss ? 'background:' + bgCss + ';background-attachment:fixed' : ''}">
    <div class="hero">
      <img class="hlogo" src="assets/logo.png" alt="BOXUP"><span class="tag">Delivering Thoughtful Moments</span>
      <div class="htitle"><h1>Your Logistics<br>Command Center</h1><p>Everything you need to move every shipment forward.</p></div>
      ${W('search') ? `<div class="srch" id="srch"><div class="tgl"><button class="${mode === 'orders' ? 'on' : ''}" data-mode="orders">&#128230; Orders</button><button class="${mode === 'google' ? 'on' : ''}" data-mode="google">G&nbsp; Google</button></div>
        <input id="q" placeholder="${mode === 'orders' ? 'Search Order ID, AWB, company, name or phone' : 'Search Google'}" autocomplete="off"><span class="hint">${mode === 'orders' ? 'opens in Order Tracker' : 'opens a Google tab'}</span><div class="sug hide" id="sug"></div></div>` : ''}
    </div>
    <div class="content">
      <div>
        ${W('nums') ? `<div class="metrics" id="nums">${metricHtml()}</div>` : ''}
        ${W('apps') ? `<section class="glass panel"><div class="sh"><div><h2>Apps</h2><div class="gl"></div></div><small>${apps.length} apps</small></div>
          <div class="qg">${apps.map(a => `<button class="quick" data-open="${esc(a.id)}" title="${esc(a.kind === 'program' ? 'Opens on this computer' : a.name)}"><span class="ico" style="background:${a.color}">${a.icon}</span>${esc(a.name)}</button>`).join('')}<button class="quick" data-act="addweb"><span class="ico addi">+</span>Add app</button></div></section>` : ''}
      </div>
      ${W('recent') ? `<section class="glass panel recent" style="align-self:start"><div class="sh"><div><h2>Recent activity</h2><div class="gl"></div></div><button class="va" data-open="orders">View all &#8594;</button></div><div id="recent">${recentHtml()}</div></section>` : ''}
    </div></div>`;
  const q = $('#q');
  if(q){
    q.addEventListener('input', suggest);
    q.addEventListener('keydown', e => {
      const items = $$('#sug div[data-q]');
      if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); if(!items.length) return; sugSel = (sugSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((d, i) => d.classList.toggle('sel', i === sugSel)); }
      if(e.key === 'Enter'){ const it = items[sugSel]; go(it ? it.dataset.q : q.value); }
      if(e.key === 'Escape') $('#sug').classList.add('hide');
    });
  }
}
function metricHtml(){
  const now = new Date();
  const printed = ORDERS.filter(o => sameDay(o.at, now));
  const disp = ORDERS.filter(o => sameDay(o.dispAt, now));
  const pend = printed.filter(o => o.st === 'ready' || o.st === 'held');
  const pendAll = ORDERS.filter(o => o.st === 'ready' || o.st === 'held');
  const v = n => ORDERS.length ? n : '–';
  const m = (i, t, n, s) => `<div class="glass metric"><div class="mi">${i}</div><h3>${t}</h3><strong>${v(n)}</strong><small>${s}</small></div>`;
  return m('&#127991;', 'Labels printed today', printed.length, 'from Label Log') + m('&#128666;', 'Dispatched today', disp.length, 'scanned at gate')
    + m('&#9203;', 'Pending today', pend.length, 'not yet out') + m('&#128230;', 'Pending (all)', pendAll.length, 'any day');
}
function recentHtml(){
  if(!ORDERS.length) return `<div class="empty">${window.__feedErr ? esc(window.__feedErr) : 'Loading from the Label Log…'}</div>`;
  const list = ORDERS.map(o => ({o, t:Math.max(o.at ? o.at.getTime() : 0, o.dispAt ? o.dispAt.getTime() : 0)})).sort((a, b) => b.t - a.t).slice(0, 6);
  return `<table><thead><tr><th>Order</th><th>Status</th><th>Courier</th><th>Updated</th></tr></thead><tbody>${list.map(({o, t}) => { const [s, c] = ST[o.st]; return `<tr data-order="${esc(o.id)}"><td><b>${esc(o.id)}</b><small>${o.cat} &#183; ${o.boxes} box${o.boxes > 1 ? 'es' : ''}</small></td><td><span class="st ${c}">${s}</span></td><td>${esc(o.courier || '-')}</td><td>${esc(whenText(new Date(t)))}</td></tr>`; }).join('')}</tbody></table>`;
}
function refreshHomeData(){ if($('#nums')) $('#nums').innerHTML = metricHtml(); if($('#recent')) $('#recent').innerHTML = recentHtml(); }
function suggest(){
  const v = $('#q').value.trim(), box = $('#sug'); sugSel = -1;
  if(!v){ box.classList.add('hide'); return; }
  let items;
  if(mode === 'google') items = [v, v + ' near me', v + ' price', v + ' contact number'].map(x => ({q:x, html:'&#128269;&nbsp; ' + esc(x)}));
  else {
    const words = v.toLowerCase().split(/\s+/);
    items = ORDERS.filter(o => { const hay = [o.id, o.name, o.co, o.phone, o.trk, o.city].join(' ').toLowerCase(); return words.every(w => hay.includes(w)); }).slice(0, 8)
      .map(o => ({q:o.id, html:`&#128230;&nbsp; <b>${esc(o.id)}</b><small>${esc([o.co, o.name, o.courier].filter(Boolean).join(' · '))}</small>`}));
    if(!items.length) items = [{q:v, html:'&#128269;&nbsp; Search “' + esc(v) + '” in Order Tracker'}];
  }
  box.innerHTML = items.map(i => `<div data-q="${esc(i.q)}">${i.html}</div>`).join('');
  box.classList.remove('hide');
}
function go(v){
  v = String(v || '').trim(); if(!v) return;
  $('#sug') && $('#sug').classList.add('hide');
  if(mode === 'google'){ open('google', {url:'https://www.google.com/search?q=' + encodeURIComponent(v)}); H.log.add('Google', 'Searched ' + v); }
  else { open('orders', {query:v}); H.log.add('Order Tracker', 'Searched ' + v); }
}

/* ---------------- account menu, + picker ---------------- */
function menu(){
  $('#layer').innerHTML = `<div class="scrim" data-act="closelayer"></div><div class="menu">
    <div class="pr"><span class="av">${esc((ME.name || 'L')[0].toUpperCase())}</span><div><b style="font-size:14.5px">${esc(ME.name)}</b><div style="color:var(--mu)">${esc(ME.email)}</div></div></div>
    <div style="margin-top:8px"><div class="mi2" data-acc="Settings"><span>&#9881;</span>Settings</div></div>
    <div style="color:var(--mu);font-size:12px;margin:10px 4px 2px">Signed in through Chrome. To change account, use Chrome's profile menu.</div></div>`;
}
function plus(){
  const fav = homeOrder().map(appById).filter(a => a && isOnHome(a));
  const others = BUILTIN.concat(S.customApps || []).filter(a => !fav.includes(a));
  const tile = (ic, bg, n, attrs) => `<button class="lt" ${attrs} title="${esc(n)}"><span class="ic" style="background:${bg}">${ic}</span><span class="nm">${esc(n)}</span></button>`;
  const appT = a => tile(a.icon, a.color, a.short || a.name, `data-open="${esc(a.id)}" data-s="${esc(a.name)}"`);
  $('#layer').innerHTML = `<div class="scrim" data-act="closelayer"></div><div class="pk lch">
    <div class="fav"><div class="fh"><h3>Your favorites</h3><button class="pen" data-acc="Home screen" title="Choose your favorites">&#9998;</button></div>
      <div class="lg">${fav.length ? fav.map(appT).join('') : '<div class="emp">No favorites yet. Tap &#9998; to pick apps.</div>'}</div></div>
    ${others.length ? `<div class="lg">${others.map(appT).join('')}</div>` : ''}
    <h4>WEBSITES</h4><div class="lg">${SITES.map(([n, u, c]) => tile(n[0], grad(c, c), n, `data-site="${esc(u)}" data-name="${esc(n)}" data-s="${esc(n)}"`)).join('')}</div>
    <div class="add"><button data-act="addweb">+ Add website</button></div></div>`;
  const q = $('#pkq'); if(!q) return; q.focus();
  q.addEventListener('input', () => { const v = q.value.toLowerCase(); $$('.pk .lt').forEach(b => b.style.display = !v || (b.dataset.s || '').toLowerCase().includes(v) ? '' : 'none'); });
}
function addAppDialog(kind, preset){
  preset = preset || {};
  const prog = kind === 'program';
  dialog(`<h2>${prog ? '+ Add program' : '+ Add website'}</h2><p>${prog ? 'Pin a program installed on this PC. It opens in its own window.' : 'Pin any website. It opens as a Chrome tab, signed in like the rest of Chrome.'}</p>
    <div class="lab">Name</div><input class="inp" id="aaN" value="${esc(preset.name || '')}" placeholder="${prog ? 'e.g. Tally' : 'e.g. ShipRocket panel'}">
    <div class="lab">${prog ? 'Program' : 'Link'}</div><div style="display:flex;gap:8px"><input class="inp" id="aaU" value="${esc(preset.url || '')}" placeholder="${prog ? 'C:\\\\Program Files\\\\…\\\\app.exe' : 'https://'}">${prog ? '<button class="btn" data-act="browseprog">Browse…</button>' : ''}</div>
    <div class="lab">Icon colour</div><div style="display:flex;gap:8px;flex-wrap:wrap" id="aaC">${COLORS.map((c, i) => `<button data-col="${i}" style="width:32px;height:32px;border-radius:9px;border:0;background:linear-gradient(145deg,${c});${i === 0 ? 'outline:3px solid #d9ad56;outline-offset:2px' : ''}"></button>`).join('')}</div>
    <div class="acts"><button class="btn" data-act="closeov">Cancel</button><button class="btn g" data-act="saveapp" data-kind="${kind}">Add to Home</button></div>`);
  window.__col = 0;
}

/* ---------------- settings pages ---------------- */
const PAGES = ['Settings','Home screen','Updates','Connections','WhatsApp messages','Label details','Activity log'];
let accPage = 'Settings';
async function account(page){
  accPage = page || accPage;
  current = '__acct'; Object.values(TABS).forEach(t => { t.wv.classList.add('off'); t.bar.style.display = 'none'; });
  $('#home').classList.add('hide'); $('#acct').classList.remove('hide'); topbar();
  const side = `<div class="card side">${PAGES.map(p => `<button class="${p === accPage ? 'on' : ''}" data-acc="${p}">${p}${p === 'Updates' && updateInfo ? '<span class="nb">1</span>' : ''}</button>`).join('')}</div>`;
  $('#acct').innerHTML = `<div class="set">${side}<div style="flex:1;min-width:0" id="pbody"><div class="empty">Loading…</div></div></div>`;
  $('#pbody').innerHTML = await (PAGE[accPage] || PAGE.Settings)();
  (AFTER[accPage] || (() => {}))();
}
const row = (t, d, c) => `<div class="sr"><div><b>${t}</b><small>${d}</small></div>${c}</div>`;
const tg = (key, on) => `<button class="tg${on ? '' : ' off'}" data-tg="${key}"></button>`;
const sel = (key, val, opts) => `<select class="inp" data-sel="${key}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

const PAGE = {
  async 'Settings'(){
    const printers = await H.printers();
    const startOpts = [['home','Home']].concat(BUILTIN.map(a => [a.id, a.name]));
    return `<div class="phead"><div class="grow"><h1>Settings</h1><div class="sub">Saved in this Chrome</div></div></div><div class="card" style="padding:6px 24px">
      ${row('Theme', 'Light or dark look for the program', sel('theme', S.theme || 'light', [['light','Light'],['dark','Dark']]))}
      ${row('Downloads', 'Label PDFs, manifests and Excel files from BoxUp pages are saved in Downloads › BoxUp', '<button class="btn" data-act="showdl">Open Downloads</button>')}
      ${row('Gate scan alerts', 'Pop-up when a scan at the gate is wrong (not found, already out)', tg('gateAlerts', S.gateAlerts !== false))}
      ${row('Auto refresh', "How often Home's numbers and the Delivery Tracker refresh", sel('refresh', S.refresh || 30, [[10,'Every 10 seconds'],[30,'Every 30 seconds'],[60,'Every minute'],[300,'Every 5 minutes'],[900,'Every 15 minutes'],[1800,'Every 30 minutes'],[86400,'Once a day']]))}</div>`;
  },
  async 'Home screen'(){
    const h = S.home || {}, bg = h.bg || 'photo';
    const rows = homeOrder().map((id, k) => { const a = appById(id); const on = isOnHome(a);
      return `<div class="hsrow${on ? '' : ' offr'}"><span class="arr"><button data-act="hsup" data-k="${k}">&#9650;</button><button data-act="hsdn" data-k="${k}">&#9660;</button></span><span class="hi" style="background:${a.color}">${a.icon}</span><b>${esc(a.name)}${a.kind === 'program' ? '<small>program</small>' : a.custom ? '<small>website</small>' : ''}</b>${a.custom ? `<button class="del" title="Remove" data-act="delapp" data-id="${esc(a.id)}">&#128465;</button>` : ''}<button class="tg${on ? '' : ' off'}" data-act="hsapp" data-id="${esc(a.id)}"></button></div>`; }).join('');
    const bgs = [['photo','url(assets/bg.jpg)'],['green','linear-gradient(135deg,#0b281c,#164631)'],['blue','linear-gradient(135deg,#1f2a44,#3b4a6b)']].concat(h.bgData ? [['custom', `url(${h.bgData})`]] : []);
    return `<div class="phead"><div class="grow"><h1>Home screen</h1><div class="sub">Choose what shows on Home, like editing widgets on a phone. Every new Chrome tab opens this Home.</div></div><button class="btn" data-act="hsreset">Reset to default</button><button class="btn g" data-act="home">View Home</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:22px">
      <div class="card"><div class="lab" style="margin-top:0">Apps on Home <span style="text-transform:none;letter-spacing:0;font-weight:500">(use &#9650; &#9660; to change order)</span></div>${rows}
        <div style="display:flex;gap:12px;margin-top:18px"><button class="btn dash" style="flex:1" data-act="addweb">+ Add website</button></div></div>
      <div><div class="card"><div class="lab" style="margin-top:0">Widgets on Home</div>
        ${row('Apps', 'App shortcuts on Home', tg('w:apps', W('apps')))}${row('Search bar', 'Orders and Google search', tg('w:search', W('search')))}${row("Today's numbers", 'Labels printed, dispatched, pending', tg('w:nums', W('nums')))}${row('Recent activity', 'Latest orders and their status', tg('w:recent', W('recent')))}</div>
      <div class="card" style="margin-top:22px"><div class="labrow"><div class="lab" style="margin:0">Theme</div>
        <label class="arf">Auto refresh ${sel('refresh', S.refresh || 30, [[10,'Every 10 seconds'],[30,'Every 30 seconds'],[60,'Every minute'],[300,'Every 5 minutes'],[900,'Every 15 minutes'],[1800,'Every 30 minutes'],[86400,'Once a day']])}</label></div>
        <div class="thg">${THEMES.map(([k, n]) => `<button class="${bg === k ? 'on' : ''}" data-act="hsbg" data-k="${k}" style="background-image:url(assets/themes/${k}.jpg)">${n}</button>`).join('')}</div>
        <div class="lab">Picture background</div><div class="bgs">${bgs.map(([k, b]) => `<button class="${bg === k ? 'on' : ''}" data-act="hsbg" data-k="${k}" style="background:${b}"></button>`).join('')}<button class="btn dash" style="flex:1 1 0;height:76px" data-act="hsupload">+ Upload</button></div>
        <div class="lab">Card see-through</div><input type="range" min="0.25" max="0.95" step="0.05" value="${h.glass == null ? .55 : h.glass}" id="glass" style="width:100%;accent-color:#0d7650"></div></div></div>`;
  },
  async 'Updates'(){
    const info = await H.info();
    const u = updateInfo && updateInfo.latest;
    const hist = (info.history || []).map(x => `<tr><td><b>${esc(x.version)}</b></td><td style="color:var(--mu)">${esc(fmtD(new Date(x.date)))}</td><td>${esc(x.notes || '')}</td></tr>`).join('') || `<tr><td colspan="3" style="color:var(--mu)">No updates installed yet. Updates arrive here as soon as they are published.</td></tr>`;
    return `<div class="phead"><div class="grow"><h1>Updates</h1><div class="sub">Get new features and fixes. Nothing changes until you press Update now.</div></div></div>
      ${u ? `<div class="card upd" style="margin-bottom:16px"><span class="ui">&#11015;</span><div style="flex:1"><b style="font-size:17px">Version ${esc(u.version)} is ready</b><div style="color:var(--mu);font-size:13px;margin-top:3px">You have ${esc(info.version)} &#183; ${esc((u.notes || []).map(n => n.title || n).join(', '))}</div></div><button class="btn" data-act="bell">What's new</button><button class="btn g" data-act="doupdate">Update now</button></div>` : ''}
      <div class="card" style="padding:6px 24px">
        ${row('Current version', `BoxUp Logistics Hub ${esc(info.version)} (Chrome) &#183; ${info.lastCheck ? 'last checked ' + esc(whenText(new Date(info.lastCheck))) : 'not checked yet'}`, '<button class="btn" data-act="checkupd" id="chk">Check for updates</button>')}
        ${row('Notify me about updates', 'Show a pop-up when a new version is ready', tg('notifyUpdates', S.notifyUpdates !== false))}
        ${row('BoxUp Chrome extension', info.ext ? 'Installed, version ' + esc(info.ext) : 'Not found. Install it from C:\\Project\\boxup-hub-chrome', info.ext ? '<span class="st s-g">Working</span>' : '<span class="st s-r">Missing</span>')}</div>
      <div class="card" style="margin-top:16px;padding:0;overflow:hidden"><div class="lab" style="margin:16px 20px 8px">Update history</div><table class="dt"><tbody>${hist}</tbody></table></div>`;
  },
  async 'Connections'(){
    const a = await H.auth.status();
    const con = (ic, n, d, ok, btn) => `<div class="card con"><span class="ci">${ic}</span><div class="cd"><b>${n}</b><div>${d}</div></div><span class="${ok ? 'ok' : 'no'}">${ok ? '&#10003; Connected' : 'Not connected'}</span>${btn}</div>`;
    const feedOk = !!ORDERS.length;
    return `<div class="phead"><div class="grow"><h1>Connections</h1><div class="sub">Accounts this program uses</div></div></div>
      ${con('&#128203;', 'Google (Sheets and Gmail)', a.ok ? 'Chrome is signed in as ' + esc(a.email) + '. Gmail, Label Log and the Delivery Tracker sheet open signed in.' : 'Chrome is not signed in as ' + esc(a.allowed), a.ok, '<button class="btn" data-open="log">Open Label Log</button>')}
      ${con('&#128172;', 'WhatsApp', 'Open the WhatsApp tab once and scan the QR code from your phone (Settings › Linked devices). It then stays logged in in Chrome.', true, '<button class="btn" data-open="wa">Open WhatsApp</button>')}
      ${con('&#128202;', 'Label Log data (numbers and Order Tracker)', feedOk ? ORDERS.length + ' orders loaded' : esc(window.__feedErr || 'Not loaded yet'), feedOk, '<button class="btn" data-act="testfeed">Test now</button>')}`;
  },
  async 'WhatsApp messages'(){
    const T = S.waTemplates || DEFAULT_TEMPLATES;
    return `<div class="phead"><div class="grow"><h1>WhatsApp messages</h1><div class="sub">Used by Share on WhatsApp in Order Tracker. {name}, {order}, {courier}, {awb}, {link}, {boxes}, {company} fill in by themselves. Point at a message to edit or delete it.</div></div></div>
      <div class="wmg">${T.map((m, k) => `<div class="card wm"><div class="wmact"><button title="Edit" data-act="wmedit" data-k="${k}">&#9998;</button><button title="Delete" class="del" data-act="wmdel" data-k="${k}">&#128465;</button></div><span class="st ${stClass(m.name)}">${esc(m.name)}</span><div class="wmt">${esc(m.text)}</div></div>`).join('')}
      <button class="wmadd" data-act="wmnew"><span>+</span><b>New message</b></button></div>`;
  },
  async 'Label details'(){
    const L = Object.assign({}, DEFAULT_LABEL, S.labelDetails || {}); const F = Object.assign({}, DEFAULT_LABEL.fest, L.fest || {});
    return `<div class="phead"><div class="grow"><h1>Label details</h1><div class="sub">Printed on every label made in this program</div></div><button class="btn" data-act="lpreview">&#128065; Preview label</button></div>
      <div class="card grid2">
        <div><div class="lab">Company name</div><input class="inp" id="ldCo" value="${esc(L.company)}"></div><div><div class="lab">Phone</div><input class="inp" id="ldPh" value="${esc(L.phone)}"></div>
        <div class="span2"><div class="lab">Return address (Shipped By)</div><textarea class="inp" id="ldAd" rows="3">${esc(L.address)}</textarea></div>
        <div class="span2"><div class="lab">Alternative number</div><input class="inp" id="ldAlt" value="${esc(L.alt)}"></div>
        <div class="span2"><div class="lab">Footer line</div><input class="inp" id="ldFt" value="${esc(L.footer)}"></div>
        <div class="span2" style="border-top:1px solid var(--line);margin-top:20px;padding-top:4px">
          ${row('Festival tag on labels', 'Prints the festival name in a black strip above the last line, and hides the footer line', `<button class="tg${F.on ? '' : ' off'}" id="ftOn" data-act="fton"></button>`)}
          <div class="lab">Festival</div><div class="fpick">${FESTS.map(([n, t]) => `<button class="btn${F.name === n ? ' on' : ''}" data-act="ftpick" data-n="${esc(n)}" data-t="${esc(t)}">${esc(n)}</button>`).join('')}</div>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:0 16px"><div><div class="lab">Text on the label</div><input class="inp" id="ftTx" value="${esc(F.text)}" maxlength="22"></div><div><div class="lab">From</div><input class="inp" type="date" id="ftFrom" value="${esc(F.from)}"></div><div><div class="lab">To</div><input class="inp" type="date" id="ftTo" value="${esc(F.to)}"></div></div>
          <small style="display:block;color:var(--mu);font-size:12.5px;margin-top:8px">Leave the dates empty to print it every day while it is switched on. Black and white only.</small></div>
        <div class="span2" style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn" data-act="ldreset">Reset to default</button><button class="btn g" data-act="ldsave">Save</button></div></div>`;
  },
  async 'Activity log'(){
    await loadFeed();
    return `<div class="phead"><div class="grow"><h1>Activity log</h1><div class="sub">Everything printed, scanned, sent or changed</div></div>
      <select class="inp" id="alWhen" style="width:160px"><option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="0">All</option></select>
      <select class="inp" id="alApp" style="width:190px"><option value="">All apps</option></select><button class="btn" data-act="alxls">&#11015; Excel</button></div>
      <div class="card" style="padding:0;overflow:hidden"><div id="alList"></div></div>`;
  },
};
function stClass(n){ n = String(n).toLowerCase(); return /deliver/.test(n) ? 's-g' : /delay|rto|return/.test(n) ? 's-r' : /ready/.test(n) ? 's-o' : /dispatch|transit|out for/.test(n) ? 's-b' : 's-n'; }
let ACT = [];
const AFTER = {
  'Home screen'(){ const g = $('#glass'); if(g) g.addEventListener('change', () => saveHome({glass:+g.value})); },
  async 'Activity log'(){
    const local = await H.log.list();
    const ev = [];
    ORDERS.forEach(o => {
      if(o.at) ev.push({at:o.at.getTime(), app:'Label Generator', what:`Label printed · ${o.id}${o.co ? ' · ' + o.co : o.name ? ' · ' + o.name : ''} · ${o.boxes} box${o.boxes > 1 ? 'es' : ''}`});
      if(o.dispAt) ev.push({at:o.dispAt.getTime(), app:'Gate Scanner', what:`Dispatched at gate · ${o.id}${o.courier ? ' · ' + o.courier : ''}`});
      if(/deliver/i.test(o.delivTxt)) ev.push({at:(o.dispAt || o.at || new Date(0)).getTime(), app:'Delivery Tracker', what:`Marked delivered · ${o.id}`, noTime:true});
    });
    local.forEach(l => ev.push({at:l.at, app:l.app, what:l.what}));
    ACT = ev.sort((a, b) => b.at - a.at);
    const apps = [...new Set(ACT.map(e => e.app))].sort();
    $('#alApp').innerHTML = '<option value="">All apps</option>' + apps.map(a => `<option>${esc(a)}</option>`).join('');
    const draw = () => {
      const days = +$('#alWhen').value, ap = $('#alApp').value, since = days ? new Date(new Date().setHours(0, 0, 0, 0) - (days - 1) * 86400000).getTime() : 0;
      const list = ACT.filter(e => e.at >= since && (!ap || e.app === ap));
      window.__actView = list;
      $('#alList').innerHTML = list.length ? `<table class="dt"><thead><tr><th style="width:200px">Time</th><th>What happened</th><th style="width:180px">App</th></tr></thead><tbody>${list.slice(0, 400).map(e => `<tr><td style="color:var(--mu)">${e.noTime ? '' : esc(whenText(new Date(e.at)))}</td><td>${esc(e.what)}</td><td><span class="st s-n">${esc(e.app)}</span></td></tr>`).join('')}</tbody></table>${list.length > 400 ? '<div class="empty">Showing the newest 400. Download Excel for all.</div>' : ''}` : '<div class="empty">Nothing in this period.</div>';
    };
    $('#alWhen').onchange = draw; $('#alApp').onchange = draw; draw();
  },
};
async function saveHome(patch){ await save({home:Object.assign({}, S.home || {}, patch)}); }
function labelFromForm(){
  const L = Object.assign({}, DEFAULT_LABEL, S.labelDetails || {});
  const F = Object.assign({}, DEFAULT_LABEL.fest, L.fest || {});
  if($('#ldCo')){ L.company = $('#ldCo').value.trim(); L.phone = $('#ldPh').value.trim(); L.address = $('#ldAd').value.trim(); L.alt = $('#ldAlt').value.trim(); L.footer = $('#ldFt').value.trim(); F.text = $('#ftTx').value.trim().toUpperCase(); F.from = $('#ftFrom').value; F.to = $('#ftTo').value; }
  L.fest = F; return L;
}
function festActive(F){ if(!F || !F.on || !F.text) return ''; const t = new Date(), d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); if(F.from && d < F.from) return ''; if(F.to && d > F.to) return ''; return F.text; }
function previewLabel(){
  const L = labelFromForm(), fest = festActive(L.fest) || (L.fest.on ? L.fest.text : '');
  dialog(`<div style="display:flex;align-items:center;margin-bottom:12px"><h2 style="margin:0">&#128065; Label preview</h2><span style="margin-left:auto;color:var(--mu);font-size:12.5px">10 x 15 cm &#183; sample order</span></div>
    <div class="lp${fest ? ' has-fest' : ''}"><div class="r1"><div class="to"><h5>Ship To</h5>Name: Asha Menon<br>Phone: 9845012345<br>Address: 14, 2nd Cross, Indiranagar<br>Pincode: 560038<br>City: Bengaluru<br>State: Karnataka</div>
    <div class="side"><div class="logo">BOXUP</div><div class="cour">Shree Anjani</div><div class="awb">TRACKING ID<br>SA90021876</div><div style="font-size:11px;margin-top:6px">Type: <b>Forward</b></div></div></div>
    <div class="r2"><div class="by"><b>Shipped By (If undelivered, return to)</b>${esc(L.company)}
${esc(L.address)}
Phone: ${esc(L.phone)}
Alternative Number: ${esc(L.alt)}</div><div class="ord">Shipment Date: ${esc(fmtD(new Date()))}<b>AIR SHIPPING</b><b>Order #: NSTR-2291</b></div></div>
    <div class="bx"><span class="code">BLR</span>Box <span class="n">1</span> of <span class="n">3</span></div>
    ${fest ? `<div class="fest" id="lpf">${esc(fest)}</div>` : `<div class="ft">${esc(L.footer)}</div>`}
    <div class="ag">THIS IS AN AUTO-GENERATED LABEL AND DOES NOT NEED SIGNATURE.</div></div>
    ${L.fest.on && !festActive(L.fest) ? '<p style="text-align:center;margin-top:10px">Festival dates are not today, so real labels will not show the strip yet.</p>' : ''}
    <div class="acts"><button class="btn" data-act="closeov">Close</button><button class="btn g" data-open="labels">Open Label Generator</button></div>`);
  const f = $('#lpf'); if(f){ let s = 46; while(s > 18 && f.scrollWidth > f.clientWidth){ f.style.fontSize = --s + 'px'; } }
}
function wmDialog(k){
  const T = S.waTemplates || DEFAULT_TEMPLATES, m = k == null ? {name:'', text:'Hello {name}, '} : T[k];
  dialog(`<h2>${k == null ? '+ New message' : '&#9998; Edit message'}</h2><p>Use {name}, {order}, {courier}, {awb}, {link}, {boxes}, {company}. Messages named like a status (Dispatched, Delivered…) are used for that status.</p>
    <div class="lab">Message name</div><input class="inp" id="wmN" value="${esc(m.name)}" placeholder="e.g. Payment reminder">
    <div class="lab">Message</div><textarea class="inp" id="wmT" rows="6">${esc(m.text)}</textarea>
    <div class="acts"><button class="btn" data-act="closeov">Cancel</button><button class="btn g" data-act="wmsave" data-k="${k == null ? '' : k}">Save</button></div>`);
}

/* ---------------- updates ---------------- */
function updateNotice(){
  const u = updateInfo && updateInfo.latest; if(!u) { toast('You have the latest version'); return; }
  $('#layer').innerHTML = `<div class="scrim" data-act="closelayer"></div><div class="un"><div class="uh"><span>&#11015;</span><div><b style="font-size:15px">Update available</b><div style="font-size:12px;color:#cfe0d4">Version ${esc(u.version)}${u.date ? ' &#183; ' + esc(u.date) : ''}</div></div><button data-act="closelayer" style="margin-left:auto;border:0;background:none;color:#fff;opacity:.7;font-size:16px">&#10005;</button></div>
    <div class="ul">${(u.notes || []).map(n => `<div><span>${n.icon || '&#10022;'}</span><div><b>${esc(n.title || n)}</b>${n.text ? `<div style="color:var(--mu);font-size:12.5px;margin-top:2px">${esc(n.text)}</div>` : ''}</div></div>`).join('') || '<div>New improvements</div>'}</div>
    <div class="uf"><button class="btn" style="flex:1" data-act="closelayer">Later</button><button class="btn g" style="flex:1.3" data-act="doupdate">Update now</button></div></div>`;
}
async function doUpdate(){
  const u = updateInfo && updateInfo.latest;
  dialog(`<div id="ust" style="display:flex;align-items:center;gap:12px"><span style="width:44px;height:44px;border-radius:12px;background:#0b281c;color:#d9ad56;display:flex;align-items:center;justify-content:center;font-size:22px">&#11015;</span><div><h2 style="margin:0">Updating BoxUp Logistics Hub</h2><p style="margin:2px 0 0">Version ${esc(u ? u.version : '')}</p></div></div>
    <div class="steps" style="margin-top:18px"><div id="ud1" class="now"><i>1</i><b>Downloading update</b><span style="margin-left:auto;color:var(--mu);font-size:12.5px"></span></div><div id="ud2"><i>2</i><b>Checking the files are safe</b></div><div id="ud3"><i>3</i><b>Installing new version</b></div><div id="ud4"><i>4</i><b>Restart the program</b></div></div>
    <div class="bar"><div id="ubar"></div></div><p style="margin-top:14px">Your logins, settings and saved messages stay as they are. The program restarts by itself when done.</p><div id="uerr"></div>`);
  const r = await H.update.install();
  if(!r.ok){ $('#uerr').innerHTML = `<p style="color:#9E2B25;font-weight:700">${esc(r.error)}</p><div class="acts"><button class="btn" data-act="closeov">Close</button></div>`; }
}

/* ---------------- one click handler ---------------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-open],[data-act],[data-acc],[data-close],[data-mode],[data-tg],[data-site],[data-prog],[data-order],[data-q],[data-col]');
  if(!t) return;
  if(t.dataset.act === 'closeov' && e.target !== t && !e.target.closest('button[data-act="closeov"]')) return;
  if(t.dataset.close){ e.stopPropagation(); closeTab(t.dataset.close); return; }
  if(t.dataset.q !== undefined && t.closest('#sug')){ go(t.dataset.q); return; }
  if(t.dataset.col !== undefined){ window.__col = +t.dataset.col; $$('#aaC button').forEach(b => b.style.outline = b === t ? '3px solid #d9ad56' : 'none'); return; }
  if(t.dataset.order){ open('orders', {query:t.dataset.order}); return; }
  if(t.dataset.mode){ mode = t.dataset.mode; renderHome(); $('#q').focus(); return; }
  if(t.dataset.open){ closeLayer(); if(t.dataset.open === current) return; open(t.dataset.open); return; }
  if(t.dataset.acc){ closeLayer(); account(t.dataset.acc); return; }
  if(t.dataset.site){ closeLayer(); const id = 'site:' + t.dataset.site; open(id, {app:{id, name:t.dataset.name, short:t.dataset.name, icon:t.dataset.name[0], color:grad('#546e7a','#263238'), url:t.dataset.site}}); return; }
  if(t.dataset.prog){ closeLayer(); H.openProgram(t.dataset.prog); H.log.add('Program', 'Opened ' + t.dataset.name); toast('Opening ' + t.dataset.name); return; }
  if(t.dataset.tg){
    const k = t.dataset.tg, on = t.classList.contains('off'); t.classList.toggle('off', !on);
    if(k.startsWith('w:')){ const w = Object.assign({}, (S.home || {}).widgets || {}); w[k.slice(2)] = on; await saveHome({widgets:w}); }
    else { await save({[k]: on}); if(k === 'notifyUpdates' && on) H.update.check().then(c => { if(c.available){ updateInfo = c; topbar(); } }); }
    toast('Saved'); return;
  }
  const a = t.dataset.act;
  if(a === 'home'){ closeLayer(); if(DELIV_MODE){ H.openTab(location.origin + location.pathname, 'hub'); return; } goHome(); }
  else if(a === 'menu'){ menu(); }
  else if(a === 'plus'){ plus(); }
  else if(a === 'closelayer' || a === 'closeov'){ closeLayer(); }
  else if(a === 'reload'){ const tb = TABS[current]; if(tb) tb.wv.reload(); }
  else if(a === 'print'){ const tb = TABS[current]; if(tb) tb.wv.print(S.printer ? {deviceName:S.printer} : {}).catch(() => {}); }
  else if(a === 'bell'){ if(updateInfo) updateNotice(); else { toast('Checking for updates…'); const c = await H.update.check(); if(c.available){ updateInfo = c; topbar(); updateNotice(); } else toast(c.error ? c.error : 'You have the latest version (' + c.current + ')'); } }
  else if(a === 'doupdate'){ doUpdate(); }
  else if(a === 'checkupd'){ t.disabled = true; t.textContent = 'Checking…'; const c = await H.update.check(); if(c.available){ updateInfo = c; } else toast(c.error ? c.error : 'You have the latest version'); account('Updates'); }
  else if(a === 'rollback'){ dialog(`<h2>Go back to the previous version?</h2><p>The program restarts on the previous version. Your settings stay as they are.</p><div class="acts"><button class="btn" data-act="closeov">Cancel</button><button class="btn r" data-act="rollbackok">Roll back</button></div>`); }
  else if(a === 'rollbackok'){ closeLayer(); toast('Going back…'); H.update.rollback(); }
  else if(a === 'signout'){ closeLayer(); await H.auth.signOut(); Object.keys(TABS).forEach(closeTab); show('login'); }
  else if(a === 'signin'){ const r = await H.auth.signIn(); if(r.ok){ ME = {name:r.name, email:r.email}; toast('Signed in'); } account('Connections'); }
  else if(a === 'testfeed'){ toast('Loading the Label Log…'); await loadFeed(true); account('Connections'); }
  else if(a === 'addweb'){ addAppDialog('web'); }
  else if(a === 'addprog'){ addAppDialog('program'); }
  else if(a === 'pickprog'){ closeLayer(); const p = await H.pickProgram(); if(p) addAppDialog('program', {url:p, name:p.split(/[\\/]/).pop().replace(/\.(exe|lnk|bat|cmd|msc)$/i, '')}); }
  else if(a === 'browseprog'){ const p = await H.pickProgram(); if(p){ $('#aaU').value = p; if(!$('#aaN').value) $('#aaN').value = p.split(/[\\/]/).pop().replace(/\.(exe|lnk|bat|cmd|msc)$/i, ''); } }
  else if(a === 'saveapp'){
    const name = $('#aaN').value.trim(); let url = $('#aaU').value.trim(); const prog = t.dataset.kind === 'program';
    if(!name || !url){ toast('Fill in the name and the ' + (prog ? 'program' : 'link')); return; }
    if(!prog && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    const c = COLORS[window.__col || 0].split(',');
    const app = {id:'c_' + Date.now().toString(36), name, short:name.length > 16 ? name.slice(0, 15) + '…' : name, icon:esc(name[0].toUpperCase()), color:grad(c[0], c[1]), custom:true, kind:prog ? 'program' : 'web'};
    if(prog) app.path = url; else app.url = url;
    await save({customApps:(S.customApps || []).concat([app])});
    closeLayer(); toast(name + ' added to Home'); H.log.add('Home screen', 'Added ' + name);
    if(current === '__acct') account(accPage); else { topbar(); renderHome(); }
  }
  else if(a === 'delapp'){ await save({customApps:(S.customApps || []).filter(x => x.id !== t.dataset.id)}); closeTab(t.dataset.id); account('Home screen'); }
  else if(['hsapp','hsup','hsdn','hsbg','hsreset','hsupload'].includes(a)){
    const h = Object.assign({}, S.home || {}); const order = homeOrder(); const k = +t.dataset.k;
    if(a === 'hsapp'){ const off = Object.assign({}, h.off || {}); const ap = appById(t.dataset.id); off[ap.id] = isOnHome(ap); h.off = off; }
    if(a === 'hsup' && k > 0){ [order[k - 1], order[k]] = [order[k], order[k - 1]]; h.order = order; }
    if(a === 'hsdn' && k < order.length - 1){ [order[k + 1], order[k]] = [order[k], order[k + 1]]; h.order = order; }
    if(a === 'hsbg') h.bg = t.dataset.k;
    if(a === 'hsupload'){ const d = await H.pickImage(); if(!d) return; h.bgData = d; h.bg = 'custom'; }
    if(a === 'hsreset'){ delete h.order; delete h.off; h.widgets = {}; h.bg = 'photo'; h.glass = .55; }
    await save({home:h}); account('Home screen'); topbar();
  }
  else if(a === 'wmnew'){ wmDialog(null); }
  else if(a === 'wmedit'){ wmDialog(+t.dataset.k); }
  else if(a === 'wmdel'){ const T = S.waTemplates || DEFAULT_TEMPLATES; dialog(`<h2>&#128465; Delete message?</h2><p>"${esc(T[+t.dataset.k].name)}" will be removed.</p><div class="acts"><button class="btn" data-act="closeov">Cancel</button><button class="btn r" data-act="wmdelok" data-k="${t.dataset.k}">Delete</button></div>`); }
  else if(a === 'wmdelok' || a === 'wmsave'){
    const T = (S.waTemplates || DEFAULT_TEMPLATES).slice(); const k = t.dataset.k;
    if(a === 'wmdelok') T.splice(+k, 1);
    else { const name = $('#wmN').value.trim() || 'New message', text = $('#wmT').value; if(k === '') T.push({name, text}); else T[+k] = {name, text}; }
    await save({waTemplates:T}); closeLayer(); pushSettingsToApps(); account('WhatsApp messages'); toast(a === 'wmdelok' ? 'Message deleted' : 'Message saved');
  }
  else if(a === 'fton'){ t.classList.toggle('off'); const L = labelFromForm(); L.fest.on = !t.classList.contains('off'); await save({labelDetails:L}); pushSettingsToApps(); toast(L.fest.on ? 'Festival tag on' : 'Festival tag off'); }
  else if(a === 'ftpick'){ const L = labelFromForm(); L.fest.name = t.dataset.n; L.fest.text = t.dataset.t; L.fest.on = true; await save({labelDetails:L}); pushSettingsToApps(); account('Label details'); }
  else if(a === 'lpreview'){ previewLabel(); }
  else if(a === 'ldsave'){ const L = labelFromForm(); await save({labelDetails:L}); pushSettingsToApps(); H.log.add('Label details', 'Saved label details'); toast('Label details saved. New labels use them.'); }
  else if(a === 'ldreset'){ await save({labelDetails:JSON.parse(JSON.stringify(DEFAULT_LABEL))}); pushSettingsToApps(); account('Label details'); toast('Back to default'); }
  else if(a === 'showdl'){ H.showFile(); }
  else if(a === 'recheck'){ const r = await H.auth.status(); afterAuth(r); }
  else if(a === 'alxls'){
    const list = window.__actView || [];
    const ws = XLSX.utils.aoa_to_sheet([['Time','What happened','App']].concat(list.map(e => [e.noTime ? '' : whenText(new Date(e.at)), e.what, e.app])));
    ws['!cols'] = [{wch:22},{wch:70},{wch:18}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Activity');
    XLSX.writeFile(wb, 'BoxUp Activity ' + fmtD(new Date()).replace(/\s+/g, '-') + '.xlsx');
  }
});
document.addEventListener('change', async e => {
  const s = e.target.closest('[data-sel]'); if(!s) return;
  const k = s.dataset.sel, v = k === 'refresh' ? +s.value : s.value;
  await save({[k]: v}); if(k === 'theme') applyTheme(); if(k === 'refresh') startTimers(); toast('Saved');
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') closeLayer();
  if(e.ctrlKey && e.key.toLowerCase() === 'w' && current && TABS[current]){ e.preventDefault(); closeTab(current); }
  if(e.key === 'F5' && current && TABS[current]){ e.preventDefault(); TABS[current].wv.reload(); }
});
document.addEventListener('mousedown', e => { if(!e.target.closest('#srch') && $('#sug')) $('#sug').classList.add('hide'); });

/* ---------------- timers: home numbers + gate alerts ---------------- */
let tHome = null, tGate = null, seenGate = null;
function startTimers(){
  clearInterval(tHome); clearInterval(tGate);
  tHome = setInterval(async () => { if(document.hidden) return; await loadFeed(true); if(current === null) refreshHomeData(); }, (S.refresh || 30) * 1000);
  tGate = setInterval(checkGate, 45000); checkGate();
}
async function checkGate(){
  if(S.gateAlerts === false) return;
  const d = await H.data.gateToday(); if(!d || !d.ok) return;
  const bad = (d.list || []).filter(r => ['NOT FOUND','ALREADY OUT','MISMATCH'].includes(r.status));
  const keys = bad.map(r => r.at + '|' + r.orderid + '|' + r.status);
  if(seenGate === null){ seenGate = new Set(keys); return; }
  bad.forEach((r, i) => { if(!seenGate.has(keys[i])){ seenGate.add(keys[i]); H.notify('Gate scan problem', `${r.status}: ${r.orderid}${r.by ? ' (guard ' + r.by + ')' : ''}`); toast(`Gate: ${r.status} · ${r.orderid}`, [['Open Gate System', () => open('gsys')]]); } });
}
function applyTheme(){ document.body.classList.toggle('dark', S.theme === 'dark'); }

/* ---------------- start ---------------- */
async function enter(){
  show('shell');
  applyTheme();
  topbar(); renderHome();
  const sp = S.startPage && S.startPage !== 'home' ? S.startPage : null;
  if(sp && appById(sp)) open(sp);
  await loadFeed(true); if(current === null) refreshHomeData();
  startTimers();
}
const DELIV_MODE = location.hash === '#delivery';
function enterDelivery(){
  show('shell'); applyTheme(); topbar();
  $('#home').classList.add('hide');
  document.title = 'Delivery Tracker · BoxUp';
  const el = document.createElement('div'); $('#tabs').appendChild(el);
  const a = appById('deliv');
  window.DelivScreen.mount(el, {hub:H, toast, sheetUrl:a.url, every:() => (S.refresh || 30) * 1000, templates:() => S.waTemplates || DEFAULT_TEMPLATES,
    openWhatsApp:(phone, text) => open('wa', {url:'https://web.whatsapp.com/send?' + (phone ? 'phone=' + phone + '&' : '') + 'text=' + encodeURIComponent(text)}), dialog});
}
(async function boot(){
  S = await H.settings.get();
  const info = await H.info(); document.title = 'BoxUp Logistics Hub';
  const r = await H.auth.status();
  if(r.ok){ ME = {name:r.name, email:r.email}; if(DELIV_MODE) enterDelivery(); else enter(); }
  else { show('login'); afterAuth(r); }
  setInterval(async () => { const c = await H.update.check(); if(c.available && !updateInfo){ updateInfo = c; topbar(); if(S.notifyUpdates !== false && !DELIV_MODE) updateNotice(); } }, 10 * 60 * 1000);
})();
