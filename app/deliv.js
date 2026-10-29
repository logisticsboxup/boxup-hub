/* BoxUp Logistics Hub: Delivery Tracker screen
   Reads the Delivery Tracker sheet through the Label Log script and saves
   Delivery Status back to it. No Google sign-in is needed inside the Hub. */
'use strict';
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PILL = {'pending':'s-o', 'in transit':'s-b', 'delivered':'s-g', 'returned (rto)':'s-r'};
  const pill = s => PILL[String(s || '').toLowerCase()] || 's-n';
  const DOT = {'s-o':'#e0a422', 's-b':'#2a6fd6', 's-g':'#0d7650', 's-r':'#c0392b', 's-n':'#999'};
  const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  function pdate(t){ const m = String(t || '').match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[A-Za-z]*[-\/ ,]+(\d{4})/); if(m) return new Date(+m[3], MONTHS[m[2].toLowerCase()] ?? 0, +m[1]); const d = new Date(t); return isNaN(d) ? null : d; }
  const C = {id:0, awb:1, state:2, name:3, phone:4, addr:5, pin:6, dd:7, link:8, st:9};
  const PAGE = 300;

  function mount(el, ctx){
    const H = ctx.hub;
    const st = {data:null, tab:null, q:'', fState:'', fStatus:'', fDate:'', sel:new Set(), loading:false, err:'', limit:PAGE, menu:null};
    el.className = 'screen dv';

    let sig = '';
    async function load(force, silent){
      if(st.loading) return; st.loading = true;
      if(!silent){ st.err = ''; draw(); }
      try {
        const d = await H.data.deliv(force);
        if(!d || !d.ok) throw new Error((d && d.error) || 'Could not load the Delivery Tracker');
        const ns = JSON.stringify(d.tabs);
        if(silent){
          st.loading = false;
          const typing = document.activeElement && el.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
          if(ns === sig || typing || st.menu) { if(st.data) st.data.at = d.at; const lv = el.querySelector('.dv-live'); if(lv && ns === sig) lv.textContent = 'Live from your sheet · updated ' + new Date(d.at || Date.now()).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}); return; }
          sig = ns; st.data = d; const y = el.scrollTop; draw(); el.scrollTop = y; return;
        }
        sig = ns; st.data = d;
        if(!st.tab || (st.tab !== ALL && !d.tabs.some(t => t.name === st.tab))) st.tab = ALL;
      } catch(e){ st.loading = false; if(silent) return; st.err = String(e.message || e); }
      st.loading = false; draw();
    }
    const ALL = '__all';
    const tabRows = () => { if(!st.data) return []; if(st.tab === ALL) return st.data.tabs.reduce((a, t) => a.concat(t.rows), []); const t = st.data.tabs.find(x => x.name === st.tab); return t ? t.rows : []; };
    function filtered(){
      const q = st.q.trim().toLowerCase(), now = new Date(); now.setHours(0,0,0,0);
      return tabRows().filter(r => {
        if(st.fState && r[C.state] !== st.fState) return false;
        if(st.fStatus && (r[C.st] || 'Pending') !== st.fStatus) return false;
        if(st.fDate){
          const d = pdate(r[C.dd]);
          if(st.fDate === 'none'){ if(d) return false; }
          else { if(!d) return false; const days = (now - d) / 86400000; if(st.fDate === 'today' && days !== 0) return false; if(st.fDate === '7' && days > 7) return false; if(st.fDate === '30' && days > 30) return false; }
        }
        if(q && !r.slice(0, 9).join(' ').toLowerCase().includes(q)) return false;
        return true;
      });
    }
    function counts(rows){ const c = {all:rows.length}; rows.forEach(r => { const k = pill(r[C.st] || 'Pending'); c[k] = (c[k] || 0) + 1; }); return c; }
    const opts = () => (st.data && st.data.opts) || ['Pending', 'In Transit', 'Delivered', 'Returned (RTO)'];

    function draw(){
      const d = st.data;
      if(!d){
        el.innerHTML = `<div class="dv-wrap"><div class="dv-head"><div><h1>Delivery Tracker</h1><div class="dv-sub">${st.err ? '' : 'Loading the Delivery Tracker sheet…'}</div></div></div>
          ${st.err ? `<div class="dv-err">${esc(st.err)}<br><button class="btn" data-dv="retry">Try again</button> <button class="btn" data-dv="chrome">Open sheet in Chrome</button></div>` : '<div class="dv-load"><span class="spin"></span>Loading…</div>'}</div>`;
        return;
      }
      const all = tabRows(), rows = filtered(), c = counts(all);
      const states = [...new Set(all.map(r => r[C.state]).filter(Boolean))].sort();
      const shown = rows.slice(0, st.limit);
      const when = new Date(d.at || Date.now()).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
      const selOpt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
      el.innerHTML = `<div class="dv-wrap">
        <div class="dv-head">
          <div><h1>Delivery Tracker <span class="dv-live${st.loading ? ' busy' : ''}">${st.loading ? 'Refreshing…' : 'Live from your sheet · updated ' + esc(when)}</span></h1>
          <div class="dv-sub">BoxUp Delivery Tracker (Shree Anjani). Changes here save straight to the Google Sheet.</div></div>
          <span class="dv-sp"></span>
          <button class="btn" data-dv="refresh">&#8635; Refresh</button>
          <button class="btn" data-dv="excel">&#11015; Excel</button>
          <button class="btn" data-dv="chrome">&#8599; Open sheet in Chrome</button>
        </div>
        ${st.err ? `<div class="dv-err">${esc(st.err)}</div>` : ''}
        <div class="dv-tabs">${(() => {
          const total = d.tabs.reduce((n, t) => n + t.rows.length, 0);
          const big = d.tabs.filter(t => t.rows.length).slice().sort((a, b) => (b.name === 'B2C') - (a.name === 'B2C') || b.rows.length - a.rows.length).slice(0, 8);
          if(st.tab !== ALL && !big.some(t => t.name === st.tab)){ const cur = d.tabs.find(t => t.name === st.tab); if(cur) big.push(cur); }
          const rest = d.tabs.filter(t => !big.includes(t)).sort((a, b) => a.name.localeCompare(b.name));
          return `<button class="dv-tab${st.tab === ALL ? ' on' : ''}" data-dvtab="${ALL}">All <small>${total}</small></button>`
            + big.map(t => `<button class="dv-tab${t.name === st.tab ? ' on' : ''}" data-dvtab="${esc(t.name)}">${esc(t.name)} <small>${t.rows.length}</small></button>`).join('')
            + (rest.length ? `<select id="dvmore" class="dv-tab"><option value="">More companies (${rest.length}) &#9662;</option>${rest.map(t => `<option value="${esc(t.name)}">${esc(t.name)} (${t.rows.length})</option>`).join('')}</select>` : '');
        })()}</div>
        <div class="dv-kp">
          <button class="dv-k${!st.fStatus ? ' on' : ''}" data-dvst=""><b>${c.all}</b><span>Total shipments</span></button>
          ${opts().map(o => { const k = pill(o); return `<button class="dv-k ${k}${st.fStatus === o ? ' on' : ''}" data-dvst="${esc(o)}"><b>${c[k] || 0}</b><span>${esc(o)}</span></button>`; }).join('')}
        </div>
        <div class="dv-bar">
          <div class="dv-search">&#128269;<input id="dvq" placeholder="Search order ID, AWB, name, phone, address or pincode" value="${esc(st.q)}"></div>
          <select id="dvstate">${selOpt('', 'State: All', st.fState)}${states.map(s => selOpt(s, s, st.fState)).join('')}</select>
          <select id="dvstatus">${selOpt('', 'Status: All', st.fStatus)}${opts().map(o => selOpt(o, o, st.fStatus)).join('')}</select>
          <select id="dvdate">${selOpt('', 'Dispatch: Any date', st.fDate)}${selOpt('today', 'Dispatched today', st.fDate)}${selOpt('7', 'Last 7 days', st.fDate)}${selOpt('30', 'Last 30 days', st.fDate)}${selOpt('none', 'Not dispatched yet', st.fDate)}</select>
        </div>
        <div class="dv-tw"><table class="dv-t">
          <thead><tr><th class="cb"><input type="checkbox" data-dv="all"${shown.length && shown.every(r => st.sel.has(r[C.id])) ? ' checked' : ''}></th><th>Order ID</th><th>AWB No</th><th>State</th><th>Name</th><th>Number</th><th>Pincode</th><th>Dispatch</th><th>Tracking</th><th>Delivery status</th><th></th></tr></thead>
          <tbody>${shown.length ? shown.map(r => { const s = r[C.st] || 'Pending', on = st.sel.has(r[C.id]);
            return `<tr class="${on ? 'sel' : ''}" title="${esc(r[C.addr])}">
              <td class="cb"><input type="checkbox" data-dvsel="${esc(r[C.id])}"${on ? ' checked' : ''}></td>
              <td class="mono">${esc(r[C.id])}</td><td class="mono">${esc(r[C.awb])}</td><td>${esc(r[C.state])}</td><td class="nm">${esc(r[C.name])}</td>
              <td class="mono">${esc(r[C.phone])}</td><td>${esc(r[C.pin])}</td><td>${esc(r[C.dd] || '-')}</td>
              <td>${r[C.link] ? `<a class="dv-trk" data-dvlink="${esc(r[C.link])}">Track &#8599;</a>` : '-'}</td>
              <td><button class="dv-st ${pill(s)}" data-dvpick="${esc(r[C.id])}">${esc(s)} &#9662;</button></td>
              <td><a class="dv-wa" data-dvwa="${esc(r[C.id])}">WhatsApp</a></td></tr>`; }).join('')
            : `<tr><td colspan="11" class="dv-empty">${all.length ? 'No orders match these filters.' : 'This tab is empty.'}</td></tr>`}</tbody>
        </table>
        ${rows.length > shown.length ? `<div class="dv-more"><button class="btn" data-dv="more">Show more (${rows.length - shown.length} left)</button></div>` : ''}
        </div>
        <div class="dv-foot">${rows.length} of ${all.length} orders shown</div>
      </div>
      ${st.waQueue && st.waQueue.length ? `<div class="dv-bulk">WhatsApp: ${st.waQueue.length} left <button class="btn y" data-dv="nextwa">Next: ${esc(st.waQueue[0][C.name])} &#8250;</button><button class="btn" data-dv="stopwa">Stop</button></div>` : st.sel.size ? `<div class="dv-bulk">${st.sel.size} selected
        <select id="dvbulkst"><option value="">Set status &#9662;</option>${opts().map(o => `<option>${esc(o)}</option>`).join('')}</select>
        <button class="btn" data-dv="bulkwa">&#128172; WhatsApp all</button>
        <button class="btn" data-dv="bulkxl">&#11015; Excel</button>
        <button class="btn y" data-dv="clear">Clear</button></div>` : ''}`;
      const q = el.querySelector('#dvq');
      q.oninput = () => { st.q = q.value; st.limit = PAGE; const pos = q.selectionStart; draw(); const n = el.querySelector('#dvq'); n.focus(); n.setSelectionRange(pos, pos); };
      el.querySelector('#dvstate').onchange = e => { st.fState = e.target.value; st.limit = PAGE; draw(); };
      el.querySelector('#dvstatus').onchange = e => { st.fStatus = e.target.value; st.limit = PAGE; draw(); };
      el.querySelector('#dvdate').onchange = e => { st.fDate = e.target.value; st.limit = PAGE; draw(); };
      const mo = el.querySelector('#dvmore'); if(mo) mo.onchange = e => { if(e.target.value){ st.tab = e.target.value; st.sel.clear(); st.fState = ''; st.limit = PAGE; draw(); } };
      const b = el.querySelector('#dvbulkst'); if(b) b.onchange = e => { if(e.target.value) setStatus([...st.sel], e.target.value); };
    }

    function findRow(id){ for(const t of (st.data ? st.data.tabs : [])) { const r = t.rows.find(x => x[C.id] === id); if(r) return {tab:t.name, r}; } return null; }
    async function setStatus(ids, status){
      const before = ids.map(id => { const f = findRow(id); return f ? [f.r, f.r[C.st]] : null; }).filter(Boolean);
      before.forEach(([r]) => { r[C.st] = status; });
      closeMenu(); draw();
      try {
        const res = await H.data.delivSet(st.tab === ALL ? '' : st.tab, ids, status);
        if(!res || !res.ok) throw new Error((res && res.error) || 'Could not save');
        H.log.add('Delivery', `Set ${ids.length > 1 ? ids.length + ' orders' : ids[0]} to ${status}`);
        ctx.toast(ids.length > 1 ? `${res.changed} orders set to ${status}` : `${ids[0]} set to ${status}`);
        if(ids.length > 1) st.sel.clear();
      } catch(e){
        before.forEach(([r, old]) => { r[C.st] = old; });
        ctx.toast('Not saved: ' + (e.message || e) + '. Try again.');
      }
      draw();
    }
    function closeMenu(){ const m = document.getElementById('dvmenu'); if(m) m.remove(); st.menu = null; }
    function openMenu(btn, id){
      closeMenu();
      const f = findRow(id); if(!f) return;
      const m = document.createElement('div'); m.id = 'dvmenu'; m.className = 'dv-menu';
      m.innerHTML = opts().map(o => `<button data-dvset="${esc(o)}" class="${o === (f.r[C.st] || 'Pending') ? 'on' : ''}"><i style="background:${DOT[pill(o)]}"></i>${esc(o)}</button>`).join('');
      document.body.appendChild(m);
      const rc = btn.getBoundingClientRect();
      const top = Math.min(rc.bottom + 4, window.innerHeight - m.offsetHeight - 10);
      m.style.left = Math.min(rc.left, window.innerWidth - m.offsetWidth - 10) + 'px'; m.style.top = top + 'px';
      st.menu = id;
      m.onclick = e => { const b = e.target.closest('[data-dvset]'); if(b) setStatus([id], b.dataset.dvset); };
    }
    function waText(r){
      const T = ctx.templates();
      const s = (r[C.st] || '').toLowerCase();
      const pick = n => (T.find(t => t.name.toLowerCase() === n) || {}).text;
      let t = s === 'delivered' ? pick('delivered') : pick('dispatched');
      if(!t) t = 'Hello {name}, your BoxUp order {order} has been dispatched. Track: {link}';
      const map = {name:r[C.name] || 'Customer', order:r[C.id], courier:'Shree Anjani', awb:r[C.awb], link:r[C.link], boxes:'', company:(findRow(r[C.id]) || {}).tab || '', city:r[C.state]};
      return t.replace(/\{(\w+)\}/g, (m, k) => map[k.toLowerCase()] !== undefined ? map[k.toLowerCase()] : m);
    }
    function phone(p){ let d = String(p || '').replace(/\D/g, ''); if(d.length === 10) d = '91' + d; if(d.length === 11 && d[0] === '0') d = '91' + d.slice(1); return d; }
    function openWa(r){ ctx.openWhatsApp(phone(r[C.phone]), waText(r)); H.log.add('Delivery', 'WhatsApp to ' + r[C.id]); }
    function bulkWa(){
      st.waQueue = [...st.sel].map(id => (findRow(id) || {}).r).filter(Boolean);
      st.sel.clear(); nextWa();
    }
    function nextWa(){
      const r = st.waQueue && st.waQueue.shift();
      if(r){ openWa(r); ctx.toast(st.waQueue.length ? `Chat ready for ${r[C.name]}. Press send, then come back to Delivery for the next one (${st.waQueue.length} left).` : `Chat ready for ${r[C.name]}. That was the last one.`); }
      draw();
    }
    function excel(rows, name){
      if(!window.XLSX){ ctx.toast('Excel is not available'); return; }
      const head = (st.data && st.data.head) || ['Order ID','AWB No','State','Name','Number','Address','Pincode','Dispatch Date','Tracking Link','Delivery Status'];
      const ws = XLSX.utils.aoa_to_sheet([head].concat(rows));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, String(st.tab === ALL ? 'All' : (st.tab || 'Delivery')).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 30));
      XLSX.writeFile(wb, name);
    }
    const stamp = () => new Date().toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}).replace(/ /g, '-');

    el.addEventListener('click', e => {
      const t = e.target;
      const g = s => t.closest('[' + s + ']');
      let x;
      if((x = g('data-dvtab'))){ st.tab = x.dataset.dvtab; st.sel.clear(); st.fState = ''; st.limit = PAGE; draw(); return; }
      if((x = g('data-dvst')) && x.classList.contains('dv-k')){ st.fStatus = x.dataset.dvst; st.limit = PAGE; draw(); return; }
      if((x = g('data-dvpick'))){ e.stopPropagation(); if(st.menu === x.dataset.dvpick) closeMenu(); else openMenu(x, x.dataset.dvpick); return; }
      if((x = g('data-dvlink'))){ H.external(x.dataset.dvlink); return; }
      if((x = g('data-dvwa'))){ const f = findRow(x.dataset.dvwa); if(f) openWa(f.r); return; }
      if((x = g('data-dvsel'))){ const id = x.dataset.dvsel; if(x.checked) st.sel.add(id); else st.sel.delete(id); draw(); return; }
      if((x = g('data-dv'))){
        const a = x.dataset.dv;
        if(a === 'all'){ const shown = filtered().slice(0, st.limit); if(x.checked) shown.forEach(r => st.sel.add(r[C.id])); else shown.forEach(r => st.sel.delete(r[C.id])); draw(); }
        else if(a === 'refresh' || a === 'retry') load(true);
        else if(a === 'chrome'){ const u = (st.data && st.data.url) || ctx.sheetUrl; (H.externalApp || H.external)(u); }
        else if(a === 'excel') excel(filtered(), `BoxUp_Delivery_${(st.tab === ALL ? 'All' : st.tab || 'All').replace(/\W+/g, '_')}_${stamp()}.xlsx`);
        else if(a === 'bulkxl') excel([...st.sel].map(id => (findRow(id) || {}).r).filter(Boolean), `BoxUp_Delivery_selected_${stamp()}.xlsx`);
        else if(a === 'bulkwa') bulkWa();
        else if(a === 'clear'){ st.sel.clear(); draw(); }
        else if(a === 'more'){ st.limit += PAGE; draw(); }
        else if(a === 'nextwa') nextWa();
        else if(a === 'stopwa'){ st.waQueue = []; draw(); }
      }
    });
    document.addEventListener('click', e => {
      if(st.menu && !e.target.closest('#dvmenu') && !e.target.closest('[data-dvpick]')) closeMenu();
    });
    el.addEventListener('scroll', closeMenu);
    let every = () => { const v = ctx.every ? ctx.every() : 30000; return Math.max(10000, v || 30000); };
    let tick = 0;
    let timer = setInterval(() => {
      tick += 5000;
      if(tick < every()) return;
      tick = 0;
      if(!el.classList.contains('off') && !st.loading && !st.menu && !document.getElementById('dvmenu') && !document.hidden) load(true, true);
    }, 5000);   // checks every 5s, reloads on the chosen gap
    el.reload = () => load(true);
    el.print = () => { window.print(); return Promise.resolve(); };
    el.stop = () => clearInterval(timer);
    load(false);
  }
  window.DelivScreen = {mount};
})();
