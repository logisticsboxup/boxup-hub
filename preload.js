// Safe bridge between the screens and the main process
const { contextBridge, ipcRenderer } = require('electron');
const on = (ch, fn) => ipcRenderer.on(ch, (e, d) => fn(d));
contextBridge.exposeInMainWorld('hub', {
  settings: { get: () => ipcRenderer.invoke('settings:get'), set: p => ipcRenderer.invoke('settings:set', p) },
  auth: { status: () => ipcRenderer.invoke('auth:status'), signIn: () => ipcRenderer.invoke('auth:signin'), signOut: () => ipcRenderer.invoke('auth:signout') },
  data: { sales: fresh => ipcRenderer.invoke('data:sales', fresh), gateToday: () => ipcRenderer.invoke('data:gatetoday') },
  log: { list: () => ipcRenderer.invoke('log:list'), add: (a, w) => ipcRenderer.invoke('log:add', a, w) },
  info: () => ipcRenderer.invoke('app:info'),
  update: { check: () => ipcRenderer.invoke('update:check'), install: () => ipcRenderer.invoke('update:install'), rollback: () => ipcRenderer.invoke('update:rollback') },
  printers: () => ipcRenderer.invoke('printers:list'),
  openProgram: p => ipcRenderer.invoke('program:open', p),
  openFile: p => ipcRenderer.invoke('file:open', p),
  showFile: p => ipcRenderer.invoke('file:show', p),
  external: u => ipcRenderer.invoke('link:external', u),
  pickProgram: () => ipcRenderer.invoke('dialog:program'),
  pickImage: () => ipcRenderer.invoke('dialog:image'),
  notify: (t, b) => ipcRenderer.invoke('notify', t, b),
  on
});
