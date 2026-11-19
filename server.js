// GenZ Cafe — simple Node server (sirf built-in modules, koi npm dependency nahi)
// Chalane ke liye:  node server.js   phir browser mein http://localhost:3000 kholo
// Data: default mein data.json file mein; SUPABASE_URL + SUPABASE_SERVICE_KEY env
// set hon to data Supabase online database mein rehta hai (hosting reset par bhi safe).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- Seed data (pehli baar data.json banta hai) ----------
function seedData() {
  const dishes = [
    { name: 'Paneer Butter Masala', price: 240, category: 'Main Course', emoji: '🍛', desc: 'Makhan wali creamy gravy, kasuri methi ke saath' },
    { name: 'Veg Biryani', price: 199, category: 'Main Course', emoji: '🍚', desc: 'Dum style, raita ke saath' },
    { name: 'Masala Dosa', price: 140, category: 'South Indian', emoji: '🥞', desc: 'Crisp dosa, aloo masala, sambhar + chutney' },
    { name: 'Idli Sambhar (4 pc)', price: 90, category: 'South Indian', emoji: '🍥', desc: 'Soft idli, garam sambhar' },
    { name: 'Hakka Noodles', price: 160, category: 'Chinese', emoji: '🍜', desc: 'Veg hakka noodles, street style' },
    { name: 'Manchurian + Fried Rice', price: 180, category: 'Chinese', emoji: '🍱', desc: 'Gobi manchurian ke saath fried rice' },
    { name: 'Hara Bhara Kebab', price: 150, category: 'Starters', emoji: '🧆', desc: 'Palak aur sabziyon ke kebab, mint chutney' },
    { name: 'Crispy Corn', price: 130, category: 'Starters', emoji: '🌽', desc: 'Chatpata crispy corn' },
    { name: 'Butter Naan', price: 50, category: 'Breads', emoji: '🫓', desc: 'Tandoor se seedha, butter laga ke' },
    { name: 'Garlic Naan', price: 60, category: 'Breads', emoji: '🧄', desc: 'Lehsun aur dhaniya wala naan' },
    { name: 'Cold Coffee', price: 110, category: 'Beverages', emoji: '🧋', desc: 'Thandi, frothy cold coffee' },
    { name: 'Masala Chai', price: 40, category: 'Beverages', emoji: '☕', desc: 'Adrak-elaichi wali kadak chai' },
    { name: 'Gulab Jamun (2 pc)', price: 70, category: 'Desserts', emoji: '🍮', desc: 'Garam gulab jamun' },
    { name: 'Brownie with Ice Cream', price: 120, category: 'Desserts', emoji: '🍫', desc: 'Warm brownie, vanilla scoop' },
  ].map((d, i) => ({
    id: i + 1, name: d.name, price: d.price, originalPrice: 0, discountPercent: 0,
    category: d.category, emoji: d.emoji, description: d.desc, image: '',
    available: true, popular: i < 3,
  }));
  return {
    admin: null, // { passwordHash }
    dishes,
    offers: [],
    customers: [],
    orders: [],
    settings: { wifiName: '', wifiPassword: '' },
    nextId: { dish: dishes.length + 1, offer: 1, customer: 1, order: 1 },
  };
}

// ---------- Storage: local data.json (default) ya Supabase online database ----------
// SUPABASE_URL aur SUPABASE_SERVICE_KEY env set hon to poora app state Supabase ki
// `app_state` table mein ek hi JSON document (id=1) ke roop mein save hota hai.
// Warna purana data.json wala behaviour bilkul waisa hi chalta hai.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);

// ---------- Google Login (OAuth) ----------
// GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env set hon to asli Google login chalta hai.
// APP_URL = site ka public address (jaise https://genz-cafe-production.up.railway.app)
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');
const socialPending = new Map(); // token -> { googleId, email, name, exp }

function loadLocalData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const d = JSON.parse(raw);
    if (d && Array.isArray(d.dishes)) return d;
  } catch (e) { /* file nahi hai ya kharab hai — seed banao */ }
  const d = seedData();
  saveLocalData(d);
  return d;
}
function saveLocalData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
}

