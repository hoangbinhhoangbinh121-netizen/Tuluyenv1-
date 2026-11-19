'use strict';
/**
 * V20.0 — Bộ đếm trọn đời + Danh hiệu nghề nghiệp + dữ liệu Sổ Tay (nguyên liệu / đan phương / bản vẽ / trận đồ / linh thực).
 * Chỉ ĐỌC danh mục v17 (nguồn, công dụng); không lưu bản sao dữ liệu — Sổ Tay luôn khớp với catalog17.
 */
const D = require('../db');
const Cat = require('./catalog17');
const V = require('../data/v20_data');
const { I, C } = Cat;
const { now, int } = require('../util');

const uid = (u) => String(u);
const stat = (user, key) => { const r = D.get('SELECT n FROM v20_stats WHERE user_id = ? AND key = ?', uid(user), key); return r ? r.n : 0; };
function addStat(user, key, n = 1) { D.run('INSERT INTO v20_stats (user_id, key, n) VALUES (?,?,?) ON CONFLICT(user_id, key) DO UPDATE SET n = n + excluded.n', uid(user), key, int(n)); }
function maxStat(user, key, n) { D.run('INSERT INTO v20_stats (user_id, key, n) VALUES (?,?,?) ON CONFLICT(user_id, key) DO UPDATE SET n = MAX(n, excluded.n)', uid(user), key, int(n)); }

// ---------------------------------------------------------------- danh hiệu (chỉ là danh hiệu — không cộng chỉ số, không ảnh hưởng kinh tế)
const TITLES = [
  { id: 'dan_1', name: 'Dược Đồng', test: (s) => s.craft_dan >= 25, desc: 'Chế 25 mẻ đan.' },
  { id: 'dan_2', name: 'Đan Sư Danh Tiếng', test: (s) => s.craft_dan >= 300, desc: 'Chế 300 mẻ đan.' },
  { id: 'khi_1', name: 'Thợ Rèn Học Việc', test: (s) => s.craft_khi >= 25, desc: 'Chế 25 mẻ vật phẩm Luyện Khí.' },
  { id: 'khi_2', name: 'Khí Sư Bất Bại', test: (s) => s.craft_khi >= 300, desc: 'Chế 300 mẻ vật phẩm Luyện Khí.' },
  { id: 'tran_1', name: 'Trận Đồ Sinh', test: (s) => s.craft_tran >= 25, desc: 'Chế 25 mẻ Trận Pháp.' },
  { id: 'tran_2', name: 'Trận Đạo Tôn Giả', test: (s) => s.craft_tran >= 300, desc: 'Chế 300 mẻ Trận Pháp.' },
  { id: 'thuc_1', name: 'Nông Phu Linh Điền', test: (s) => s.harv >= 50, desc: 'Thu hoạch 50 cây.' },
  { id: 'thuc_2', name: 'Dược Viên Chủ', test: (s) => s.harv >= 500, desc: 'Thu hoạch 500 cây.' },
  { id: 'mine', name: 'Thợ Mỏ Kỳ Cựu', test: (s) => s.gather >= 100, desc: 'Hoàn thành 100 lượt khai thác.' },
  { id: 'order', name: 'Đại Chưởng Quầy', test: (s) => s.orders >= 30, desc: 'Hoàn thành 30 đơn hàng nghề nghiệp.' },
  { id: 'fire', name: 'Chưởng Hỏa Giả', test: (s) => s.fires >= 3, desc: 'Thu phục 3 ngọn Dị Hỏa.' },
  { id: 'stage', name: 'Siêu Thoát Chi Thủ', test: (s) => s.stage >= 10, desc: 'Chế thành công sản phẩm giai đoạn Siêu Thoát Cấp.' },
];
const TITLE_KEYS = ['craft_dan', 'craft_khi', 'craft_tran', 'harv', 'gather', 'orders', 'fires', 'stage'];
function titlesOf(user) { const own = new Set(D.all('SELECT title FROM v20_titles WHERE user_id = ?', uid(user)).map((r) => r.title)); return TITLES.map((t) => ({ ...t, done: own.has(t.id) })); }
function checkTitles(user) {
  const s = {}; for (const k of TITLE_KEYS) s[k] = stat(user, k);
  const out = [];
  for (const t of TITLES) {
    if (!t.test(s)) continue;
    if (D.run('INSERT OR IGNORE INTO v20_titles (user_id, title, at) VALUES (?,?,?)', uid(user), t.id, now()).changes) out.push(`🏷️ **Danh hiệu mới: ${t.name}**`);
  }
  return out.length ? `\n${out.join('\n')}` : '';
}

// ---------------------------------------------------------------- Sổ Tay
const PAGES = {
  nl: { label: 'Nguyên Liệu', test: (it) => ['LINH_DUOC', 'KHOANG_VAT', 'YEU_THU_TAI_LIEU', 'TRAN_DAO_TAI_LIEU', 'NGUYEN_LIEU_TRUNG_GIAN'].includes(it.cat) },
  dp: { label: 'Đan Phương', recipes: (r) => r.prof === 'dan' },
  bv: { label: 'Bản Vẽ', recipes: (r) => r.prof === 'khi' },
  td: { label: 'Trận Đồ', recipes: (r) => r.prof === 'tran' },
  lt: { label: 'Linh Thực', test: (it) => it.cat === 'LINH_THUC' || it.cat === 'LINH_DUOC' },
};
const stageOfItem = (id) => { const m = /^v20_(?:herb|seed|ore|beast|tran|kl|pk|hc|bv)_?(\d+)/.exec(id); return m ? int(m[1]) : 0; };
/** Danh sách trang Sổ Tay (đã lọc theo giai đoạn). Mỗi dòng: { id, name, stage, src[], use[] }. */
function itemRows(page, stage) {
  const P = PAGES[page]; const rows = [];
  for (const it of I.ITEMS) {
    if (!P.test || !P.test(it)) continue;
    const st = stageOfItem(it.id) || (it.id.startsWith('v20_') ? 0 : legacyStage(it));
    if (stage && st !== stage) continue;
    rows.push({ id: it.id, name: it.name, stage: st, rarity: it.rarity, src: Cat.sources(it.id).map((s) => Cat.srcLabel(s)), use: Cat.usages(it.id).map((u) => Cat.useLabel(u)) });
  }
  return rows;
}
const legacyStage = (it) => V.stageOfRealm ? Math.min(10, Math.max(1, it.rarity <= 1 ? 1 : it.rarity <= 2 ? 2 : it.rarity <= 3 ? 3 : it.rarity <= 4 ? 4 : 5)) : 1;
/** Công thức theo trang + giai đoạn; `learnedFn(r)` cho biết công thức thất truyền đã học chưa. */
function recipeRows(page, stage, user) {
  const P = PAGES[page]; const L = require('./learn20');
  return C.RECIPES.filter((r) => P.recipes(r) && (!stage || (r.stage || 1) === stage)).map((r) => ({
    id: r.id, name: r.name, stage: r.stage || 1, lv: r.lv, rare: !!r.rare, learned: !r.rare || L.learned(user, r.id), out: r.out.item,
  }));
}
module.exports = { stat, addStat, maxStat, TITLES, titlesOf, checkTitles, PAGES, itemRows, recipeRows, stageOfItem };
