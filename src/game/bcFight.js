'use strict';
/**
 * BÍ CẢNH NHÂN GIỚI · LINH GIỚI = TRẬN CHIẾN ĐẤU THẬT (V22.4.2).
 *
 *  Không viết lại hệ thống chiến đấu: mỗi lần khám phá tạo 1 "profile" (danh sách đợt quái, độ khó, tên Boss…) rồi chạy trên CHÍNH lõi
 *  Bí Cảnh Tiên Giới (game/bicanh19.js: newState / step / AI quái…) và CHÍNH vỏ DB của nó (bảng bc19_runs, nút `b19|r|…`, /bicanhtiengioi → Tiếp tục).
 *  Trận lưu trong bc19_runs.state (JSON, có `prof`) ⇒ khởi động lại bot không mất; bc_idx ảo ≥ 100 để không lẫn với 19 bí cảnh Tiên Giới.
 *
 *  Quy tắc kinh tế (spec §V):
 *   • VÀO trận: kiểm tra điều kiện như cũ, GHI hồi chiêu (last_bicanh / last_bicanh_linhgioi) và TRỪ Vé Bí Cảnh Đặc Biệt ngay → thua / bỏ trận vẫn mất lượt, không spam được.
 *   • THẮNG: gọi lại đúng hàm phần thưởng cũ (game/bicanh.js doBicanh / doBicanhDacBiet / doBicanhLinhgioi với opts.paid) → bảng rơi, Tu Vi, Linh Thạch,
 *     nguyên liệu, công pháp, Linh/Tiên Phù, tiến trình, Lĩnh Ngộ, Thượng Cổ… GIỮ NGUYÊN 100%. Phần thưởng chỉ trao 1 lần (st.paid).
 *   • THUA / rút lui: KHÔNG có thưởng.
 *  Trận đơn (solo) — giống cách Bí Cảnh Nhân/Linh Giới vốn tính theo cá nhân (hồi chiêu / Vé riêng từng người). Lõi vẫn hỗ trợ đội 2–5 người (đã kiểm thử ở cấp lõi).
 *  Công tắc khẩn cấp: ST `bcfight` = off → quay về khám phá tức thì như V22.4.1.
 */
const D = require('../db');
const K = require('./constants');
const Cu = require('./cultivator');
const BC = require('./bicanh19');
const BD = require('../data/bicanh19');
const BI = require('./bicanh');
const ST = require('./settings');
const { now, randInt, random } = require('../util');

const enabled = () => String(ST.get('bcfight', 'on')) !== 'off';
const VIRT = { std: 100, db: 110, lg: 120 };          // bc_idx ảo trong bc19_runs
const isVirt = (idx) => Number(idx) >= 100;

// ---- đường cong sức mạnh (so với Boss Tiên Giới: hp ×10–20, atk ×1–1,6): HP mỗi loại tính theo Công Kích người chơi, sát thương theo Sinh Mệnh người chơi
const HP_K = { normal: 1.0, elite: 0.90, mini: 0.50, guard: 0.38, final: 0.30 };
const ATK_K = { normal: 2.0, elite: 2.0, mini: 1.9, guard: 1.8, final: 1.35 };
const CFG = { NHAN_HP: 0.10, NHAN_ATK: 0.06, LINH_HP: 1.25, LINH_ATK: 1.0, DB_NHAN: [1.15, 1.10], DB_LINH: [1.4, 1.15], SUB_HP: [1, 1.15, 1.3], SUB_ATK: [1, 1.06, 1.12], CHAIN_HP: 0.10, CHAIN_ATK: 0.05 };

const BOSS_SKILLS = (T) => [`${T} Uy Trấn Áp`, `${T} Quy Nhất`, `${T} Pháp Tướng`, `${T} Phá Diệt`, `Bất Diệt ${T} Thể`];
function mkProf(o) {
  const mobs = BD.MOB_KINDS.map((k, j) => ({ ...k, name: (o.mobNames && o.mobNames[j % o.mobNames.length]) || `${o.prefix} ${k.suffix}` }));
  const hpS = o.hpScale || 1; const atkS = o.atkScale || 1;
  const pow = { hp: {}, atk: {} };
  for (const k of Object.keys(HP_K)) { pow.hp[k] = HP_K[k] * hpS; pow.atk[k] = ATK_K[k] * atkS; }
  return {
    key: o.key, world: o.world, name: o.name, desc: o.desc, theme: o.theme, realm: o.realm, idx: 0,
    mobs, elites: BD.ELITE_SUFFIX.map((s) => `${o.prefix} ${s}`), mini: o.mini, guard: o.guard, final: o.final, skills: BOSS_SKILLS(o.theme),
    weak: null, resist: null, diff: { hp: 1, atk: 1 }, floors: [{ n: 1, name: o.fname || 'Chiến Trường', desc: o.fdesc || o.desc, waves: o.waves, chest: 0 }], pow, src: o.src,
  };
}
/** Đợt quái cho từng cấp; boss = true → đợt cuối là Boss cuối (3 giai đoạn). */
const WAVES = {
  std: [['normal', 'normal', 'normal'], ['normal', 'normal', 'elite'], ['normal', 'elite', 'mini'], ['normal', 'normal', 'elite', 'guard']],
  db_nhan: ['normal', 'elite', 'mini', 'guard'], db_linh: ['normal', 'elite', 'mini', 'guard'],
  lg: [['normal', 'normal', 'elite', 'mini'], ['normal', 'elite', 'elite', 'guard'], ['elite', 'elite', 'mini', 'guard']],
};
const withBoss = (w) => w.slice(0, -1).concat('final');