async function supabaseRequest(pathname, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    return await fetch(SUPABASE_URL + pathname, {
      ...(options || {}),
      signal: ctrl.signal,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        ...((options && options.headers) || {}),
      },
    });
  } finally { clearTimeout(timer); }
}

async function supabaseLoad() {
  let res;
  try {
    res = await supabaseRequest('/rest/v1/app_state?select=state&id=eq.1');
  } catch (e) {
    throw new Error('Supabase se connect nahi ho paya (' + e.message + ') — SUPABASE_URL sahi hai aur internet chal raha hai?');
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Supabase load fail (HTTP ' + res.status + ') ' + txt.slice(0, 200) +
      ' — supabase-setup.sql wala SQL chalaya tha? Aur SUPABASE_SERVICE_KEY (service_role) sahi hai?');
  }
  const rows = await res.json().catch(() => []);
  const state = Array.isArray(rows) && rows[0] ? rows[0].state : null;
  if (state && Array.isArray(state.dishes)) return state;
  // Row khaali hai (naya setup) — seed banao aur save kar do
  const d = seedData();
  await supabaseSaveNow(d);
  return d;
}

async function supabaseSaveNow(stateObj) {
  const res = await supabaseRequest('/rest/v1/app_state', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id: 1, state: stateObj }]),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Supabase save fail (HTTP ' + res.status + ') ' + txt.slice(0, 200));
  }
}

// Supabase mode mein save debounce + serial hota hai: har mutation par turant
// network call nahi lagta, latest state hi save hota hai, ek time par ek hi save.
// Local mode mein saveData pehle ki tarah turant file mein likhta hai.
let sbSaveTimer = null;
let sbSaveRunning = false;
let sbSaveDirty = false;
function saveData(d) {
  if (!USE_SUPABASE) { saveLocalData(d); return; }
  if (sbSaveTimer) return; // ek save pehle se schedule hai — wahi latest state save karega
  sbSaveTimer = setTimeout(() => { sbSaveTimer = null; runSupabaseSave(); }, 300);
}
async function runSupabaseSave() {
  if (sbSaveRunning) { sbSaveDirty = true; return; }
  sbSaveRunning = true;
  try {
    await supabaseSaveNow(DB);
  } catch (e) {
    console.error('⚠️ Supabase save fail:', e.message);
  }
  sbSaveRunning = false;
  if (sbSaveDirty) { sbSaveDirty = false; runSupabaseSave(); }
}

let DB = null; // init() mein load hota hai — server listen hone se pehle

// ---------- Password hashing (scrypt + salt) ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(String(pw), salt, 64);
  const orig = Buffer.from(hash, 'hex');
  return calc.length === orig.length && crypto.timingSafeEqual(calc, orig);
}

// ---------- Sessions (memory mein) ----------
const sessions = new Map(); // token -> { type:'admin' } | { type:'customer', customerId }
function newSession(val) {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.set(t, val);
  return t;
}
function getSession(req) {
  const t = req.headers['x-session'];
  return t ? sessions.get(t) || null : null;
}

// ---------- Login lockout (simple) ----------
const fails = new Map(); // key -> { count, until }
function isLocked(key) {
  const f = fails.get(key);
  return f && f.until && Date.now() < f.until;
}
function recordFail(key, max, lockMs) {
  const f = fails.get(key) || { count: 0, until: 0 };
  f.count++;
  if (f.count >= max) { f.until = Date.now() + lockMs; f.count = 0; }
  fails.set(key, f);
}
function clearFails(key) { fails.delete(key); }

