/* BoxUp Logistics Hub (Chrome version): the bridge the screens use.
   Same functions as the desktop program, done with the browser and the
   BoxUp Chrome extension instead. */
'use strict';
(function () {
  const EXT_ID = 'iemgknegdeekjmgepaodcfhoccjopplf';
  const ALLOWED = 'logisticsboxup@gmail.com';
  const LOG_URL = 'https://script.google.com/macros/s/AKfycbxkWlpzmubWJwgFQF7cCDAegDHDFpst-j2AnoLVrk3rVnZL9CuOukEIC_GR43gUlL7e/exec';
  const SKEY = 'boxup.hub.settings', LKEY = 'boxup.hub.activity';
  const ls = {
    get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
  };
  const listeners = {};
  const emit = (ch, d) => (listeners[ch] || []).forEach(fn => { try { fn(d); } catch(e){} });

  function ext(msg, ms){
    return new Promise(resolve => {
      let done = false; const fin = r => { if(!done){ done = true; resolve(r); } };
      try {
        if(!(window.chrome && chrome.runtime && chrome.runtime.sendMessage)) return fin(null);
        chrome.runtime.sendMessage(EXT_ID, msg, r => { void (chrome.runtime.lastError); fin(r || null); });
      } catch(e){ return fin(null); }
      setTimeout(() => fin(null), ms || 4000);
    });
  }
  async function getJson(url, ms){
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 60000);
    try { const r = await fetch(url, {signal:ctl.signal, cache:'no-store'}); return JSON.parse(await r.text()); }
    finally { clearTimeout(t); }
  }
  let loadedVersion = null;
  async function versionFile(){ return getJson('version.json?t=' + Date.now(), 15000); }

  function openTab(url, key, reload){
    return ext({type:'openTab', url, key, reload}).then(r => {
      if(r && r.ok) return r;
      window.open(url, key ? 'boxup_' + key : '_blank');   // without the extension: normal browser tab
      return {ok:true, fallback:true};
    });
  }
  // keep the copies the Label Generator and Order Tracker read (same website, same storage)
  function mirror(s){
    try {
      if(s.labelDetails) localStorage.setItem('boxup.labelDetails', JSON.stringify(s.labelDetails));
      if(s.waTemplates) localStorage.setItem('boxup.waTemplates', JSON.stringify(s.waTemplates));
    } catch(e){}
  }

  window.hub = {
    web: true,
    settings: {
      get: async () => ls.get(SKEY, {}),
      set: async patch => { const s = Object.assign(ls.get(SKEY, {}), patch || {}); if(!ls.set(SKEY, s)) emit('toast', 'Could not save: storage is full (try a smaller background picture)'); mirror(s); return s; }
    },
    auth: {
      status: async () => {
        const r = await ext({type:'hello'}, 5000);
        if(!r) return {ok:false, noExt:true, allowed:ALLOWED, email:''};
        const email = r.email || '';
        return {ok:email === ALLOWED, email, name:'Logistics', allowed:ALLOWED, ext:r.version, noChromeAccount:!email};
      },
      signIn: async () => window.hub.auth.status(),
      signOut: async () => ({ok:true})
    },
    data: {
      sales: async fresh => { try { return await getJson(LOG_URL + '?action=sales' + (fresh ? '&fresh=1' : '') + '&t=' + Date.now(), 90000); } catch(e){ return {ok:false, error:'Could not reach the Label Log. Check the internet.'}; } },
      gateToday: async () => { try { return await getJson(LOG_URL + '?action=gatetoday&t=' + Date.now(), 60000); } catch(e){ return {ok:false, error:String(e)}; } },
      deliv: async () => (await ext({type:'deliv'}, 95000)) || {ok:false, error:'The BoxUp Chrome extension is needed for the Delivery Tracker. Install it, then reload this page.'},
      delivSet: async (tab, ids, status) => (await ext({type:'delivSet', tab, ids, status}, 65000)) || {ok:false, error:'The BoxUp Chrome extension did not answer'}
    },
    log: {
      list: async () => ls.get(LKEY, []),
      add: async (app, what) => { const l = ls.get(LKEY, []); l.unshift({at:Date.now(), app, what}); ls.set(LKEY, l.slice(0, 500)); return true; }
    },
    info: async () => {
      if(!loadedVersion){ try { loadedVersion = (await versionFile()).version; } catch(e){ loadedVersion = '?'; } }
      const r = await ext({type:'hello'}, 3000);
      const s = ls.get(SKEY, {});
      return {version:loadedVersion, ext:r ? r.version : null, history:s.updateHistory || [], lastCheck:s.lastUpdateCheck || null, web:true};
    },
    update: {
      check: async () => {
        await window.hub.info();
        try {
          const v = await versionFile();
          const s = ls.get(SKEY, {}); s.lastUpdateCheck = Date.now(); ls.set(SKEY, s);
          if(v.version && v.version !== loadedVersion){
            let notes = [];
            try { notes = await getJson('release-notes.json?t=' + Date.now(), 15000); } catch(e){}
            return {available:true, current:loadedVersion, latest:{version:v.version, notes}};
          }
          return {available:false, current:loadedVersion};
        } catch(e){ return {available:false, current:loadedVersion, error:'Could not check for updates'}; }
      },
      install: async () => {
        try {
          const v = await versionFile();
          const s = ls.get(SKEY, {}); const h = s.updateHistory || [];
          h.unshift({version:v.version, date:Date.now(), notes:''}); s.updateHistory = h.slice(0, 30); ls.set(SKEY, s);
          emit('update-progress', {step:'download', done:1, total:1});
          emit('update-progress', {step:'verified'}); emit('update-progress', {step:'installed'});
          setTimeout(() => location.reload(), 900);
          return {ok:true};
        } catch(e){ return {ok:false, error:'Could not reach the update server'}; }
      },
      rollback: async () => ({ok:false})
    },
    printers: async () => [],
    openProgram: async () => { emit('toast', 'Programs on the PC open from the Windows Start menu in the Chrome version'); return ''; },
    openFile: async () => ext({type:'showDownloads'}),
    showFile: async () => ext({type:'showDownloads'}),
    external: url => openTab(url, null),
    externalApp: url => openTab(url, null),
    openTab,
    pickProgram: async () => null,
    pickImage: () => new Promise(resolve => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files && inp.files[0]; if(!f) return resolve(null);
        const img = new Image(); img.onload = () => {
          const sc = Math.min(1, 1920 / img.width), c = document.createElement('canvas');
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8)); URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve(null); img.src = URL.createObjectURL(f);
      };
      inp.click();
    }),
    notify: async (title, body) => {
      const r = await ext({type:'notify', title, body});
      if(!r && 'Notification' in window){ if(Notification.permission === 'granted') new Notification(title, {body}); else if(Notification.permission !== 'denied') Notification.requestPermission(); }
      return true;
    },
    on: (ch, fn) => { (listeners[ch] = listeners[ch] || []).push(fn); }
  };
  mirror(ls.get(SKEY, {}));
})();
