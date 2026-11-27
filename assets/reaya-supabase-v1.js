/* Reaya owner backend over Supabase RPC (v1). Replaces the Firebase bundle.
   Owner identity: 6-12 digit PIN verified server-side (bcrypt), global DB-side
   login throttling, 8h server-issued tokens. No secrets in this file beyond the
   project's public publishable key (public by design; RLS denies direct access). */
(() => {
'use strict';
const SUPA_URL = 'https://kjcxjcxfquakkntwbswp.supabase.co';
const SUPA_KEY = 'sb_publishable_fDzWnwGXM--5hh0cI3ddGw_xyv6kI0G';
const TOKEN_KEY = 'raaya.owner.token';

let owner = false;
let serverProviders = [], serverMembers = [], serverRequests = [], serverSubscribers = [];
let rowsetRevs = { providers: 0, members: 0 };
let contentCurrent = {};

const clone = x => JSON.parse(JSON.stringify(x));
const token = () => localStorage.getItem(TOKEN_KEY) || '';

async function rpc(name, body) {
  const res = await fetch(SUPA_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) {
    let msg = 'http-' + res.status;
    try { msg = (await res.json()).message || msg; } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}
const ok = r => { if (!r || r.status !== 'ok') throw new Error((r && r.status) || 'failed'); return r; };

function statusText(t) { const el = document.getElementById('connectionStatus'); if (el) el.textContent = t; }
function fail(e) { console.error(e && e.message || e); alert('تعذر إتمام العملية. تحقق من الاتصال والصلاحيات وحاول مجدداً.'); }

function refresh() {
  populateCentersSelectors(); updateCategoryCounts(); renderCards();
  if (owner) { renderAdminTable(); renderMembersTable(); renderRequestsTable(); calculateStats(); }
}

// Local (inline-script) data layer, kept as the base for seed records and offline fallback.
const localGetItems = window.getItems, localSaveItems = window.saveItems;
const localGetMemberCards = window.getMemberCards, localSaveMemberCards = window.saveMemberCards;
const localGetJoinRequests = window.getJoinRequests, localSaveJoinRequests = window.saveJoinRequests;

async function refreshProviders() { serverProviders = await rpc('reaya_public_providers'); }
async function refreshRequests() { serverRequests = await rpc('reaya_owner_requests_get', { p_token: token() }); }
async function refreshMembers() { serverMembers = await rpc('reaya_owner_members_get', { p_token: token() }); }
async function refreshSubscribers() { serverSubscribers = await rpc('reaya_owner_subscribers_get', { p_token: token() }); }
async function refreshRevs() { if (owner) rowsetRevs = Object.assign({ providers: 0, members: 0 }, await rpc('reaya_owner_rowset_revs', { p_token: token() })); }
async function refreshOwnerData() { await refreshRevs(); await refreshRequests(); await refreshMembers(); await refreshSubscribers(); }

// Guarded rowset save: sends the base revision captured at load; on 'stale' the
// server refused the write, so reload the rowset + revision and tell the owner
// to review before saving again. Nothing is silently overwritten or deleted.
// ORDERING RULE (load consistency): always read revisions BEFORE the rowset.
// rev-then-rows can only pair an old rev with newer rows, which the guard
// rejects safely; rows-then-revs could pair a fresh rev with stale rows and
// would let a later save delete rows it never saw.
async function guardedSave(name, rows) {
  const res = await rpc('reaya_owner_' + name + '_save', { p_token: token(), p_rows: rows, p_base_rev: rowsetRevs[name] });
  if (res && res.status === 'stale') {
    await refreshRevs();
    if (name === 'providers') await refreshProviders(); else await refreshMembers();
    refresh();
    alert('البيانات اتعدلت من مكان تاني أثناء التعديل. القايمة اتحدثت، راجعها واحفظ تاني.');
    return false;
  }
  ok(res);
  rowsetRevs[name] = res.rev;
  return true;
}

// ---------------- Directory (providers) ----------------
window.getItems = () => {
  const ids = new Set(serverProviders.map(r => r.id));
  return [...clone(serverProviders), ...localGetItems().filter(r => !ids.has(r.id) && !serverProviders.some(p => p.sourceId === r.id))];
};
window.saveItems = async rows => {
  if (!owner) throw Error('owner-only');
  const real = rows.filter(r => !r.seedRecord).map(({ seedRecord, ...r }) => r);
  if (!await guardedSave('providers', real)) return;
  await refreshProviders();
  localSaveItems(rows);
};
window.deleteItem = id => { if (owner) askAction('حذف هذه الجهة من الدليل؟', () => window.saveItems(getItems().filter(r => r.id !== id))); };

// ---------------- Member cards ----------------
window.getMemberCards = () => owner ? [...clone(serverMembers), ...localGetMemberCards().filter(r => !serverMembers.some(m => m.id === r.id))] : [];
window.saveMemberCards = async rows => {
  if (!owner) throw Error('owner-only');
  const real = rows.filter(r => !r.seedRecord).map(({ seedRecord, ...r }) => r);
  if (!await guardedSave('members', real)) return;
  await refreshMembers();
  localSaveMemberCards(rows);
  renderMembersTable(); calculateStats();
};
window.deleteMemberCard = id => { if (owner) askAction('حذف بطاقة العضوية وإلغاء رابطها الخاص؟', () => window.saveMemberCards(getMemberCards().filter(r => r.id !== id))); };

// ---------------- Join requests ----------------
window.getJoinRequests = () => owner ? [...clone(serverRequests), ...localGetJoinRequests().filter(r => !serverRequests.some(q => q.id === r.id)).map(r => ({ ...r, localOnly: true }))] : [];
window.saveJoinRequests = async rows => { localSaveJoinRequests(rows); };

function askAction(message, action) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4';
  modal.style.zIndex = '2000';
  const box = document.createElement('div');
  box.className = 'bg-white p-6 rounded-2xl max-w-sm w-full text-center';
  box.style.cssText = 'color:#0f172a;background:#fff';
  const text = document.createElement('p'); text.textContent = message;
  const yes = document.createElement('button'), no = document.createElement('button');
  yes.textContent = 'تأكيد'; no.textContent = 'إلغاء';
  yes.className = 'bg-rose-600 text-white p-3 rounded-xl m-2'; yes.style.background = '#be123c';
  no.className = 'bg-slate-100 p-3 rounded-xl m-2';
  yes.onclick = async () => { yes.disabled = true; try { await action(); modal.remove(); } catch (e) { yes.disabled = false; fail(e); } };
  no.onclick = () => modal.remove();
  box.append(text, yes, no); modal.append(box); document.body.append(modal);
}

async function removeRequest(id) {
  const local = localGetJoinRequests().some(r => r.id === id);
  if (local) localSaveJoinRequests(localGetJoinRequests().filter(r => r.id !== id));
  if (serverRequests.some(r => r.id === id)) {
    ok(await rpc('reaya_owner_request_action', { p_token: token(), p_id: id, p_action: 'delete' }));
    await refreshRequests();
  }
  renderRequestsTable();
}

window.approveJoinRequest = id => {
  if (!owner) return;
  const req = getJoinRequests().find(r => r.id === id);
  if (!req) return;
  askAction('اعتماد الطلب وإضافة الجهة إلى الدليل لجميع الزوار؟', async () => {
    if (req.localOnly) {
      const { localOnly, seedRecord, ...data } = req;
      if (!await guardedSave('providers', [...serverProviders, { ...data, id: 'provider-' + id }])) return;
      localSaveJoinRequests(localGetJoinRequests().filter(r => r.id !== id));
      await refreshProviders();
    } else {
      ok(await rpc('reaya_owner_request_action', { p_token: token(), p_id: id, p_action: 'approve' }));
      await refreshRevs(); await refreshProviders(); await refreshRequests();
    }
    renderRequestsTable();
    alert('تم اعتماد الجهة وإضافتها للدليل.');
  });
};
window.rejectJoinRequest = id => { if (owner) askAction('رفض الطلب وإزالته من قائمة الانتظار؟', () => removeRequest(id)); };
window.deleteJoinRequest = id => { if (owner) askAction('حذف هذا الطلب نهائياً؟ لا يمكن التراجع.', () => removeRequest(id)); };

window.negotiateJoinRequest = id => {
  const r = getJoinRequests().find(x => x.id === id);
  if (!owner || !r) return;
  const phone = (r.phone || '').replace(/[^0-9]/g, '');
  if (r.seedRecord || phone.length < 10 || phone.length > 15) { alert('رقم هذا الطلب غير صالح للتواصل.'); return; }
  const dest = phone.startsWith('0') ? '2' + phone : phone;
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4';
  modal.style.zIndex = '2000';
  const box = document.createElement('div');
  box.className = 'bg-white rounded-2xl p-5 max-w-md w-full';
  box.style.cssText = 'color:#0f172a;background:#fff';
  const title = document.createElement('h3'); title.textContent = 'تفاوض على نسبة الخصم';
  const label = document.createElement('label'); label.textContent = 'النسبة المطلوبة (%)';
  const input = document.createElement('input');
  input.type = 'number'; input.min = '1'; input.max = '100';
  input.className = 'w-full border rounded-xl p-3 my-2'; input.value = '';
  input.style.cssText = 'color:#0f172a;background:#fff;caret-color:#0f172a';
  const message = document.createElement('textarea');
  message.className = 'w-full border rounded-xl p-3 my-2'; message.rows = 5;
  message.style.cssText = 'color:#0f172a;background:#fff;caret-color:#0f172a';
  const update = () => { message.value = 'السلام عليكم، معكم فريق رعاية طبية. شكراً لطلب انضمامكم. نرغب في مناقشة رفع نسبة الخصم المقترحة إلى ' + (input.value || '...') + '% لتقديم عرض أفضل للمشتركين. هل يناسبكم ذلك؟'; };
  input.oninput = update; update();
  const open = document.createElement('a');
  open.textContent = 'مراجعة وإرسال عبر واتساب';
  open.target = '_blank'; open.rel = 'noopener noreferrer';
  open.className = 'block text-center bg-emerald-600 text-white p-3 rounded-xl';
  open.style.background = '#059669';
  open.onclick = e => {
    if (!input.checkValidity() || !input.value) { e.preventDefault(); input.reportValidity(); return; }
    open.href = 'https://wa.me/' + dest + '?text=' + encodeURIComponent(message.value);
  };
  input.required = true;
  const cancel = document.createElement('button');
  cancel.textContent = 'إلغاء'; cancel.className = 'w-full p-3';
  cancel.onclick = () => modal.remove();
  box.append(title, label, input, message, open, cancel);
  modal.append(box); document.body.append(modal);
};

const oldRenderRequests = window.renderRequestsTable;
window.renderRequestsTable = () => {
  oldRenderRequests();
  document.querySelectorAll('#requestsTableBody tr').forEach((row, i) => {
    const r = getJoinRequests()[i];
    if (!r) return;
    const td = row.lastElementChild;
    if (td && !td.querySelector('[data-delete-request]')) {
      const b = document.createElement('button');
      b.dataset.deleteRequest = '1'; b.textContent = 'حذف';
      b.className = 'px-2 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold m-1';
      b.onclick = () => window.deleteJoinRequest(r.id);
      td.append(b);
      const n = document.createElement('button');
      n.textContent = 'تفاوض';
      n.className = 'px-2 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold m-1';
      n.disabled = !!r.seedRecord;
      n.onclick = () => window.negotiateJoinRequest(r.id);
      td.append(n);
    }
  });
};

function negotiateSubscriber(r) {
  const fake = { ...r, category: 'doctor', discount: '', seedRecord: false };
  serverRequests = [fake, ...serverRequests];
  window.negotiateJoinRequest(r.id);
  serverRequests = serverRequests.filter(x => x !== fake);
}
const renderRequestsWithJoin = window.renderRequestsTable;
window.renderRequestsTable = () => {
  renderRequestsWithJoin();
  const body = document.getElementById('requestsTableBody');
  if (!body || !owner) return;
  body.querySelectorAll('[data-sub-row]').forEach(x => x.remove());
  serverSubscribers.filter(r => r.status === 'pending').forEach(r => {
    const tr = document.createElement('tr'); tr.dataset.subRow = '1';
    const head = document.createElement('td'); head.className = 'font-bold';
    head.textContent = 'بطاقة اشتراك عائلي: ' + (r.name || '');
    const info = document.createElement('td');
    info.textContent = [r.phone, r.governorate, r.address, ((r.familyMembers || []).length ? (r.familyMembers.length + ' أفراد') : '')].filter(Boolean).join(' - ');
    const act = document.createElement('td');
    const mk = (label, bg, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.className = 'px-2 py-1 text-white rounded-lg text-xs font-bold m-1'; b.style.background = bg; b.onclick = fn; act.append(b); };
    const acts = subscriberActionList(r);
    mk('اعتماد', '#047857', () => askAction('اعتماد طلب العميل؟', async () => { await acts[0][1](); renderRequestsTable(); }));
    mk('تفاوض', '#0284c7', () => negotiateSubscriber(r));
    mk('رفض', '#be123c', () => askAction('رفض طلب العميل؟', async () => { await acts[2][1](); renderRequestsTable(); }));
    tr.append(head, info, act); body.append(tr);
  });
};

window.submitJoinRequest = async () => {
  const b = document.querySelector('#joinForm button[type=submit]');
  if (b) b.disabled = true;
  try {
    const fields = { category: 'joinCategory', name: 'joinName', specialty: 'joinSpecialty', center: 'joinCenter', governorate: 'joinGovernorate', phone: 'joinPhone', discount: 'joinDiscount', address: 'joinAddress', schedule: 'joinSchedule', mapUrl: 'joinMapUrl', notes: 'joinNotes' };
    const row = {};
    for (const [k, v] of Object.entries(fields)) row[k] = document.getElementById(v).value.trim();
    if (!row.name || !row.phone) throw Error('invalid-input');
    const res = await rpc('reaya_public_join', {
      p_category: row.category, p_name: row.name, p_specialty: row.specialty, p_center: row.center,
      p_governorate: row.governorate, p_phone: row.phone, p_discount: row.discount, p_address: row.address,
      p_schedule: row.schedule, p_map_url: row.mapUrl, p_notes: row.notes
    });
    if (res.status === 'busy') { alert('الخدمة مشغولة مؤقتًا بسبب ضغط الطلبات. حاول بعد قليل، أو تواصل معنا واتساب من أسفل الصفحة.'); return; }
    if (res.status !== 'ok') throw Error(res.status || 'invalid');
    closeJoinModal();
    alert('تم إرسال طلبك للإدارة للمراجعة بنجاح.');
  } catch (e) { fail(e); } finally { if (b) b.disabled = false; }
};

// ---------------- Member card modal + private lookup ----------------
window.openMemberCardModal = () => {
  document.getElementById('memberCardModal').classList.remove('hidden');
  document.getElementById('memberSearchInput').value = '';
  document.getElementById('printableCardArea').classList.add('hidden');
};
window.lookupMemberCard = async () => {
  const value = document.getElementById('memberSearchInput').value.trim();
  if (owner) {
    const card = getMemberCards().find(r => r.code === value || r.lookupToken === value || r.holderPhone === value);
    if (card) { displayCardData(card); document.getElementById('printableCardArea').classList.remove('hidden'); return; }
  }
  if (!/^[a-f0-9]{64}$/.test(value)) { alert('أدخل رمز الوصول الخاص الذي حصلت عليه من الإدارة. لا يمكن البحث العام برقم الهاتف.'); return; }
  try {
    const res = await rpc('reaya_public_card', { p_lookup_token: value });
    if (res.status !== 'ok') { alert('لم يتم العثور على البطاقة.'); return; }
    displayCardData(res.card);
    document.getElementById('printableCardArea').classList.remove('hidden');
  } catch (e) { fail(e); }
};

const oldViewCard = window.viewCardDirectly;
window.viewCardDirectly = id => {
  oldViewCard(id);
  const card = getMemberCards().find(r => r.id === id);
  if (card && card.lookupToken) {
    let p = document.getElementById('privateCardAccess');
    if (!p) {
      p = document.createElement('p');
      p.id = 'privateCardAccess';
      p.className = 'break-all text-xs p-3 bg-amber-50';
      document.querySelector('#memberCardModal>div').append(p);
    }
    p.textContent = 'رمز الوصول الخاص، شاركه مع صاحب البطاقة فقط: ' + card.lookupToken;
  }
};

// Offline copy: draws a PNG of the card (name, family, RT code, expiry) plus a QR (private card link when the card has a token, else the RT code) and a registered-names-only notice.
function saveCardImage(card) {
  const fam = (card.familyMembers || []).filter(Boolean);
  const W = 900, H = 560 + fam.length * 56 + 600;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, W, H); grad.addColorStop(0, '#065f46'); grad.addColorStop(1, '#0f766e');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffffff'; g.direction = 'rtl'; g.textAlign = 'right';
  const font = px => px + 'px "Cairo", "Noto Sans Arabic", Tahoma, Arial, sans-serif';
  let y = 90;
  g.font = 'bold ' + font(46); g.fillText('بطاقة رعاية طبية', W - 50, y); y += 70;
  g.font = font(28); g.fillStyle = '#a7f3d0'; g.fillText('بطاقة الرعاية الصحية العائلية', W - 50, y); y += 70;
  g.fillStyle = '#ffffff'; g.font = font(26); g.fillText('رب الأسرة:', W - 50, y); y += 50;
  g.font = 'bold ' + font(40); g.fillText(card.holderName || '', W - 50, y); y += 70;
  if (fam.length) {
    g.font = font(26); g.fillStyle = '#a7f3d0'; g.fillText('أفراد الأسرة:', W - 50, y); y += 50;
    g.fillStyle = '#ffffff'; g.font = font(32);
    fam.forEach(n => { g.fillText(n, W - 50, y); y += 56; });
    y += 14;
  }
  g.font = font(26); g.fillStyle = '#a7f3d0'; g.fillText('كود العضوية:', W - 50, y);
  g.direction = 'ltr'; g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.font = 'bold 40px monospace'; g.fillText(card.code || '', 50, y); y += 60;
  g.direction = 'rtl'; g.textAlign = 'right'; g.font = font(26); g.fillStyle = '#a7f3d0'; g.fillText('صالحة حتى:', W - 50, y);
  g.direction = 'ltr'; g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.font = 'bold 40px monospace'; g.fillText(card.expiryDate || '', 50, y);
  y += 40;
  try {
    const q = qrcode(0, 'M'); let payload = String(card.code || '');
    if (card.lookupToken) { const u = new URL('./', location.href); u.search = ''; u.hash = 'card=' + card.lookupToken; payload = u.href; }
    q.addData(payload); q.make();
    const n = q.getModuleCount(), cell = Math.floor(340 / (n + 2)), sz = cell * (n + 2), x0 = Math.round((W - sz) / 2);
    g.fillStyle = '#ffffff'; g.fillRect(x0, y, sz, sz);
    g.fillStyle = '#000000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(x0 + (c + 1) * cell, y + (r + 1) * cell, cell, cell);
    y += sz + 44;
    g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#a7f3d0'; g.font = font(24);
    g.fillText(card.lookupToken ? 'امسح الـQR للتحقق من البطاقة' : 'QR لكود العضوية', W / 2, y);
    y += 56; g.fillStyle = '#ffffff'; g.font = 'bold ' + font(27);
    g.fillText('تنبيه: الأسماء المسجلة في البطاقة فقط', W / 2, y); y += 44;
    g.fillText('هي من يحق لها استخدام الخصومات', W / 2, y);
  } catch (e) {}
  cv.toBlob(b => {
    if (!b) { alert('تعذر إنشاء الصورة.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'raaya-card-' + (card.code || 'card') + '.png';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}
window.saveCardImage = saveCardImage;

const baseDisplayCard = window.displayCardData;
window.displayCardData = card => {
  baseDisplayCard(card);
  window.__raayaLastCard = card;
  const area = document.getElementById('printableCardArea');
  if (area && !document.getElementById('saveCardImageBtn')) {
    const b = document.createElement('button');
    b.id = 'saveCardImageBtn'; b.type = 'button'; b.textContent = 'حفظ البطاقة كصورة';
    b.className = 'block w-full text-center p-3 rounded-xl my-2 font-bold';
    b.setAttribute('style', 'background:#059669;color:#fff');
    b.onclick = () => saveCardImage(window.__raayaLastCard);
    area.append(b);
  }
  if (card.lookupToken) {
    const url = new URL('./', location.href);
    url.search = ''; url.hash = 'card=' + card.lookupToken;
    renderQRCode(url.href);
  }
};

// Short private link: our own revocable short code (server), wrapped by is.gd/Reaya_xxxx.
// is.gd only ever receives the short code link, never the 64-hex card token.
async function shortLinkFor(card) {
  const cacheKey = 'raaya.owner.short.' + card.id;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;
  const r = ok(await rpc('reaya_owner_card_short', { p_token: token(), p_member_id: card.id }));
  const base = new URL('./', location.href);
  base.search = ''; base.hash = 'c=' + r.code;
  let out = base.href;
  try {
    const alpha = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const rnd = crypto.getRandomValues(new Uint8Array(12));
    const alias = 'Reaya_' + [...rnd].map(n => alpha[n % alpha.length]).join('');
    const res = await fetch('https://is.gd/create.php?format=json&url=' + encodeURIComponent(base.href) + '&shorturl=' + alias);
    const j = await res.json();
    if (j && typeof j.shorturl === 'string' && j.shorturl.startsWith('https://is.gd/')) out = j.shorturl;
  } catch (e) { console.error('Short link service unavailable, using app link'); }
  try { localStorage.setItem(cacheKey, out); } catch (e) {}
  return out;
}

window.sendMemberCardWhatsApp = async id => {
  if (!owner) return;
  const card = getMemberCards().find(c => c.id === id);
  if (!card || !card.lookupToken) { alert('احفظ البطاقة أولاً لإنشاء رابط خاص.'); return; }
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4';
  modal.style.zIndex = '1200';
  const box = document.createElement('div');
  box.className = 'bg-white rounded-xl p-4 max-w-md w-full';
  box.setAttribute('style', 'color:#0f172a;background:#fff');
  const label = document.createElement('p');
  label.textContent = 'رابط خاص لصاحب البطاقة فقط. انسخه وأرسله له:';
  const input = document.createElement('input');
  input.value = 'جارٍ تجهيز الرابط...'; input.readOnly = true;
  input.className = 'border p-3 w-full rounded-xl';
  input.setAttribute('style', 'color:#0f172a;background:#fff');
  input.onclick = () => input.select();
  const close = document.createElement('button');
  close.textContent = 'إغلاق'; close.className = 'p-3';
  close.onclick = () => modal.remove();
  box.append(label, input, close); modal.append(box); document.body.append(modal);
  let link;
  try { link = await shortLinkFor(card); } catch (e) { modal.remove(); fail(e); return; }
  input.value = link;
  const phone = (card.holderPhone || '').replace(/[^0-9]/g, '');
  if (phone.length >= 10 && phone.length <= 15) {
    const dest = phone.startsWith('0') ? '2' + phone : phone;
    const text = 'السلام عليكم، تم اعتماد بطاقة رعاية طبية الخاصة بكم. افتحوا بطاقتكم من هذا الرابط الخاص (لا تشاركوه مع أحد):\n' + link;
    const wa = document.createElement('a');
    wa.textContent = 'إرسال البطاقة عبر واتساب';
    wa.href = 'https://wa.me/' + dest + '?text=' + encodeURIComponent(text);
    wa.target = '_blank'; wa.rel = 'noopener noreferrer';
    wa.className = 'block text-center text-white p-3 rounded-xl my-2';
    wa.setAttribute('style', 'background:#059669;color:#fff');
    box.insertBefore(wa, close);
  }
};

// ---------------- Subscribers ----------------
window.openSubscriberForm = () => { document.getElementById('subscriberFormModal').classList.remove('hidden'); };
window.submitSubscriber = async event => {
  event.preventDefault();
  const form = event.currentTarget, button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form));
    if (!data.consent) throw Error('consent-required');
    const row = {
      name: (data.name || '').trim(), phone: (data.phone || '').trim(),
      governorate: (data.governorate || '').trim(), address: (data.address || '').trim(),
      familyMembers: (data.family || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5)
    };
    const res = await rpc('reaya_public_subscribe', {
      p_name: row.name, p_phone: row.phone, p_governorate: row.governorate,
      p_address: row.address, p_family_members: row.familyMembers
    });
    if (res.status === 'busy') { alert('الخدمة مشغولة مؤقتًا بسبب ضغط الطلبات. حاول بعد قليل، أو تواصل معنا واتساب من أسفل الصفحة.'); return; }
    if (res.status !== 'ok') throw Error(res.status || 'invalid');
    form.reset();
    document.getElementById('subscriberFormModal').classList.add('hidden');
    alert('تم إرسال طلب اشتراكك للإدارة بنجاح.');
  } catch (e) { fail(e); } finally { button.disabled = false; }
};

// ---------------- Contact database (owner) ----------------
function contactRows(kind) {
  if (kind === 'subscribers') return serverSubscribers;
  const all = [...serverProviders.map(r => ({ ...r, joinedAt: r.created_at })), ...serverRequests.map(r => ({ ...r, joinedAt: r.created_at }))];
  return all.filter((r, i) => all.findIndex(x => x.id === r.id) === i);
}
function dateText(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? String(v).slice(0, 10) : d.toLocaleDateString('ar-EG');
}
function subscriberActionList(r) {
  return [
        ['اعتماد', async () => {
          const card = { id: 'card-' + Date.now(), holderName: r.name, holderPhone: r.phone, governorate: r.governorate, address: r.address, code: 'RT-' + crypto.randomUUID().slice(0, 8).toUpperCase(), expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), familyMembers: r.familyMembers || [] };
          await window.saveMemberCards([...getMemberCards(), card]);
          ok(await rpc('reaya_owner_subscriber_action', { p_token: token(), p_id: r.id, p_action: 'approve' }));
          await refreshSubscribers();
          const saved = getMemberCards().find(c => c.id === card.id);
          if (saved && saved.lookupToken) {
            document.getElementById('contactDatabase').classList.add('hidden');
            window.viewCardDirectly(saved.id);
            window.sendMemberCardWhatsApp(saved.id);
          }
        }],
        ['تفاوض', async () => {
          window.negotiateJoinRequest(r.id) ;
        }],
        ['رفض', async () => {
          ok(await rpc('reaya_owner_subscriber_action', { p_token: token(), p_id: r.id, p_action: 'reject' }));
          await refreshSubscribers();
        }],
        ['حذف', async () => {
          ok(await rpc('reaya_owner_subscriber_action', { p_token: token(), p_id: r.id, p_action: 'delete' }));
          await refreshSubscribers();
        }]
      ];
}

function tableValues(r) { return [r.name || r.holderName || '', r.phone || r.holderPhone || '', r.governorate || '', r.address || '', r.specialty || '', dateText(r.joinedAt || r.created_at)]; }
window.renderContactDatabase = () => {
  if (!owner) return;
  const kind = document.getElementById('contactDbKind').value;
  const q = document.getElementById('contactDbSearch').value.trim().toLowerCase();
  const body = document.getElementById('contactDbRows');
  body.replaceChildren();
  const rows = contactRows(kind).filter(r => tableValues(r).join(' ').toLowerCase().includes(q));
  document.getElementById('contactDbCount').textContent = String(rows.length);
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const v of tableValues(r)) {
      const td = document.createElement('td');
      td.className = 'p-3 border-b break-words'; td.textContent = v; tr.append(td);
    }
    if (kind === 'subscribers') {
      const td = document.createElement('td');
      const actions = subscriberActionList(r);
      for (const [labelText, action] of actions) {
        if (r.status !== 'pending' && labelText !== 'حذف') continue;
        const btn = document.createElement('button');
        btn.className = 'p-2 m-1 rounded-lg bg-emerald-700 text-white';
        btn.style.background = '#047857';
        btn.textContent = labelText;
        if (labelText === 'تفاوض') {
          btn.onclick = () => {
            const fake = { ...r, category: 'doctor', discount: '', seedRecord: false };
            serverRequests = [fake, ...serverRequests];
            window.negotiateJoinRequest(r.id);
            serverRequests = serverRequests.filter(x => x !== fake);
          };
        } else {
          btn.onclick = () => askAction(labelText + ' طلب العميل؟', action);
        }
        td.append(btn);
      }
      tr.append(td);
    }
    body.append(tr);
  }
  if (!rows.length) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 6; td.textContent = 'لا توجد بيانات مطابقة'; td.className = 'p-4 text-center';
    tr.append(td); body.append(tr);
  }
};
window.exportContactCsv = () => {
  if (!owner) return;
  const kind = document.getElementById('contactDbKind').value;
  const rows = [['الاسم', 'الهاتف', 'المحافظة', 'العنوان', 'التخصص', 'التاريخ'], ...contactRows(kind).map(tableValues)];
  const csv = '﻿' + rows.map(r => r.map(v => '"' + String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'raaya-' + kind + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
window.openContactDatabase = () => {
  if (!owner) return;
  document.getElementById('contactDatabase').classList.remove('hidden');
  if (serverSubscribers.some(s => s.status === 'pending')) document.getElementById('contactDbKind').value = 'subscribers';
  refreshSubscribers().then(() => renderContactDatabase()).catch(() => renderContactDatabase());
  renderContactDatabase();
};

// ---------------- Legacy import (owner) ----------------
window.importLegacyData = async () => {
  if (!owner || !confirm('نقل بيانات هذا المتصفح إلى قاعدة البيانات المشتركة؟ لن يتم نقل السجلات الافتراضية.')) return;
  try {
    const legacyProviders = JSON.parse(localStorage.getItem('fayoum_medical_directory_db') || '[]').filter(x => !x.seedRecord);
    if (legacyProviders.length) {
      // Additive import: insert-only, existing server rows always win, never deletes.
      ok(await rpc('reaya_owner_providers_import', { p_token: token(), p_rows: legacyProviders.map(({ seedRecord, ...r }) => r) }));
      await refreshRevs(); await refreshProviders();
    }
    const legacyMembers = JSON.parse(localStorage.getItem('fayoum_member_cards') || '[]').filter(x => !x.seedRecord);
    if (legacyMembers.length) {
      ok(await rpc('reaya_owner_members_import', { p_token: token(), p_rows: legacyMembers.map(({ seedRecord, ...r }) => r) }));
      await refreshRevs(); await refreshMembers();
    }
    const legacyRequests = JSON.parse(localStorage.getItem('fayoum_join_requests') || '[]').filter(x => !x.seedRecord);
    if (legacyRequests.length) {
      ok(await rpc('reaya_owner_requests_import', { p_token: token(), p_rows: legacyRequests.map(({ seedRecord, localOnly, ...r }) => r) }));
      await refreshRequests();
    }
    alert('تم النقل. النسخة المحلية محفوظة على هذا المتصفح.');
    refresh();
  } catch (e) { fail(e); }
};

// ---------------- Interface text library ----------------
window.raayaContentStore = {
  current: contentCurrent,
  isOwner: () => owner,
  save: async values => {
    ok(await rpc('reaya_owner_content_save', { p_token: token(), p_texts: JSON.stringify(values) }));
    contentCurrent = values;
    window.raayaContentStore.current = contentCurrent;
  }
};
async function refreshContent() {
  try {
    const res = await rpc('reaya_public_content');
    if (res.status === 'ok') {
      contentCurrent = JSON.parse(res.texts);
      window.raayaContentStore.current = contentCurrent;
      window.dispatchEvent(new CustomEvent('raaya-content-update', { detail: contentCurrent }));
    }
  } catch (e) { console.error('Interface copy unavailable', e && e.message); const s = document.getElementById('contentEditorStatus'); if (s) s.textContent = 'تعذر تحميل النصوص المشتركة. لم يتم تأكيد أي حفظ.'; }
}

// ---------------- Owner session + entry points ----------------
window.openPinModal = () => {
  if (owner) return window.openAdminDashboard();
  document.getElementById('pinModal').classList.remove('hidden');
};
window.verifyPin = () => { location.assign(new URL('owner-login.html', location.href).href); };
const oldOpenAdmin = window.openAdminDashboard;
window.openAdminDashboard = () => {
  if (!owner) return window.openPinModal();
  oldOpenAdmin();
  refreshOwnerData().then(() => { renderAdminTable(); renderMembersTable(); renderRequestsTable(); calculateStats(); }).catch(e => console.error(e));
};
window.ownerSignOut = async () => {
  try { await rpc('reaya_owner_logout', { p_token: token() }); } catch (e) {}
  localStorage.removeItem(TOKEN_KEY);
  owner = false; serverMembers = []; serverRequests = []; serverSubscribers = [];
  stopAlerts();
  closeAdminDashboard();
  refresh();
};

const oldSettings = window.openAdvancedSettingsModal;
window.openAdvancedSettingsModal = () => { if (owner) oldSettings(); else window.openPinModal(); };
window.saveSiteSettings = () => { if (!owner) return; alert('استخدم مكتبة نصوص التطبيق للحفظ والنشر لكل الزوار.'); };

// ---------------- New-request alerts (owner, while the page is open) ----------------
// Polls pending join requests + pending card signups every 30s while the owner is
// signed in and the page is open. A new one shows a red bar and a repeating ring
// (with vibration where supported) until the owner taps "تم". Browsers block sound
// until the page has had one tap; locked screens/closed tabs cannot ring.
const SEEN_KEY = 'raaya.owner.seen';
let alertTimer = null, ringTimer = null, audioCtx = null;
const seenIds = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { return new Set(); } };
const pendingItems = () => [
  ...serverRequests.map(r => ({ id: r.id, kind: 'request' })),
  ...serverSubscribers.filter(s => s.status === 'pending').map(s => ({ id: s.id, kind: 'subscriber' }))
];
function audioUnlock() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}
['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, audioUnlock, { passive: true }));
function beep() {
  try {
    audioUnlock();
    if (audioCtx && audioCtx.state === 'running') {
      const t = audioCtx.currentTime;
      [0, 0.4].forEach(off => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'square'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.35, t + off); g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.32);
        o.connect(g); g.connect(audioCtx.destination); o.start(t + off); o.stop(t + off + 0.34);
      });
    }
  } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
}
function startRing() { if (ringTimer) return; beep(); ringTimer = setInterval(beep, 3000); }
function stopRing() { if (ringTimer) clearInterval(ringTimer); ringTimer = null; }
function hideAlertBar() { const b = document.getElementById('raayaAlertBar'); if (b) b.remove(); }
function ackAlerts() {
  stopRing(); hideAlertBar();
  const set = seenIds(); pendingItems().forEach(i => set.add(i.id));
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-500))); } catch (e) {}
}
function showAlertBar(fresh) {
  const reqs = fresh.filter(i => i.kind === 'request').length, subs = fresh.filter(i => i.kind === 'subscriber').length;
  hideAlertBar();
  const bar = document.createElement('div');
  bar.id = 'raayaAlertBar'; bar.dir = 'rtl';
  bar.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:5000;background:#b91c1c;color:#fff;padding:12px;font-weight:800;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.35)');
  const msg = document.createElement('div');
  const parts = [];
  if (reqs) parts.push(reqs + ' طلب انضمام');
  if (subs) parts.push(subs + ' طلب بطاقة');
  msg.textContent = '🔔 طلب جديد: ' + parts.join(' + ');
  bar.append(msg);
  const mk = (label, fn, bg) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.onclick = fn;
    b.setAttribute('style', 'margin:8px 6px 0;padding:8px 16px;border-radius:10px;border:0;font-weight:800;background:' + bg + ';color:#111');
    return b;
  };
  bar.append(mk('فتح', () => { ackAlerts(); if (fresh.some(i => i.kind === 'request')) window.openAdminDashboard(); if (fresh.some(i => i.kind === 'subscriber')) window.openContactDatabase(); }, '#fff'));
  bar.append(mk('تم (إيقاف الرنين)', ackAlerts, '#fde68a'));
  const hint = document.createElement('div');
  hint.setAttribute('style', 'font-size:12px;font-weight:600;margin-top:6px');
  hint.textContent = 'لو مفيش صوت، اضغط أي مكان في الصفحة لتفعيل الصوت.';
  bar.append(hint);
  document.body.append(bar);
}
async function pollAlerts() {
  if (!owner || document.hidden) return;
  try {
    await refreshRequests(); await refreshSubscribers();
  } catch (e) { return; }
  const seen = seenIds();
  const fresh = pendingItems().filter(i => !seen.has(i.id));
  if (fresh.length) { showAlertBar(fresh); startRing(); }
  else { stopRing(); hideAlertBar(); }
  try { renderRequestsTable(); if (!document.getElementById('contactDatabase').classList.contains('hidden')) renderContactDatabase(); } catch (e) {}
}
function startAlerts() {
  if (alertTimer) return;
  alertTimer = setInterval(pollAlerts, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollAlerts(); });
  pollAlerts();
}
function stopAlerts() { if (alertTimer) clearInterval(alertTimer); alertTimer = null; stopRing(); hideAlertBar(); }