// ---------- Helpers ----------
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 8 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function publicDish(d) { return d; }
function publicCustomer(c) {
  return {
    id: c.id, name: c.name, mobile: c.mobile, points: c.points,
    lifetimePoints: c.lifetimePoints, totalSpent: c.totalSpent,
    memberSince: c.memberSince, history: c.history || [],
  };
}
function calcDishPrice(d) {
  const mrp = Number(d.originalPrice) || 0;
  const pct = Number(d.discountPercent) || 0;
  if (mrp > 0 && pct > 0) return Math.round(mrp * (1 - pct / 100));
  return Math.max(0, Math.round(Number(d.price) || 0));
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const body = (req.method === 'POST') ? await readBody(req) : {};
  const sess = getSession(req);
  const isAdmin = sess && sess.type === 'admin';
  const cust = sess && sess.type === 'customer'
    ? DB.customers.find((c) => c.id === sess.customerId) : null;

  // --- Public: menu + offers + admin setup state ---
  if (p === '/api/state' && req.method === 'GET') {
    return send(res, 200, {
      adminSetupDone: !!DB.admin,
      dishes: DB.dishes,
      offers: DB.offers.filter((o) => o.active),
    });
  }

  // --- Admin setup (sirf pehli baar, jab koi password na ho) ---
  if (p === '/api/admin/setup' && req.method === 'POST') {
    if (DB.admin) return send(res, 400, { error: 'Admin password pehle se set hai' });
    const pw = String(body.password || '');
    if (pw.length < 6) return send(res, 400, { error: 'Password kam se kam 6 characters ka ho' });
    DB.admin = { passwordHash: hashPassword(pw) };
    saveData(DB);
    return send(res, 200, { token: newSession({ type: 'admin' }) });
  }

  // --- Admin login ---
  if (p === '/api/admin/login' && req.method === 'POST') {
    if (!DB.admin) return send(res, 400, { error: 'Pehle naya admin password set karo' });
    if (isLocked('admin')) return send(res, 429, { error: 'Bahut galat koshishen — 10 minute baad try karo' });
    if (!verifyPassword(body.password || '', DB.admin.passwordHash)) {
      recordFail('admin', 8, 10 * 60 * 1000);
      return send(res, 401, { error: 'Galat admin password hai' });
    }
    clearFails('admin');
    return send(res, 200, { token: newSession({ type: 'admin' }) });
  }

  // --- Social (Google) pending session: setup form ke liye naam/email ---
  if (p === '/api/social/session' && req.method === 'POST') {
    const pend = socialPending.get(String(body.pending || ''));
    if (!pend || pend.exp < Date.now()) return send(res, 400, { error: 'Google session khatm - phir se Google login karo' });
    return send(res, 200, { name: pend.name, email: pend.email });
  }

  // --- Customer register ---
  if (p === '/api/customer/register' && req.method === 'POST') {
    const name = String(body.name || '').trim();
    const mobile = String(body.mobile || '').replace(/\D/g, '');
    const pw = String(body.password || '');
    if (name.length < 1 || name.length > 60) return send(res, 400, { error: 'Naam sahi se likho' });
    if (mobile.length < 10 || mobile.length > 15) return send(res, 400, { error: 'Mobile number sahi nahi hai' });
    if (pw.length < 4 || pw.length > 32) return send(res, 400, { error: 'Password 4–32 characters ka ho' });
    if (DB.customers.some((c) => c.mobile === mobile)) {
      return send(res, 400, { error: 'Ye number pehle se registered hai — Login karo' });
    }
    let googleId = '', googleEmail = '';
    const pend = body.socialToken ? socialPending.get(String(body.socialToken)) : null;
    if (pend && pend.exp >= Date.now()) {
      const existing = DB.customers.find((x) => x.googleId && x.googleId === pend.googleId);
      if (existing) {
        socialPending.delete(String(body.socialToken));
        return send(res, 200, { token: newSession({ type: 'customer', customerId: existing.id }), customer: publicCustomer(existing) });
      }
      googleId = pend.googleId; googleEmail = pend.email;
      socialPending.delete(String(body.socialToken));
    }
    const c = {
      id: DB.nextId.customer++, name, mobile, passwordHash: hashPassword(pw),
      provider: body.provider === 'apple' ? 'apple' : 'google',
      googleId, googleEmail,
      points: 0, lifetimePoints: 0, totalSpent: 0,
      memberSince: new Date().toISOString().slice(0, 10), history: [],
    };
    DB.customers.push(c);
    saveData(DB);
    return send(res, 200, { token: newSession({ type: 'customer', customerId: c.id }), customer: publicCustomer(c) });
  }

  // --- Customer login ---
  if (p === '/api/customer/login' && req.method === 'POST') {
    const mobile = String(body.mobile || '').replace(/\D/g, '');
    const c = DB.customers.find((x) => x.mobile === mobile);
    if (!c) return send(res, 404, { error: 'Ye number registered nahi hai — pehle account banao' });
    const key = 'cust:' + mobile;
    if (isLocked(key)) return send(res, 429, { error: 'Bahut galat koshishen — 15 minute baad try karo' });
    if (!verifyPassword(body.password || '', c.passwordHash)) {
      recordFail(key, 5, 15 * 60 * 1000);
      return send(res, 401, { error: 'Galat password hai' });
    }
    clearFails(key);
    return send(res, 200, { token: newSession({ type: 'customer', customerId: c.id }), customer: publicCustomer(c) });
  }

  // --- Logout ---
  if (p === '/api/logout' && req.method === 'POST') {
    const t = req.headers['x-session'];
    if (t) sessions.delete(t);
    return send(res, 200, { ok: true });
  }

  // ============ CUSTOMER (login zaroori) ============
  if (p.startsWith('/api/customer/')) {
    if (!cust) return send(res, 401, { error: 'Login session khatm — phir login karo' });

    if (p === '/api/customer/me' && req.method === 'GET') {
      return send(res, 200, { customer: publicCustomer(cust), wifi: DB.settings });
    }
    if (p === '/api/customer/orders' && req.method === 'GET') {
      return send(res, 200, { orders: DB.orders.filter((o) => o.customerId === cust.id) });
    }
    if (p === '/api/customer/orders' && req.method === 'POST') {
      const itemsIn = Array.isArray(body.items) ? body.items : [];
      const items = [];
      let total = 0, mrpTotal = 0;
      for (const it of itemsIn) {
        const d = DB.dishes.find((x) => x.id === Number(it.dishId));
        const qty = Math.max(1, Math.min(50, Number(it.qty) || 1));
        if (!d || !d.available) continue;
        const price = calcDishPrice(d);
        const mrp = (Number(d.originalPrice) || 0) > price ? Number(d.originalPrice) : price;
        items.push({ dishId: d.id, name: d.name, price, qty });
        total += price * qty;
        mrpTotal += mrp * qty;
      }
      if (!items.length) return send(res, 400, { error: 'Cart khaali hai' });
      const id = DB.nextId.order++;
      const earned = Math.floor(total / 100) * 10;
      const order = {
        id, number: 'GZ-' + (1000 + id), customerId: cust.id,
        customerName: cust.name, mobile: cust.mobile,
        items, total, mrpTotal, status: 'placed', paid: false,
        pointsEarned: earned, freeReward: false,
        date: new Date().toISOString(),
      };
      DB.orders.push(order);
      cust.points += earned;
      cust.lifetimePoints += earned;
      cust.totalSpent += total;
      if (earned) cust.history.unshift({ text: 'Order ' + order.number, points: earned, date: order.date.slice(0, 10) });
      saveData(DB);
      return send(res, 200, { order, customer: publicCustomer(cust) });
    }
    if (p === '/api/customer/pay' && req.method === 'POST') {
      const o = DB.orders.find((x) => x.id === Number(body.orderId) && x.customerId === cust.id);
      if (!o) return send(res, 404, { error: 'Order nahi mila' });
      o.paid = true;
      saveData(DB);
      return send(res, 200, { order: o });
    }
    if (p === '/api/customer/track' && req.method === 'GET') {
      const num = String(url.searchParams.get('number') || '').toUpperCase();
      const o = DB.orders.find((x) => x.number === num && x.customerId === cust.id);
      if (!o) return send(res, 404, { error: 'Order nahi mila' });
      return send(res, 200, { order: o });
    }
    if (p === '/api/customer/redeem' && req.method === 'POST') {
      if (cust.points < 200) return send(res, 400, { error: '200 points chahiye — abhi ' + cust.points + ' hain' });
      cust.points -= 200;
      const id = DB.nextId.order++;
      const order = {
        id, number: 'GZ-' + (1000 + id), customerId: cust.id,
        customerName: cust.name, mobile: cust.mobile,
        items: [{ dishId: 0, name: '🎁 Free Dish (Points Reward)', price: 0, qty: 1 }],
        total: 0, mrpTotal: 0, status: 'placed', paid: true,
        pointsEarned: 0, freeReward: true, date: new Date().toISOString(),
      };
      DB.orders.push(order);
      cust.history.unshift({ text: 'Free dish redeem (' + order.number + ')', points: -200, date: order.date.slice(0, 10) });
      saveData(DB);
      return send(res, 200, { order, customer: publicCustomer(cust) });
    }
    return send(res, 404, { error: 'Not found' });
  }

  // ============ ADMIN (admin login zaroori) ============
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin) return send(res, 401, { error: 'Admin login chahiye' });

    if (p === '/api/admin/change-password' && req.method === 'POST') {
      if (!verifyPassword(body.current || '', DB.admin.passwordHash)) {
        return send(res, 401, { error: 'Current password galat hai' });
      }
      const pw = String(body.next || '');
      if (pw.length < 6) return send(res, 400, { error: 'Naya password kam se kam 6 characters ka ho' });
      DB.admin.passwordHash = hashPassword(pw);
      saveData(DB);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/dishes' && req.method === 'POST') {
      const d = body.dish || {};
      const dish = {
        name: String(d.name || '').trim().slice(0, 80),
        price: Math.max(0, Math.round(Number(d.price) || 0)),
        originalPrice: Math.max(0, Math.round(Number(d.originalPrice) || 0)),
        discountPercent: Math.max(0, Math.min(90, Math.round(Number(d.discountPercent) || 0))),
        category: String(d.category || 'Main Course').slice(0, 40),
        emoji: String(d.emoji || '🍽️').slice(0, 8),
        description: String(d.description || '').slice(0, 200),
        image: typeof d.image === 'string' && d.image.startsWith('data:image/') ? d.image : '',
        available: d.available !== false,
        popular: !!d.popular,
      };
      if (!dish.name) return send(res, 400, { error: 'Dish ka naam likho' });
      dish.price = calcDishPrice(dish);
      if (d.id) {
        const old = DB.dishes.find((x) => x.id === Number(d.id));
        if (!old) return send(res, 404, { error: 'Dish nahi mili' });
        Object.assign(old, dish);
        saveData(DB);
        return send(res, 200, { dish: old });
      }
      dish.id = DB.nextId.dish++;
      DB.dishes.push(dish);
      saveData(DB);
      return send(res, 200, { dish });
    }
    if (p === '/api/admin/dishes/delete' && req.method === 'POST') {
      DB.dishes = DB.dishes.filter((x) => x.id !== Number(body.id));
      saveData(DB);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/dishes/availability' && req.method === 'POST') {
      const d = DB.dishes.find((x) => x.id === Number(body.id));
      if (!d) return send(res, 404, { error: 'Dish nahi mili' });
      d.available = !!body.available;
      saveData(DB);
      return send(res, 200, { dish: d });
    }
    if (p === '/api/admin/offers' && req.method === 'POST') {
      const o = body.offer || {};
      const offer = {
        title: String(o.title || '').trim().slice(0, 100),
        text: String(o.text || '').slice(0, 300),
        image: typeof o.image === 'string' && o.image.startsWith('data:image/') ? o.image : '',
        active: o.active !== false,
      };
      if (!offer.title) return send(res, 400, { error: 'Offer ka title likho' });
      if (o.id) {
        const old = DB.offers.find((x) => x.id === Number(o.id));
        if (!old) return send(res, 404, { error: 'Offer nahi mila' });
        Object.assign(old, offer);
        saveData(DB);
        return send(res, 200, { offer: old });
      }
      offer.id = DB.nextId.offer++;
      DB.offers.push(offer);
      saveData(DB);
      return send(res, 200, { offer });
    }
    if (p === '/api/admin/offers/delete' && req.method === 'POST') {
      DB.offers = DB.offers.filter((x) => x.id !== Number(body.id));
      saveData(DB);
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/offers/toggle' && req.method === 'POST') {
      const o = DB.offers.find((x) => x.id === Number(body.id));
      if (!o) return send(res, 404, { error: 'Offer nahi mila' });
      o.active = !!body.active;
      saveData(DB);
      return send(res, 200, { offer: o });
    }
    if (p === '/api/admin/orders' && req.method === 'GET') {
      return send(res, 200, { orders: DB.orders });
    }
    if (p === '/api/admin/orders/status' && req.method === 'POST') {
      const o = DB.orders.find((x) => x.id === Number(body.id));
      if (!o) return send(res, 404, { error: 'Order nahi mila' });
      const flow = ['placed', 'preparing', 'ready', 'served'];
      if (flow.includes(body.status)) o.status = body.status;
      saveData(DB);
      return send(res, 200, { order: o });
    }
    if (p === '/api/admin/orders/pay' && req.method === 'POST') {
      const o = DB.orders.find((x) => x.id === Number(body.id));
      if (!o) return send(res, 404, { error: 'Order nahi mila' });
      o.paid = true;
      saveData(DB);
      return send(res, 200, { order: o });
    }
    if (p === '/api/admin/data' && req.method === 'GET') {
      return send(res, 200, {
        dishes: DB.dishes, offers: DB.offers,
        customers: DB.customers.map(publicCustomer),
        settings: DB.settings,
      });
    }
    if (p === '/api/admin/settings' && req.method === 'POST') {
      DB.settings.wifiName = String(body.wifiName || '').slice(0, 60);
      DB.settings.wifiPassword = String(body.wifiPassword || '').slice(0, 60);
      saveData(DB);
      return send(res, 200, { settings: DB.settings });
    }
    return send(res, 404, { error: 'Not found' });
  }

  return send(res, 404, { error: 'Not found' });
}

