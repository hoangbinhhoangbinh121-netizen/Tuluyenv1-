'use strict';
/**
 * LINH ĐIỀN v17 (Linh Thực Sư) — mở ruộng · nâng cấp · gieo Linh Chủng · tưới · bón · thu hoạch (biến dị, héo, thu hồi hạt giống).
 *  • Thu hoạch đi THẲNG vào Inventory Service. Mọi thao tác trừ/ghi nằm trong 1 transaction; thu hoạch chốt bằng DELETE có điều kiện nên bấm dồn không nhân đôi.
 *  • Giới hạn: số ô theo cấp ruộng · tối đa 3 lần tưới/ô (cách nhau 20 phút) · 1 loại phân/ô · mỗi hạt chỉ cho 2–5 Linh Dược nên không thể làm giàu vô hạn
 *    (giá hạt + phí gieo luôn ≥ giá NPC thu mua sản lượng — xem test_economy_v17).
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const X = require('./craft17');
const { I, C } = Cat;
const { now, int, random, randInt, fmtNum } = require('../util');
const { Delta } = Cu;
const F = C.FIELD;
const fmtT = (s) => require('./format').fmtTime(s);
const uid = (u) => String(u);

const field = (user) => D.get('SELECT * FROM linh_dien WHERE user_id = ?', uid(user));
const plotsOf = (user) => D.all('SELECT * FROM linh_dien_plot WHERE user_id = ? ORDER BY slot', uid(user));
const plotCount = (lv) => F.levels[Math.min(F.levels.length, Math.max(1, lv)) - 1].plots;
const tf = (user) => X.techFx(user, 'thuc');
const profLv = (user) => X.state(user, 'thuc').level;

/** Thời gian sinh trưởng thật của 1 hạt cho người này (đã trừ kỹ thuật). */
const growTime = (user, seed) => Math.round(C.SEEDS[seed].time * (1 - Math.min(0.4, tf(user).grow || 0)));
const seedInfo = (user, seed) => {
  const s = C.SEEDS[seed]; const t = tf(user); const crop = I.BY_ID[s.crop];
  const yAvg = (s.yield[0] + s.yield[1]) / 2 + (t.yield || 0);
  return { ...s, seed, cropName: crop.name, growSec: growTime(user, seed), yAvg, seedBack: Math.min(0.9, F.seedBack + (t.seed || 0)), mutP: s.mut.p + (t.mut || 0), mutName: I.BY_ID[s.mut.to].name };
};

function status(user) {
  const f = field(user); const ps = plotsOf(user); const t = now();
  return { f, plots: ps.map((p) => ({ ...p, ready: p.ready_at <= t, left: Math.max(0, p.ready_at - t), withered: p.ready_at + F.wither < t })), max: f ? plotCount(f.level) : 0, lv: profLv(user) };
}

