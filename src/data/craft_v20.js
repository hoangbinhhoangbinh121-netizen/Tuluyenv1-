'use strict';
/**
 * V20.0 — CÔNG THỨC · LINH CHỦNG · BẢNG RƠI · KHU KHAI THÁC mở rộng, cắm vào data/craft_v17.js (install(ctx) chạy cuối craft_v17).
 * Nguyên tắc: không đổi công thức V17/V19; chỉ THÊM. Mọi công thức có nguyên liệu tồn tại + nguồn thật; sản phẩm có công dụng thật (đan→dan17, trận→tran17, trang bị→gear17).
 * Kinh tế: giá sản phẩm do catalog17 suy từ công thức ⇒ chế rồi bán NPC luôn lỗ; khai thác/đơn hàng có trần theo ngày.
 */
const V = require('./v20_data');
const { STAGES, ID } = V;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** Cấp nghề cũ → giai đoạn (để gán `stage` cho 100% công thức V17 mà không đổi dữ liệu cũ). */
const LV_STAGE = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5 };

function install(ctx) {
  const { R, RECIPES, PILLS, TRANS, GEAR, SEEDS, FIELD, DROPS, NPC_SHOP, ACH, SOURCE_NOTES, SLOT_KEYS } = ctx;
  const gold = (n, m = 1) => Math.round(150 * 2.9 ** (n - 1) * m);
  const time = (n, m = 1) => Math.round(240 * 1.45 ** (n - 1) * m);
  const exp = (n, m = 1) => Math.round(8 * 2 ** (n - 1) * m);
  const rate = (n, pen = 0) => clamp(0.93 - 0.035 * (n - 1) - pen, 0.55, 0.95);
  const S = (n) => V.stage(n);
  const base = (n, extra = {}) => ({ stage: n, realm: S(n).band[0], ...extra });
  const dd = (n) => ID.dd(n); const hA = (n) => ID.herb(n, 'a'); const hB = (n) => ID.herb(n, 'b'); const oA = (n) => ID.ore(n, 'a'); const oB = (n) => ID.ore(n, 'b'); const bs = (n) => ID.beast(n);

  // ---------------------------------------------------------------- bán thành phẩm 10 giai đoạn
  for (const st of STAGES) {
    const n = st.n; const lv = st.lv;
    R(`rc20_kl_${n}`, 'khi', lv, `Chế ${V.KL[n - 1]}`, { [oA(n)]: 3, [oB(n)]: 1, [bs(n)]: 1 }, [ID.kl(n), 2], { gold: gold(n, 1.2), time: time(n, 0.6), rate: rate(n, -0.03), exp: exp(n, 0.8), ...base(n) });
    R(`rc20_pk_${n}`, 'khi', lv, `Đúc ${V.PK[n - 1]}`, { [ID.kl(n)]: 2, [bs(n)]: 1 }, [ID.pk(n), 1], { gold: gold(n, 1.5), time: time(n, 0.8), rate: rate(n), exp: exp(n), ...base(n) });
  }
  // Trận Văn mới (Tiên Văn → Siêu Thoát Văn) + công thức thay thế dùng vật liệu trận đạo V20 cho Sơ/Trung/Cao
  for (let n = 6; n <= 10; n += 1) R(`rc20_tv_${n}`, 'tran', S(n).lv, `Khắc ${['Tiên Văn', 'Thần Văn', 'Đế Văn', 'Thiên Đạo Văn', 'Siêu Thoát Văn'][n - 6]}`, { [ID.tran(n)]: 2, [oB(n)]: 1 }, [ID.tv(n), 2], { gold: gold(n, 1.3), time: time(n, 0.6), rate: rate(n, -0.02), exp: exp(n, 0.9), ...base(n) });
  R('rc20_tv_so', 'tran', 1, 'Khắc Trận Văn Sơ Cấp (vật liệu Phàm Văn)', { [ID.tran(1)]: 3 }, ['tv_so', 2], { gold: 150, time: 90, rate: 0.95, exp: 6, stage: 1 });
  R('rc20_tv_trung', 'tran', 3, 'Khắc Trận Văn Trung Cấp (vật liệu Linh/Huyền Văn)', { [ID.tran(2)]: 2, [ID.tran(3)]: 1 }, ['tv_trung', 2], { gold: 2000, time: 240, rate: 0.9, exp: 45, stage: 2 });
  R('rc20_tv_cao', 'tran', 5, 'Khắc Trận Văn Cao Cấp (vật liệu Địa/Thiên Văn)', { [ID.tran(4)]: 2, [ID.tran(5)]: 1 }, ['tv_cao', 2], { gold: 15000, time: 480, rate: 0.88, exp: 150, stage: 4 });
  // Dược Dịch mở rộng
  R('rc20_dd_than', 'dan', 6, 'Dược Dịch Thần', { dd_tien: 2, [hA(6)]: 2, [hB(6)]: 1, lt_linh_tuyen_thuy: 2 }, ['dd_than', 1], { gold: gold(6, 1.5), time: time(6, 0.7), rate: rate(6, -0.02), exp: exp(6, 0.8), ...base(6) });
  R('rc20_dd_de', 'dan', 8, 'Dược Dịch Đế', { dd_than: 2, [hA(8)]: 2, [hB(8)]: 1, lt_linh_tuyen_thuy: 3 }, ['dd_de', 1], { gold: gold(8, 1.5), time: time(8, 0.7), rate: rate(8, -0.02), exp: exp(8, 0.8), ...base(8) });
  R('rc20_dd_sieuthoat', 'dan', 9, 'Dược Dịch Siêu Thoát', { dd_de: 2, [hA(10)]: 2, [hB(10)]: 1, lt_linh_tuyen_thuy: 4 }, ['dd_sieuthoat', 1], { gold: gold(10, 1.5), time: time(10, 0.7), rate: rate(10, -0.02), exp: exp(10, 0.8), ...base(10) });

  // ---------------------------------------------------------------- đan dược (11 nhóm × 10 giai đoạn)
  const ING = {
    hp: (n) => ({ [dd(n)]: 1, [hA(n)]: 2, [bs(n)]: 1 }), tu: (n) => ({ [dd(n)]: 1, [hA(n)]: 2, [bs(n)]: 1 }), pha: (n) => ({ [dd(n)]: 1, [hB(n)]: 2, [bs(n)]: 1 }),
    tam: (n) => ({ [dd(n)]: 1, [hA(n)]: 1, [hB(n)]: 1, [bs(n)]: 1 }), attr: (n) => ({ [dd(n)]: 1, [hA(n)]: 1, [hB(n)]: 1, [oA(n)]: 1 }), ban: (n) => ({ [dd(n)]: 1, [hB(n)]: 2, [bs(n)]: 1, [oB(n)]: 1 }),
    kiep: (n) => ({ [dd(n)]: 2, [hA(n)]: 1, [hB(n)]: 1, [bs(n)]: 1 }), tg: (n) => ({ [dd(n)]: 2, [hA(n)]: 2, [hB(n)]: 2, [bs(n)]: 2 }), dc: (n) => ({ [dd(n)]: 2, [hA(n)]: 2, [hB(n)]: 2, [bs(n)]: 2 }),
    st: (n) => ({ [dd(n)]: 2, [hA(n)]: 2, [hB(n)]: 2, [bs(n)]: 2 }), tt: (n) => ({ [dd(n)]: 2, [hA(n)]: 2, [hB(n)]: 2, [bs(n)]: 2, [oB(n)]: 1 }),
  };
  const PEN = { hp: -0.02, tu: 0, pha: 0.04, tam: 0.02, attr: 0, ban: 0.03, kiep: 0.06, tg: 0.05, dc: 0.06, st: 0.08, tt: 0.12 };
  const TM = { hp: 0.8, tu: 1, pha: 1.4, tam: 1.1, attr: 1, ban: 1.3, kiep: 1.8, tg: 1.6, dc: 1.8, st: 2, tt: 2.2 };
  const GM = { hp: 0.8, tu: 1, pha: 1.5, tam: 1.1, attr: 1, ban: 1.4, kiep: 2, tg: 1.8, dc: 2, st: 2.5, tt: 3 };
  for (const p of V.pillSpecs()) {
    const n = p.stage; PILLS[p.id] = { ...p.pill };
    const rid = `rc20_${p.id.slice(4)}`;
    R(rid, 'dan', S(n).lv, p.name, ING[p.type](n), [p.id, 1], { gold: gold(n, GM[p.type]), time: time(n, TM[p.type]), rate: rate(n, PEN[p.type]), exp: exp(n, TM[p.type]), q: true, fail: 0.5, rare: !!p.rare, ...base(n) });
  }

  // ---------------------------------------------------------------- trận pháp mới (thất truyền)
  for (const t of V.TRAN_SPECS) {
    const n = t.stage; TRANS[t.id] = { dur: t.dur, upkeep: t.upkeep, fx: t.fx, daily: t.daily, ...(t.charges ? { charges: t.charges } : {}), ...(t.sect ? { sect: true } : {}) };
    R(`rc20_${t.id}`, 'tran', S(n).lv, t.name, { [ID.tv(n)]: 2, [ID.tran(n)]: 2, [bs(n)]: 1, [oA(n)]: 1 }, [t.id, 1], { gold: gold(n, 2.5), time: time(n, 2), rate: rate(n, 0.1), exp: exp(n, 2), q: true, rare: true, ...base(n) });
  }

  // ---------------------------------------------------------------- trang bị Tiên Cấp → Siêu Thoát Cấp (7 ô × 5)
  for (const g of V.gearSpecs()) {
    const n = g.tier; const k = n - 5;
    GEAR[g.id] = { name: g.name, slot: g.slot, tier: g.tier, pri: g.pri, secPool: g.secPool, dur: g.dur, realm: g.realm };
    R(`rc20_${g.id}`, 'khi', S(n).lv, g.name, { [ID.pk(n)]: 1, [oB(n)]: 2, [bs(n)]: 2, [ID.bv(n)]: 1, tdc_khi_linh_hach: 2 }, [g.id, 1], { gold: gold(n, 4), time: time(n, 2.5), rate: rate(n, 0.04 + 0.01 * k), exp: exp(n, 2.5), q: true, kind: 'gear', fail: 0.4, ...base(n) });
  }

  // Công thức THAY THẾ cho 8 trang bị V17 bằng Phôi Khí V20 (cùng sản phẩm; công thức gốc vẫn nguyên)
  for (const [gid, g] of Object.entries(GEAR)) {
    if (g.tier > 5) continue; const orig = ctx.RBY[`rc_${gid}`]; if (!orig) continue; const t = g.tier;
    R(`rc20_alt_${gid}`, 'khi', orig.lv, `${g.name} (phôi V20)`, { [ID.pk(t)]: 1, [oB(t)]: 2, [bs(t)]: 2 }, [gid, 1], { gold: Math.round(orig.gold * 1.2), time: orig.time, rate: orig.rate, exp: orig.exp, q: true, kind: 'gear', fail: 0.4, realm: orig.realm, stage: LV_STAGE[orig.lv] || 1 });
  }

  // ---------------------------------------------------------------- Linh Chủng 10 giai đoạn + Linh Điền mở rộng
  for (const st of STAGES) {
    const n = st.n; const fl = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9][n - 1];
    const nextA = n < 10 ? hA(n + 1) : hA(10);
    SEEDS[ID.seed(n, 'a')] = { crop: hA(n), time: Math.round(3600 * 1.5 ** (n - 1)), yield: [3, 5], plv: st.lv, fieldLv: fl, stage: n, mut: { to: hB(n), p: 0.05, qty: 1 }, exp: Math.round(6 * 2.2 ** (n - 1)) };
    SEEDS[ID.seed(n, 'b')] = { crop: hB(n), time: Math.round(7200 * 1.5 ** (n - 1)), yield: [2, 4], plv: st.lv, fieldLv: fl, stage: n, mut: { to: nextA, p: 0.02, qty: 1 }, exp: Math.round(12 * 2.2 ** (n - 1)) };
  }
  FIELD.names = ['Linh Điền', 'Linh Điền', 'Linh Điền', 'Linh Điền', 'Linh Điền', 'Linh Điền Nâng Cao', 'Tiên Điền', 'Thần Điền', 'Đế Điền', 'Hỗn Độn Dược Viên'];
  const up = (plots, g, plv, mat) => ({ plots, up: { gold: g, plv, mat: { lt_linh_tho: 80, lt_linh_tuyen_thuy: 40, ...mat } } });
  FIELD.levels.push(
    up(7, 5e7, 6, { [hB(5)]: 6, tdc_moc_nguyen_tinh: 3 }),
    up(8, 3e8, 7, { [hA(6)]: 6, [hB(6)]: 6, tdc_moc_nguyen_tinh: 5 }),
    up(9, 2e9, 8, { [hA(7)]: 8, [hB(7)]: 8, tdc_moc_nguyen_tinh: 8 }),
    up(10, 1.5e10, 9, { [hA(8)]: 8, [hB(8)]: 8, tdc_hon_don_nguyen_khi: 1 }),
    up(12, 1e11, 9, { [hA(9)]: 10, [hB(9)]: 10, tdc_hon_don_nguyen_khi: 2, ld_hon_nguyen_dao_qua: 1 }),
  );
  // NPC bán nguyên liệu cơ bản giai đoạn Phàm/Linh (giá mua 1,5× giá trị, giới hạn ngày) + thu mua đã có ở npc17
  Object.assign(NPC_SHOP, { [ID.seed(1, 'a')]: 40, [ID.seed(1, 'b')]: 20, [ID.seed(2, 'a')]: 12, [ID.herb(1, 'a')]: 30, [ID.ore(1, 'a')]: 40, [ID.tran(1)]: 40, [ID.beast(1)]: 12 });

  // ---------------------------------------------------------------- KHAI THÁC (khu mỏ / khu thu thập) — bảng rơi nằm trong DROPS để catalog17 thấy NGUỒN
  const ZONES = [];
  const zone = (id, kind, name, icon, stages, o = {}) => {
    const s0 = stages[0]; const sm = stages[stages.length - 1];
    const rolls = [];
    for (const n of stages) {
      const f = kind === 'kk' ? [[oA(n), 1, 2, 4], [oB(n), 0.55, 1, 2], [ID.tran(n), 0.18, 1, 1]] : [[hA(n), 1, 2, 4], [hB(n), 0.55, 1, 2], [ID.seed(n, 'a'), 0.07, 1, 1], [ID.seed(n, 'b'), 0.04, 1, 1]];
      for (const r of f) rolls.push(r);
      if (kind === 'tt') rolls.push([ID.beast(n), 0.10, 1, 1]);
    }
    for (const r of (o.extra || [])) rolls.push(r);
    const z = { id, kind, name, icon, stages, realm: S(s0).band[0], dur: Math.round(300 * 1.5 ** (s0 - 1)), daily: o.daily || (sm <= 3 ? 4 : sm <= 6 ? 3 : 2), gold: o.gold || 0, label: `Khai thác — ${name}`, ltBase: Math.round(S(sm).base * 10), rolls };
    ZONES.push(z); DROPS[`kt20_${id}`] = { label: z.label, ltBase: z.ltBase, rolls }; SOURCE_NOTES[`kt20_${id}`] = 'game/khaithac20.js · collect';
  };
  zone('kk1', 'kk', 'Mỏ Khoáng Vật', '⛏️', [1, 2]);
  zone('kk2', 'kk', 'Mỏ Linh Thạch', '💎', [2, 3], { gold: 40000, extra: [['kv_huyen_tinh', 0.3, 1, 2], ['kv_tu_kim_thach', 0.05, 1, 1]] });
  zone('kk3', 'kk', 'Mỏ Tiên Kim', '🥇', [5, 6], { extra: [['kv_tien_kim', 0.04, 1, 1, { cap: 1 }], ['kv_tien_ngoc', 0.04, 1, 1, { cap: 1 }]] });
  zone('kk4', 'kk', 'Mỏ Thần Tinh', '🔷', [7, 8]);
  zone('kk5', 'kk', 'Mỏ Hỗn Độn', '🌑', [9, 10]);
  const special = [];
  for (let n = 6; n <= 10; n += 1) special.push([ID.bv(n), 0.035, 1, 1, { cap: 1 }]);
  for (let n = 1; n <= 10; n += 1) special.push([ID.hoachung(n), n <= 5 ? 0.02 : 0.012, 1, 1, { cap: 1, week: 1 }]);
  for (const p of V.pillSpecs().filter((x) => x.rare)) special.push([ID.scroll(p.id), 0.008, 1, 1, { cap: 1, week: 1 }]);
  for (const t of V.TRAN_SPECS) special.push([ID.scroll(t.id), 0.008, 1, 1, { cap: 1, week: 1 }]);
  zone('kk6', 'kk', 'Mỏ Tài Nguyên Đặc Biệt', '🔮', [5, 6, 7], { daily: 2, extra: special });
  zone('tt1', 'tt', 'Sơn Mạch', '⛰️', [1, 2]);
  zone('tt2', 'tt', 'Linh Cốc', '🌾', [2, 3]);
  zone('tt3', 'tt', 'Dược Viên', '🌿', [3, 4]);
  zone('tt4', 'tt', 'Cổ Lâm', '🌲', [4, 5]);
  zone('tt5', 'tt', 'Tiên Dược Viên', '🌸', [6, 7]);
  zone('tt6', 'tt', 'Thần Dược Cấm Địa', '☯️', [8, 9, 10]);

  // ---------------------------------------------------------------- bổ sung nguyên liệu mới vào bảng rơi hiện có (không đổi mục cũ) + nguồn mới Bí Cảnh Tiên Giới / Boss sự kiện
  const addRolls = (src, arr) => { if (DROPS[src]) DROPS[src].rolls.push(...arr); };
  const stuff = (n, p) => [[bs(n), p, 1, 1], [oA(n), p, 1, 2], [hA(n), p * 0.8, 1, 2], [ID.tran(n), p * 0.6, 1, 1]];
  addRolls('bc0', stuff(1, 0.12)); addRolls('bc1', stuff(2, 0.12)); addRolls('bc2', stuff(3, 0.10)); addRolls('vlc', [...stuff(4, 0.10), [ID.seed(3, 'a'), 0.02, 1, 1]]);
  addRolls('vlc_boss', [[bs(4), 0.3, 1, 2], [oB(4), 0.2, 1, 1]]); addRolls('bc_nhan', stuff(3, 0.12)); addRolls('bc_linh', stuff(5, 0.10));
  addRolls('chain_luyenhu', stuff(4, 0.12)); addRolls('chain_hopthe', stuff(5, 0.10)); addRolls('chain_daithua', stuff(5, 0.12)); addRolls('chain_dokiep', stuff(5, 0.14));
  addRolls('boss_lo', [[bs(2), 0.35, 1, 2], [bs(3), 0.15, 1, 1]]); addRolls('boss_mid', [[bs(4), 0.35, 1, 2], [oB(4), 0.2, 1, 1], [ID.hoachung(3), 0.01, 1, 1, { cap: 1, week: 1 }]]);
  addRolls('boss_hi', [[bs(5), 0.35, 1, 2], [oB(5), 0.2, 1, 1], [ID.hoachung(5), 0.01, 1, 1, { cap: 1, week: 1 }]]);
  addRolls('linhthu_lo', [[bs(1), 0.10, 1, 1], [bs(2), 0.06, 1, 1]]); addRolls('linhthu_hi', [[bs(3), 0.08, 1, 1], [bs(4), 0.06, 1, 1]]);
  addRolls('event', [[ID.bv(6), 0.02, 1, 1, { cap: 1 }], [ID.hoachung(4), 0.01, 1, 1, { cap: 1, week: 1 }]]);
  addRolls('sectwar_win', [[ID.bv(6), 0.03, 1, 1, { cap: 1 }], [bs(5), 0.4, 1, 2]]);
  for (let n = 6; n <= 10; n += 1) {
    const src = `v20_bc19_s${n}`; const rolls = [[bs(n), 0.45, 1, 2], [oA(n), 0.35, 1, 2], [oB(n), 0.2, 1, 1], [hA(n), 0.25, 1, 2], [hB(n), 0.12, 1, 1], [ID.tran(n), 0.2, 1, 1], [ID.bv(n), 0.02, 1, 1, { cap: 1 }], [ID.hoachung(n), 0.006, 1, 1, { cap: 1, week: 1 }]];
    DROPS[src] = { label: `Bí Cảnh Tiên Giới (${S(n).name})`, ltBase: Math.round(S(n).base * 12), rolls }; SOURCE_NOTES[src] = 'game/bicanh19.js · rollMember → drops17';
  }
  DROPS.v20_event = { label: 'Đế Cảnh Xuất Thế / Siêu Thoát (nguyên liệu nghề)', ltBase: Math.round(S(9).base * 12), rolls: [[bs(9), 0.5, 1, 2], [bs(10), 0.3, 1, 2], [oB(9), 0.3, 1, 2], [oB(10), 0.25, 1, 1], [ID.bv(9), 0.05, 1, 1, { cap: 1 }], [ID.bv(10), 0.04, 1, 1, { cap: 1 }], [ID.hoachung(9), 0.03, 1, 1, { cap: 1, week: 1 }], [ID.hoachung(10), 0.02, 1, 1, { cap: 1, week: 1 }]] };
  SOURCE_NOTES.v20_event = 'game/event19.js · settle → drops17';

  // ---------------------------------------------------------------- thành tựu theo giai đoạn (4 nghề × 9)
  for (const prof of Object.keys(ACH)) {
    for (let n = 2; n <= 10; n += 1) {
      ACH[prof].push({ id: `${prof}_s${n}`, name: `Bước vào ${S(n).name}`, desc: prof === 'thuc' ? `Thu hoạch một cây ở giai đoạn ${S(n).name}.` : `Chế thành công một sản phẩm ở giai đoạn ${S(n).name}.`, test: (s) => (s.extra.stage || 0) >= n, lt: Math.round(4000 * 3 ** (n - 1)), ...(n >= 5 ? { items: { tdc_khi_linh_hach: 1 } } : {}) });
    }
  }

  // ---------------------------------------------------------------- gán giai đoạn cho MỌI công thức cũ
  for (const r of RECIPES) if (!r.stage) r.stage = LV_STAGE[r.lv] || 1;
  const stageOfRecipe = (r) => r.stage || LV_STAGE[r.lv] || 1;
  return { ZONES, STAGES, stageOfRecipe, LV_STAGE, V20_PILLS: V.pillSpecs() };
}

module.exports = { install, LV_STAGE };