/** Dựng profile Bí Cảnh thường (tier 0–3; tier 3 = Vạn Linh Cốc). */
function profStd(tierIdx, boss = false) {
  const t = K.BICANH_TIERS[tierIdx]; const vlc = !!t.van_linh_coc;
  let waves = WAVES.std[Math.min(tierIdx, 3)].slice(); if (boss) waves = withBoss(waves);
  const prefix = ['Sơ Cấp', 'Trung Cấp', 'Cao Cấp', 'Vạn Linh'][Math.min(tierIdx, 3)];
  return mkProf({
    key: `std:${tierIdx}`, world: vlc ? 'linh' : 'nhan', name: t.name, desc: vlc ? 'Thung lũng cổ đầy linh thực yêu hóa — kẻ yếu bị cây cỏ nuốt chửng.' : 'Bí cảnh nhân giới — yêu thú và tàn hồn canh giữ cơ duyên.',
    theme: vlc ? 'Vạn Linh' : t.name.replace('Bí Cảnh ', ''), realm: t.require_realm, prefix, mobNames: vlc ? K.VANLINHCOC_QUAI : null,
    mini: vlc ? 'Linh Cốc Thủ Vệ' : `${prefix} Thống Lĩnh`, guard: vlc ? 'Vạn Linh Thụ Yêu' : `${prefix} Hộ Pháp`, final: vlc ? K.VANLINHCOC_BOSS : `${prefix} Chủ Nhân`,
    waves, hpScale: 1 + CFG.NHAN_HP * tierIdx, atkScale: 1 + CFG.NHAN_ATK * tierIdx, src: { fn: 'bicanh', arg: tierIdx, boss: !!boss },
  });
}
/** Bí Cảnh Đặc Biệt (group = nhan_gioi | linh_gioi). */
function profDacBiet(group) {
  const g = BI.DACBIET_GROUPS[group]; const linh = group === 'linh_gioi'; const sc = linh ? CFG.DB_LINH : CFG.DB_NHAN;
  return mkProf({
    key: `db:${group}`, world: linh ? 'linh' : 'nhan', name: g.label, desc: 'Cánh cửa đặc biệt mở ra nhờ Vé Bí Cảnh — kẻ canh giữ mạnh hơn bí cảnh thường.', theme: linh ? 'Linh Giới' : 'Nhân Giới',
    realm: g.min_realm, prefix: linh ? 'Linh Vực' : 'Dị Cảnh', mini: linh ? 'Linh Vực Sứ Giả' : 'Dị Cảnh Thống Lĩnh', guard: linh ? 'Linh Vực Chấp Pháp' : 'Dị Cảnh Hộ Pháp', final: linh ? 'Linh Vực Chúa Tể' : 'Dị Cảnh Chúa Tể',
    waves: WAVES[linh ? 'db_linh' : 'db_nhan'].slice(), hpScale: sc[0], atkScale: sc[1], src: { fn: 'dacbiet', arg: group, boss: false },
  });
}
const LG_PREFIX = { luyenhu: 'Luyện Hư', hopthe: 'Hợp Thể', daithua: 'Đại Thừa', dokiep: 'Độ Kiếp' };
/** Bí Cảnh Linh Giới (subKey = luyenhu_1 …). */
function profLinh(subKey, boss = false) {
  const en = BI.allLinhgioiSubtiers().find((e) => e.sub_key === subKey); if (!en) return null;
  const { chain, sub_idx: si } = en; const ci = BI.CHAINS.indexOf(chain); const pre = LG_PREFIX[chain.key];
  let waves = WAVES.lg[si].slice(); const hasBoss = !!(boss && chain.boss_on_last && si === chain.sub_names.length - 1); if (hasBoss) waves = withBoss(waves);
  return mkProf({
    key: `lg:${subKey}`, world: 'linh', name: `${chain.name.replace(/^\S+\s/, '')} — ${en.sub_name}`.replace(/\s*\(Boss:.*\)$/, ''), desc: `Bí cảnh Linh Giới ${pre} — hung hiểm hơn Nhân Giới nhiều lần.`, theme: pre, realm: chain.require_realm,
    prefix: pre, mini: `${pre} Sứ Giả`, guard: `${pre} Chấp Pháp`, final: hasBoss ? chain.boss_on_last.name.replace(/^\S+\s/, '') : `${pre} Chúa Tể`,
    waves, hpScale: CFG.LINH_HP * (1 + CFG.CHAIN_HP * ci) * CFG.SUB_HP[si], atkScale: CFG.LINH_ATK * (1 + CFG.CHAIN_ATK * ci) * CFG.SUB_ATK[si], src: { fn: 'linhgioi', arg: subKey, boss: hasBoss },
  });
}
const virtIdx = (key) => {
  const [k, a] = key.split(':');
  if (k === 'std') return VIRT.std + Number(a);
  if (k === 'db') return VIRT.db + (a === 'linh_gioi' ? 1 : 0);
  return VIRT.lg + Math.max(0, BI.allLinhgioiSubtiers().findIndex((e) => e.sub_key === a));
};