function open(user) {
  return D.transaction(() => {
    if (field(user)) return { ok: false, msg: 'Bạn đã có Linh Điền rồi.' };
    const me = Cu.getCultivator(user); const plv = profLv(user);
    if (plv < F.open.plv) return { ok: false, msg: `Cần Linh Thực Sư cấp **${C.LEVELS[F.open.plv - 1].name}** để mở Linh Điền.` };
    if (me.linh_thach < F.open.gold) return { ok: false, msg: `Cần ${fmtNum(F.open.gold)} Linh Thạch (hiện có ${fmtNum(me.linh_thach)}).` };
    const miss = Inv.missing(user, F.open.mat); if (miss.length) return { ok: false, msg: `Thiếu ${miss.map((m) => `${m.need - m.have} × ${I.BY_ID[m.id].name}`).join(', ')}.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-F.open.gold) }, { linh_thach: F.open.gold })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    Inv.takeMany(user, F.open.mat, 'mở Linh Điền');
    D.run('INSERT INTO linh_dien (user_id, level, created_at) VALUES (?,1,?)', uid(user), now());
    X.bumpExtra(user, 'thuc', 'fieldLv', 1, 'max');
    return { ok: true, msg: `🌱 Đã khai khẩn **Linh Điền** (${plotCount(1)} ô). Mua **Linh Chủng** ở NPC hoặc nhặt ở Bí Cảnh để gieo.` };
  });
}
function upgrade(user) {
  return D.transaction(() => {
    const f = field(user); if (!f) return { ok: false, msg: 'Bạn chưa mở Linh Điền.' };
    const nx = F.levels[f.level]; if (!nx) return { ok: false, msg: 'Linh Điền đã đạt cấp tối đa.' };
    const u = nx.up; const me = Cu.getCultivator(user);
    if (profLv(user) < u.plv) return { ok: false, msg: `Cần Linh Thực Sư cấp **${C.LEVELS[u.plv - 1].name}**.` };
    if (me.linh_thach < u.gold) return { ok: false, msg: `Cần ${fmtNum(u.gold)} Linh Thạch.` };
    const miss = Inv.missing(user, u.mat); if (miss.length) return { ok: false, msg: `Thiếu ${miss.map((m) => `${m.need - m.have} × ${I.BY_ID[m.id].name}`).join(', ')}.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-u.gold) }, { linh_thach: u.gold })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    Inv.takeMany(user, u.mat, 'nâng Linh Điền');
    D.run('UPDATE linh_dien SET level = level + 1 WHERE user_id = ? AND level = ?', uid(user), f.level);
    X.bumpExtra(user, 'thuc', 'fieldLv', f.level + 1, 'max'); X.addExp(user, 'thuc', 20 * (f.level + 1)); X.checkAch(user, 'thuc');
    return { ok: true, msg: `⬆️ Linh Điền lên **cấp ${f.level + 1}** — ${nx.plots} ô.` };
  });
}
function plant(user, slot, seed) {
  slot = int(slot); const s = C.SEEDS[seed]; if (!s) return { ok: false, msg: 'Không phải Linh Chủng.' };
  return D.transaction(() => {
    const f = field(user); if (!f) return { ok: false, msg: 'Bạn chưa mở Linh Điền.' };
    if (slot < 1 || slot > plotCount(f.level)) return { ok: false, msg: 'Ô đất không hợp lệ.' };
    if (D.get('SELECT 1 AS x FROM linh_dien_plot WHERE user_id = ? AND slot = ?', uid(user), slot)) return { ok: false, msg: `Ô ${slot} đang có cây — thu hoạch trước.` };
    if (profLv(user) < s.plv) return { ok: false, msg: `Cần Linh Thực Sư cấp **${C.LEVELS[s.plv - 1].name}** để gieo ${I.BY_ID[seed].name}.` };
    const me = Cu.getCultivator(user);
    if (me.linh_thach < F.plantGold) return { ok: false, msg: `Cần ${F.plantGold} Linh Thạch phí gieo.` };
    if (Inv.qty(user, F.soilMat) < 1) return { ok: false, msg: `Cần 1 ${I.BY_ID[F.soilMat].name} cho mỗi lần gieo.` };
    if (!Inv.takeMany(user, { [seed]: 1, [F.soilMat]: 1 }, 'gieo')) return { ok: false, msg: `Bạn không có ${I.BY_ID[seed].name}.` };
    if (!Cu.updateCultivator(user, { linh_thach: new Delta(-F.plantGold) }, { linh_thach: F.plantGold })) throw new Error('hết Linh Thạch giữa chừng');
    const t = now(); const g = growTime(user, seed);
    D.run('INSERT INTO linh_dien_plot (user_id, slot, seed, planted_at, ready_at, total, water, last_water, fert) VALUES (?,?,?,?,?,?,0,0,?)', uid(user), slot, seed, t, t + g, g, '');
    return { ok: true, msg: `🌱 Gieo **${I.BY_ID[seed].name}** vào ô ${slot} — chín sau **${fmtT(g)}**.` };
  });
}
function water(user, slot) {
  slot = int(slot);
  return D.transaction(() => {
    const p = D.get('SELECT * FROM linh_dien_plot WHERE user_id = ? AND slot = ?', uid(user), slot); if (!p) return { ok: false, msg: 'Ô này đang trống.' };
    const t = now(); if (p.ready_at <= t) return { ok: false, msg: 'Cây đã chín — thu hoạch thôi.' };
    if (p.water >= F.waterMax) return { ok: false, msg: `Mỗi ô chỉ tưới tối đa ${F.waterMax} lần.` };
    if (t - p.last_water < F.waterCd) return { ok: false, msg: `Mới tưới xong — chờ **${fmtT(F.waterCd - (t - p.last_water))}** nữa.` };
    if (!Inv.take(user, F.waterMat, 1, { why: 'tưới' })) return { ok: false, msg: `Cần 1 ${I.BY_ID[F.waterMat].name}.` };
    const cut = Math.round(p.total * F.waterCut);
    D.run('UPDATE linh_dien_plot SET ready_at = MAX(?, ready_at - ?), water = water + 1, last_water = ? WHERE user_id = ? AND slot = ? AND water = ?', t, cut, t, uid(user), slot, p.water);
    return { ok: true, msg: `💧 Tưới ô ${slot} (${p.water + 1}/${F.waterMax}) — rút **${fmtT(cut)}**.` };
  });
}
function fertilize(user, slot, kind) {
  slot = int(slot); const item = kind === 'duong_mach' ? 'lt_duong_mach_dich' : 'lt_thuc_sinh_dich';
  return D.transaction(() => {
    const p = D.get('SELECT * FROM linh_dien_plot WHERE user_id = ? AND slot = ?', uid(user), slot); if (!p) return { ok: false, msg: 'Ô này đang trống.' };
    if (p.fert) return { ok: false, msg: 'Ô này đã được bón phân rồi (mỗi ô một loại).' };
    const t = now(); if (kind !== 'duong_mach' && p.ready_at <= t) return { ok: false, msg: 'Cây đã chín — không cần bón thúc nữa.' };
    if (!Inv.take(user, item, 1, { why: 'bón' })) return { ok: false, msg: `Cần 1 ${I.BY_ID[item].name}.` };
    if (kind === 'duong_mach') { D.run("UPDATE linh_dien_plot SET fert = 'duong_mach' WHERE user_id = ? AND slot = ? AND fert = ''", uid(user), slot); return { ok: true, msg: `🧪 Bón **Dưỡng Mạch Dịch** cho ô ${slot}: tăng xác suất biến dị và mùa vụ tốt hơn.` }; }
    const cut = Math.round(Math.max(0, p.ready_at - t) * F.thucSinhCut);
    D.run("UPDATE linh_dien_plot SET fert = 'thuc_sinh', ready_at = ready_at - ? WHERE user_id = ? AND slot = ? AND fert = ''", cut, uid(user), slot);
    return { ok: true, msg: `🧪 Bón **Thúc Sinh Dịch** cho ô ${slot}: rút **${fmtT(cut)}**.` };
  });
}
function harvest(user, slot) {
  slot = int(slot);
  return D.transaction(() => {
    const p = D.get('SELECT * FROM linh_dien_plot WHERE user_id = ? AND slot = ?', uid(user), slot); if (!p) return { ok: false, msg: 'Ô này đang trống.' };
    const t = now(); if (p.ready_at > t) return { ok: false, msg: `⏳ Chưa chín — còn **${fmtT(p.ready_at - t)}**.` };
    if (D.run('DELETE FROM linh_dien_plot WHERE user_id = ? AND slot = ? AND seed = ? AND planted_at = ?', uid(user), slot, p.seed, p.planted_at).changes === 0) return { ok: false, msg: 'Ô này vừa được thu hoạch.' };
    const s = C.SEEDS[p.seed]; const T = tf(user); const wither = p.ready_at + F.wither < t;
    // mùa vụ: nước + phân → phẩm cấp mùa (1..3) cộng sản lượng
    const score = p.water + (p.fert === 'duong_mach' ? 2 : 0) + (profLv(user) >= 5 ? 1 : 0);
    const tier = score >= 5 ? 3 : score >= 3 ? 2 : 1; const tName = ['', 'Thường', 'Tốt', 'Đại Phong'][tier];
    let n = randInt(s.yield[0], s.yield[1]) + int(T.yield || 0) + (random() < ((T.yield || 0) % 1) ? 1 : 0);
    n = Math.max(1, Math.round(n * (1 + 0.12 * (tier - 1))));
    if (wither) n = Math.max(1, Math.floor(n * 0.5));
    const got = {}; got[s.crop] = n;
    let mut = false;
    if (!wither && random() < s.mut.p + (T.mut || 0) + (p.fert === 'duong_mach' ? F.duongMachMut : 0)) { got[s.mut.to] = (got[s.mut.to] || 0) + s.mut.qty; mut = true; }
    const back = random() < Math.min(0.9, F.seedBack + (T.seed || 0));
    if (back) got[p.seed] = 1;
    const real = Inv.addMany(user, got, 'thu hoạch Linh Điền');
    const gain = X.addExp(user, 'thuc', Math.round(s.exp * (mut ? 1.6 : 1) * (wither ? 0.5 : 1)));
    D.run('UPDATE prof_state SET crafts = crafts + 1, successes = successes + 1 WHERE user_id = ? AND prof_id = ?', uid(user), 'thuc');
    X.bumpExtra(user, 'thuc', 'harvests', 1); if (mut) X.bumpExtra(user, 'thuc', 'mutations', 1);
    const ach = X.checkAch(user, 'thuc');
    const txt = Object.entries(real).map(([k, v]) => `${v} × ${I.BY_ID[k].name}`).join(', ');
    return { ok: true, mut, wither, msg: `🧺 Thu hoạch ô ${slot} (mùa **${tName}**${wither ? ', héo −50%' : ''}): ${txt}${mut ? ' ✨ **Biến dị!**' : ''}\n📈 +${fmtNum(gain)} EXP Linh Thực Sư${ach}` };
  });
}
function harvestAll(user) {
  const out = []; for (const p of plotsOf(user)) if (p.ready_at <= now()) { const r = harvest(user, p.slot); if (r.ok) out.push(r.msg); } return out;
}

module.exports = { field, plotsOf, plotCount, status, seedInfo, growTime, open, upgrade, plant, water, fertilize, harvest, harvestAll };
