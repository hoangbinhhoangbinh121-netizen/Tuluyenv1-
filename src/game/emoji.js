'use strict';
/**
 * Hệ emoji PIXEL của Tiên Giới Bot v7.0.
 *
 *  - Nguồn duy nhất: assets/emoji/<key>.png (128x128, vẽ bởi scripts/make_pixel_emoji_v7.py).
 *  - Lúc khởi động bot tự tải lên thành "Application Emoji" tên `tg7_<key>` (nếu chưa có) rồi dùng <:tg7_key:id>.
 *  - E.<key> luôn trả về chuỗi hiện hành: emoji pixel nếu đã sẵn sàng, ngược lại emoji Unicode dự phòng (data/emoji_fallback.json).
 *    Nhờ vậy không bao giờ hiện chữ ":tên:" thô và không module nào tự tìm emoji riêng.
 *  - Mọi chuỗi <:tên:id> cũ gắn cứng trong code/constants được `skinEmojiText()` đổi sang emoji pixel khi gửi đi.
 */
const fs = require('node:fs');
const path = require('node:path');
const K = require('./constants');

const PREFIX = 'tg7_';
const API = process.env.TULUYEN_DISCORD_API || 'https://discord.com/api/v10';
const EMOJI_DIR = path.join(__dirname, '..', '..', 'assets', 'emoji');
const CACHE = process.env.TULUYEN_EMOJI_CACHE || path.join(__dirname, '..', '..', 'data', 'emoji_ids_v7.json');
const FALLBACK = require('../data/emoji_fallback.json');

const keysOnDisk = () => { try { return fs.readdirSync(EMOJI_DIR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)); } catch (_) { return []; } };
const ALL_KEYS = keysOnDisk();

// Giá trị khởi tạo = Unicode dự phòng (luôn hiển thị được). Pixel sẽ đè lên sau khi đồng bộ.
const CUSTOM_EMOJI = {};
for (const k of new Set([...ALL_KEYS, ...Object.keys(K.CUSTOM_EMOJI || {})])) CUSTOM_EMOJI[k] = FALLBACK[k] || '';
const E = new Proxy(CUSTOM_EMOJI, { get: (t, k) => (typeof k === 'string' && k in t ? t[k] : '') });

const BAR_KEYS = { tuvi: 'bar_tuvi', hp: 'bar_hp', lucchien: 'bar_lucchien', green: 'bar_green', empty: 'bar_empty', mp: 'bar_mp', gold: 'bar_gold', purple: 'bar_purple' };
const BAR_FALLBACK = { tuvi: '🟦', hp: '🟥', lucchien: '🟧', green: '🟩', empty: '⬛', mp: '🟦', gold: '🟨', purple: '🟪' };
const BAR = { ...BAR_FALLBACK };

/** Tên emoji cũ (gắn cứng trong code Python/constants) → key pixel mới. */
const LEGACY_ALIAS = {
  phamnhan: 'canhgioi_0', tuvi: 'bar_tuvi', hp: 'bar_hp', lucchien: 'bar_lucchien', green: 'bar_green', barempty: 'bar_empty',
  emoji_3: 'daolu_ketdoi', emoji_4: 'daolu_chiatay',
};

const isPixel = (s) => typeof s === 'string' && s.includes(`:${PREFIX}`);
const setResolved = (key, tag) => {
  const bar = Object.keys(BAR_KEYS).find((b) => BAR_KEYS[b] === key);
  if (bar) BAR[bar] = tag;
  CUSTOM_EMOJI[key] = tag;
};

// ------------------------------------------------------------------ REST (Application Emoji)
async function api(method, p, token, payload) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API + p, {
      method,
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (tiengioi-emoji-sync, 7.0)' },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 429) {
      let wait = 2;
      try { wait = Number((await res.json()).retry_after) || 2; } catch (_) { /* giữ 2s */ }
      if (wait > 20) throw new Error(`bị giới hạn tốc độ (${Math.round(wait)}s)`);
      await new Promise((r) => setTimeout(r, Math.max(wait, 0.5) * 1000 + 200));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }
  throw new Error('quá số lần thử');
}

const readCache = () => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (_) { return {}; } };
const writeCache = (obj) => { try { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(obj, null, 1)); } catch (_) { /* không ghi được thì thôi */ } };

let _pending = [];
/**
 * Đồng bộ emoji pixel. Trả { resolved, pending }.
 * budgetMs: dừng tải thêm khi quá thời gian (phần còn lại làm nền sau khi bot lên, hoặc lần khởi động sau).
 */