// ---------- Static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
function serveStatic(req, res, url) {
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}

async function handleGoogleAuth(req, res, url) {
  const base = APP_URL || ('https://' + (req.headers.host || 'localhost'));
  const redirectUri = base + '/auth/google/callback';
  if (url.pathname === '/auth/google') {
    if (!GOOGLE_ID || !GOOGLE_SECRET) {
      res.writeHead(302, { Location: '/#demo=google' });
      return res.end();
    }
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(GOOGLE_ID) +
      '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code&scope=' +
      encodeURIComponent('openid email profile') + '&prompt=select_account';
    res.writeHead(302, { Location: authUrl });
    return res.end();
  }
  const fail = () => { res.writeHead(302, { Location: '/#socialerror=1' }); res.end(); };
  const code = url.searchParams.get('code');
  if (!code || !GOOGLE_ID || !GOOGLE_SECRET) return fail();
  try {
    const tokRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tok = await tokRes.json().catch(() => ({}));
    if (!tok.access_token) return fail();
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + tok.access_token },
    });
    const info = await infoRes.json().catch(() => ({}));
    if (!info.sub) return fail();
    const cust = DB.customers.find((x) => x.googleId && x.googleId === info.sub);
    if (cust) {
      const t = newSession({ type: 'customer', customerId: cust.id });
      res.writeHead(302, { Location: '/#token=' + t });
      return res.end();
    }
    const pend = crypto.randomBytes(18).toString('hex');
    socialPending.set(pend, { googleId: info.sub, email: info.email || '', name: info.name || '', exp: Date.now() + 15 * 60 * 1000 });
    res.writeHead(302, { Location: '/#social=' + pend });
    return res.end();
  } catch (e) { return fail(); }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/auth/google')) {
    handleGoogleAuth(req, res, url).catch(() => { try { res.writeHead(302, { Location: '/#socialerror=1' }); res.end(); } catch (e) {} });
  } else if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch((e) => { console.error(e); send(res, 500, { error: 'Server error' }); });
  } else {
    serveStatic(req, res, url);
  }
});
async function init() {
  if (USE_SUPABASE) {
    DB = await supabaseLoad();
    console.log('Storage mode: Supabase online database — data hosting reset par bhi safe rahega');
  } else {
    DB = loadLocalData();
    console.log('Storage mode: local data.json file');
  }
  server.listen(PORT, () => {
    console.log('GenZ Cafe chal raha hai: http://localhost:' + PORT);
  });
}
init().catch((e) => {
  console.error('❌ Server start nahi ho paya:', e.message);
  if (USE_SUPABASE) {
    console.error('Check karo: 1) SUPABASE_URL aur SUPABASE_SERVICE_KEY sahi daale hain, ' +
      '2) Supabase SQL Editor mein supabase-setup.sql wala SQL chalaya hai.');
  }
  process.exit(1);
});

// Hosting band hone se pehle pending Supabase save pura karne ki koshish
process.on('SIGTERM', async () => {
  if (USE_SUPABASE && DB) {
    try { await supabaseSaveNow(DB); } catch (e) { /* ignore */ }
  }
  process.exit(0);
});