// ---------------- Boot ----------------
window.addEventListener('offline', () => statusText('غير متصل، لا يتم تأكيد أي حفظ'));
window.addEventListener('online', () => statusText('جارٍ الاتصال'));

(async () => {
  try {
    await refreshProviders();
    statusText('متصل');
  } catch (e) {
    statusText('غير متصل، يتم عرض نسخة محفوظة');
  }
  refreshContent();
  if (token()) {
    try {
      await refreshOwnerData();
      owner = true;
      setTimeout(startAlerts, 0);
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      owner = false;
    }
  }
  refresh();
  const shortCode = new URLSearchParams(location.hash.slice(1)).get('c');
  if (shortCode) {
    openMemberCardModal();
    document.getElementById('memberSearchInput').value = '';
    try {
      const res = await rpc('reaya_public_card_short', { p_code: shortCode });
      if (res.status === 'ok') { displayCardData(res.card); document.getElementById('printableCardArea').classList.remove('hidden'); }
      else alert(res.status === 'busy' ? 'الخدمة مشغولة مؤقتًا، حاول بعد قليل.' : 'لم يتم العثور على البطاقة.');
    } catch (e) { fail(e); }
  }
  const cardToken = new URLSearchParams(location.hash.slice(1)).get('card');
  if (cardToken) {
    openMemberCardModal();
    document.getElementById('memberSearchInput').value = cardToken;
    lookupMemberCard();
  }
})();
})();