async function syncPixelEmoji({ budgetMs = 90000 } = {}) {
  if ((process.env.TULUYEN_EMOJI_AUTOSYNC || '1').trim() === '0') {
    console.log('ℹ️ Emoji pixel: autosync đang TẮT — dùng emoji Unicode dự phòng.');
    return { resolved: {}, pending: [] };
  }
  const token = process.env.DISCORD_TOKEN;
  const resolved = {};
  const t0 = Date.now();
  let uploaded = 0;
  const wanted = ALL_KEYS.filter((k) => fs.existsSync(path.join(EMOJI_DIR, `${k}.png`)));
  try {
    if (!token) throw new Error('chưa có DISCORD_TOKEN');
    const appId = (await api('GET', '/oauth2/applications/@me', token)).id;
    const listing = (await api('GET', `/applications/${appId}/emojis`, token)) || {};
    const existing = Object.fromEntries((listing.items || []).map((e) => [e.name, e]));
    const pending = [];
    for (const key of wanted) {
      const name = PREFIX + key;
      let e = existing[name];
      if (!e) {
        if (Date.now() - t0 > budgetMs) { pending.push(key); continue; }
        try {
          const b64 = fs.readFileSync(path.join(EMOJI_DIR, `${key}.png`)).toString('base64');
          e = await api('POST', `/applications/${appId}/emojis`, token, { name, image: `data:image/png;base64,${b64}` });
          uploaded++;
        } catch (ex) { console.warn(`⚠️ Emoji pixel '${key}': không tải lên được (${ex.message}) — dùng dự phòng.`); pending.push(key); continue; }
      }
      resolved[key] = `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
    }
    _pending = pending;
    writeCache(resolved);
    console.log(`🎨 Emoji pixel: ${Object.keys(resolved).length}/${wanted.length} sẵn sàng (mới tải lên ${uploaded}${pending.length ? `, còn ${pending.length} sẽ tải tiếp ở nền` : ''}).`);
  } catch (ex) {
    console.warn(`⚠️ Emoji pixel: không đồng bộ được (${ex.message}) — thử bộ nhớ đệm / emoji Unicode dự phòng.`);
    const cache = readCache();
    for (const k of wanted) if (typeof cache[k] === 'string' && isPixel(cache[k])) resolved[k] = cache[k];
    _pending = wanted.filter((k) => !resolved[k]);
  }
  for (const [k, tag] of Object.entries(resolved)) setResolved(k, tag);
  return { resolved, pending: _pending.slice() };
}

/** Tải tiếp các emoji còn thiếu (chạy nền, mỗi lượt tối đa vài chục cái để tránh bị giới hạn tốc độ). */
function continuePixelSyncInBackground() {
  if (!_pending.length) return;
  const loop = async () => {
    const r = await syncPixelEmoji({ budgetMs: 60000 });
    if (r.pending.length) setTimeout(loop, 10 * 60 * 1000).unref();
  };
  setTimeout(loop, 15000).unref();
}

/**
 * Chạy SAU khi đăng nhập: đối chiếu với danh sách Application Emoji thật của bot; ID nào không còn dùng được
 * (vd bộ nhớ đệm của bot khác) thì đổi về Unicode dự phòng — tránh hiện ":tên:" thô.
 */
async function applyEmojiFallbacks(client) {
  try {
    const appId = client.application && client.application.id ? client.application.id : (client.user && client.user.id);
    const listing = (await api('GET', `/applications/${appId}/emojis`, process.env.DISCORD_TOKEN)) || {};
    const usable = new Set((listing.items || []).map((e) => String(e.id)));
    let swapped = 0;
    for (const [key, val] of Object.entries(CUSTOM_EMOJI)) {
      const m = /^<a?:(\w+):(\d+)>$/.exec(String(val));
      if (!m || usable.has(m[2])) continue;
      CUSTOM_EMOJI[key] = FALLBACK[key] || '';
      const bar = Object.keys(BAR_KEYS).find((b) => BAR_KEYS[b] === key);
      if (bar) BAR[bar] = BAR_FALLBACK[bar];
      swapped++;
    }
    if (swapped) console.log(`🎨 Emoji: ${swapped} emoji không dùng được → đổi sang Unicode dự phòng.`);
  } catch (e) { console.warn('⚠️ Không kiểm tra được emoji:', e.message); }
}

/** Chuỗi emoji → tham số `emoji` của Button/Select (discord.js nhận id hoặc unicode). */
function toComponentEmoji(str) {
  const m = /^<(a?):(\w+):(\d+)>$/.exec(str || '');
  if (m) {
    const key = m[2].startsWith(PREFIX) ? m[2].slice(PREFIX.length) : null;
    if (key || isPixel(str)) return { id: m[3], name: m[2], animated: m[1] === 'a' };
    // emoji cũ gắn cứng: đổi sang pixel/dự phòng theo tên
    const mapped = legacyToCurrent(m[2]);
    if (mapped && mapped !== str) return toComponentEmoji(mapped);
    return undefined; // không rõ → bỏ emoji thay vì để Discord từ chối cả tin nhắn
  }
  return str || undefined;
}

function legacyToCurrent(name) {
  const key = LEGACY_ALIAS[name] || (name in CUSTOM_EMOJI ? name : null);
  if (!key) return '';
  return CUSTOM_EMOJI[key] || FALLBACK[key] || '';
}

/** Đổi mọi <:tên:id> KHÔNG phải emoji pixel của bot sang emoji hiện hành (pixel hoặc Unicode). */
function skinEmojiText(text) {
  if (typeof text !== 'string' || text.indexOf('<') < 0) return text;
  return text.replace(/<(a?):(\w+):(\d+)>/g, (all, _a, name) => {
    if (name.startsWith(PREFIX)) return all;
    const cur = legacyToCurrent(name);
    return cur === '' ? (name === 'barempty' ? BAR.empty : '✦') : cur;
  });
}

/** Emoji cảnh giới lớn theo chỉ số 0..14. */
const realmEmoji = (idx) => CUSTOM_EMOJI[`canhgioi_${Math.max(0, Math.min(14, Number(idx) || 0))}`] || '✦';

module.exports = {
  E, BAR, CUSTOM_EMOJI, PREFIX, ALL_KEYS, syncPixelEmoji, continuePixelSyncInBackground, applyEmojiFallbacks,
  toComponentEmoji, skinEmojiText, realmEmoji, FALLBACK,
};