/** Chữ lỗi nếu không vào được (giống hệt khám phá tức thì cũ), null nếu hợp lệ. */
function precheck(row, uid, kind, arg) {
  if (kind === 'std') return BI.checkBicanh(row, Number(arg));
  if (kind === 'db') return BI.checkDacBiet(row, uid, arg);
  if (kind === 'lg') return BI.checkLinhgioi(row, arg);
  return '❌ Bí Cảnh không tồn tại.';
}
/**
 * Vào trận. Trả { legacy:true } khi công tắc tắt (caller chạy khám phá tức thì cũ) · { ok:false, error, runId? } · { ok:true, runId }.
 * kind: 'std' (arg = tierIdx) | 'db' (arg = nhan_gioi|linh_gioi) | 'lg' (arg = subKey).
 */
function begin(userId, kind, arg, { name = null, channelId = null } = {}) {
  if (!enabled()) return { legacy: true };
  const uid = String(userId); const row = Cu.getCultivator(uid); if (!row) return { ok: false, error: 'Bạn chưa bắt đầu tu tiên.' };
  BC.releaseLobbies(uid);
  const act = BC.activeRunId(uid); if (act) return { ok: false, error: 'Bạn đang ở giữa một trận Bí Cảnh — hãy hoàn tất hoặc thoát trận đó trước (mở `/bicanhtiengioi` → **Tiếp tục**).', runId: act };
  const bad = precheck(row, uid, kind, arg); if (bad) return { ok: false, error: bad };
  let prof;
  if (kind === 'std') { const t = K.BICANH_TIERS[Number(arg)]; prof = profStd(Number(arg), !!t.van_linh_coc && random() < K.VANLINHCOC_BOSS_CHANCE); }
  else if (kind === 'db') prof = profDacBiet(arg);
  else { const en = BI.allLinhgioiSubtiers().find((e) => e.sub_key === arg); const b = en.chain.boss_on_last; prof = profLinh(arg, !!(b && en.sub_idx === en.chain.sub_names.length - 1 && random() < b.chance)); }
  return D.transaction(() => {
    // ---- trả phí vào cửa: hồi chiêu + Vé (thua / bỏ trận vẫn mất)
    const t = now();
    if (kind === 'std') Cu.updateCultivator(uid, { last_bicanh: t });
    else if (kind === 'lg') Cu.updateCultivator(uid, { last_bicanh_linhgioi: t });
    else {
      const ve = row.ve_bicanh_dac_biet || 0;
      if (ve > 0) Cu.updateCultivator(uid, { ve_bicanh_dac_biet: ve - 1 });
      else if (!require('./tran17').teleportTicket(uid)) return { ok: false, error: '❌ Hết lượt Không Gian Trận Bàn.' };
    }
    prof.src.t0 = t;
    const nm = String(name || uid).slice(0, 32);
    const mem = BC.snapMember(Cu.getCultivator(uid), uid, nm, prof);
    const st = BC.newState(virtIdx(prof.key), [mem], prof); st.names = { [uid]: nm };
    const r = D.run('INSERT INTO bc19_runs (bc_idx, leader, status, state, channel_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?)', st.bc, uid, 'active', JSON.stringify(st), channelId ? String(channelId) : null, t, t);
    D.run('INSERT INTO bc19_members (run_id, user_id) VALUES (?,?)', r.lastInsertRowid, uid);
    return { ok: true, runId: Number(r.lastInsertRowid), prof };
  });
}
/** Chiến thắng → trao thưởng bằng đúng hàm phần thưởng cũ. Chỉ 1 lần / trận (st.paid). Trả chuỗi tóm tắt. */
function payWin(st) {
  if (st.paid) return st.lastReward || '';
  st.paid = true; const src = st.prof.src; const out = [];
  for (const m of st.members) {
    if (m.left) continue;
    let msg;
    if (src.fn === 'bicanh') msg = BI.doBicanh(m.uid, src.arg, { paid: true, boss: !!src.boss });
    else if (src.fn === 'dacbiet') msg = BI.doBicanhDacBiet(m.uid, src.arg, { paid: true });
    else msg = BI.doBicanhLinhgioi(m.uid, src.arg, { paid: true, boss: !!src.boss });
    st.rewards[m.uid] = { tu: 0, lt: 0, lines: [msg] }; out.push(msg);
  }
  st.lastReward = `🎁 **Phần thưởng chiến thắng**\n${out.join('\n')}`; st.rewardFloor = 1;
  return st.lastReward;
}

module.exports = { enabled, begin, payWin, precheck, profStd, profDacBiet, profLinh, virtIdx, isVirt, mkProf, HP_K, ATK_K, CFG, VIRT, WAVES };
