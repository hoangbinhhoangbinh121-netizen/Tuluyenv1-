'use strict';
/**
 * CHỨNG ĐẠO THÀNH ĐẾ V19.0 (spec §5–§7)
 *  • Cửa ải: Chuẩn Tiên Đế Viên Mãn (realm 18, stage 3) → Tiên Đế Sơ Kỳ. dotpha.js chặn đột phá thường ở đây và chỉ về /chungdao.
 *  • Đại Kiếp 12 đạo lôi, MỖI đạo là 1 bước có lưu trạng thái (de19_state.kiep, JSON) → restart / Discord timeout không mất tiến trình.
 *    Khi bắt đầu: trừ tài nguyên (100 Đế Đạo Bản Nguyên · 1 Chứng Nhận · 5 Bất Hủ Đế Cốt · 10 Tiên Tôn Đạo Quả).
 *    Mỗi đạo lôi người chơi chọn 1 cách ứng phó (6 lựa chọn, mỗi cách có tiêu hao / hồi chiêu / giới hạn) — không thể spam 1 nút hồi máu.
 *  • Thành công: Tiên Đế Sơ Kỳ + Đế Ấn + mở Đế Đạo / Đế Binh / Đế Hiệu + ghi lịch sử + thông báo toàn server.
 *  • Thất bại: giữ nguyên cảnh giới, mất 10–20% tu vi hiện có, hoàn 50% tài nguyên (trừ Chứng Nhận), "Thiên Kiếp Trọng Thương" và khoá 24 giờ.
 *  • Người chơi đã ở Tiên Đế trở lên từ trước V19 (Tiên Đế cũ được chuyển lên idx 19 ở V18) được tính "đã chứng đạo" (grand = 1) — không bị mất gì.
 */
const D = require('../db');
const K = require('./constants');
const R = require('./realm');
const BAL = require('./balance');
const Cu = require('./cultivator');
const T = require('./talent');
const TO = require('./talentOps');
const X17 = require('./fx17');
const Inv = require('./invsvc');
const FX = require('./fx19');
const BM = require('./benmenh19');
const IT = require('../data/items_v17');
const KN = require('./combatKernel');
const { now, int, random, randUniform, clamp } = require('../util');

const GATE_REALM = 18; const GATE_STAGE = 3; const TIEN_DE = 19;
const LOCK_SEC = 24 * 3600; const IDLE_SEC = 30 * 60;
const REQ = { tdc19_de_dao_ban_nguyen: 100, tdc19_de_dao_chung_nhan: 1, tdc19_bat_hu_de_cot: 5, tdc19_tien_ton_dao_qua: 10 };
const REFUND = 0.5;            // hoàn lại khi thất bại (trừ Chứng Nhận)
const STAGE_NAMES = ['Thiên Địa Kiếp', 'Hỗn Độn Kiếp', 'Đế Đạo Kiếp', 'Chung Cực Kiếp'];
const LOI = [
  [1, 'Cửu Tiêu Thần Lôi', 8], [2, 'Tử Tiêu Thiên Lôi', 9], [3, 'Diệt Hồn Thần Lôi', 11],
  [4, 'Hỗn Độn Thiên Lôi', 12], [5, 'Vạn Kiếp Diệt Thế Lôi', 13], [6, 'Đại Đạo Thần Lôi', 15],
  [7, 'Đế Uy Thiên Lôi', 16], [8, 'Vô Thượng Phá Đạo Lôi', 18], [9, 'Cửu Thiên Đế Kiếp', 20],
  [10, 'Hỗn Nguyên Diệt Thế Lôi', 23], [11, 'Vĩnh Hằng Phá Diệt Lôi', 26], [12, 'Chung Cực Chứng Đạo Lôi', 32],
].map(([n, name, pct]) => ({ n, name, pct: pct / 100, stage: Math.floor((n - 1) / 3), pierce: n === 12 ? 0.25 : (n >= 10 ? 0.15 : 0) }));
// v22.4.3: Lôi Kiếp nặng hơn hẳn — đòn đau, có thể giáng chí mạng, tỉ lệ thất bại cao (xem scripts/sim_chungdao19.js). Núm chỉnh runtime: CFG.
const CFG = { K: 1.6, PCT_MUL: 1.0, CRIT_P: 0.15, CRIT_M: 1.4, MIN_TAKE: 0.47, PIERCE_MUL: 2.2 };   // cũ (v22.4.2): K 1.25, MIN_TAKE 0.25, không chí mạng, đạo 1–12 = 8…25%
const pierceOf = (L) => Math.min(0.9, L.pierce * CFG.PIERCE_MUL);
const DEF_CAP = 70;   // sát thương tối thiểu = 25% sát thương cơ sở (giảm tổng hợp có trần → không bất tử)
const DAN_ID = 'dan_huyet_nguyen'; const DAN_MAX = 3; const DAN_CD = 2;

const RESP = {
  none: { name: 'Cứng Rắn Chống Đỡ', icon: '🛡️', desc: 'Không tiêu hao gì, nhận trọn đòn.' },
  dan: { name: 'Dùng Đan Dược', icon: '💊', desc: `Uống 1 Huyết Nguyên Đan: hồi sinh mệnh (tối đa ${DAN_MAX} viên cả kiếp, cách nhau ${DAN_CD} đạo).` },
  bao: { name: 'Pháp Bảo Hộ Thể', icon: '🔰', desc: 'Kích hoạt trang bị/Đế Binh đang mang: dựng khiên 8% sinh mệnh (×1,5 nếu mang Hỗn Độn Chung / Vĩnh Hằng Thần Tháp). Hồi chiêu 4 đạo; hao 2 độ bền món trang bị.' },
  cp: { name: 'Công Pháp Chống Lôi', icon: '📖', desc: 'Vận công pháp đang trang bị: giảm 20% sát thương (+4% mỗi công pháp, tối đa 32%). Hồi chiêu 3 đạo.' },
  sk: { name: 'Kỹ Năng Phá Lôi', icon: '✨', desc: 'Tốn 30% Linh Lực: đánh tan 30% uy lực lôi (Vạn Cổ Đế Kiếm: 40%). Hồi chiêu 2 đạo.' },
  race: { name: 'Kỹ Năng Tộc', icon: '🧬', desc: 'v22.1: thi triển kỹ năng chủng tộc loại tự thân (hồi / hộ thể / né…) rồi nhận lôi. Cần bật Combat Kernel Chứng Đạo; hồi chiêu theo đạo lôi.' },
  dok: { name: 'Dốc Toàn Lực', icon: '🔥', desc: 'Dốc TOÀN BỘ Linh Lực (cần ≥ 30%): giảm tới 60% sát thương theo lượng Linh Lực. Linh Lực về 0.' },
};
const CD = { dan: DAN_CD, bao: 4, cp: 3, sk: 2 };

// ================================================================ trạng thái
const stateRow = (uid) => D.get('SELECT * FROM de19_state WHERE user_id = ?', String(uid));
function ensureState(uid) {
  const u = String(uid); let s = stateRow(u);
  if (!s) { D.run('INSERT OR IGNORE INTO de19_state (user_id) VALUES (?)', u); s = stateRow(u); }
  const row = Cu.getCultivator(u);
  if (s && row && row.realm_index >= TIEN_DE && !s.passed_at && !s.grand) {
    D.run('UPDATE de19_state SET grand = 1, passed_at = ? WHERE user_id = ?', now(), u); FX.invalidate(u); s = stateRow(u);
  }
  return s;
}
const passed = (uid) => { const s = ensureState(uid); return !!(s && (s.passed_at || s.grand)); };
const kiepOf = (s) => { try { const k = JSON.parse(s.kiep || 'null'); return k && typeof k === 'object' ? k : null; } catch (_) { return null; } };
const hist = (uid, kind, detail) => D.run('INSERT INTO de19_history (ts, user_id, kind, detail) VALUES (?,?,?,?)', now(), String(uid), kind, typeof detail === 'string' ? detail : JSON.stringify(detail));
const fmt = (n) => Number(n).toLocaleString('vi-VN');
const itemName = (id) => (IT.BY_ID[id] ? IT.BY_ID[id].name : id);

/** Lý do chưa được Chứng Đạo (null = đủ điều kiện). */
function whyCannot(row) {
  if (!row) return 'Bạn chưa bắt đầu tu tiên.';
  const s = ensureState(row.user_id);
  if (s.passed_at || s.grand) return 'Bạn đã **Chứng Đạo Thành Đế** rồi.';
  if (kiepOf(s)) return null;                                    // đang giữa kiếp → tiếp tục
  if (row.world_tier < 2) return 'Chứng Đạo chỉ dành cho người đã **Phi Thăng Tiên Giới**.';
  if (!row.thiennhanngusuy_passed) return require('./ascension').tienGateMsg(row, 'Chứng Đạo');
  if (row.realm_index < GATE_REALM) return `Con Đường Chứng Đạo mở ở **Tiên Vương Viên Mãn**, nhưng bạn phải đi hết **Chuẩn Tiên Tôn → Tiên Tôn → Chuẩn Tiên Đế**. Hiện tại: **${K.REALMS[row.realm_index].name}**.`;
  if (row.realm_index > GATE_REALM) return 'Bạn đã vượt qua cửa ải này.';
  if (row.stage_index < GATE_STAGE) return `Phải đạt **${K.REALMS[GATE_REALM].name} · Viên Mãn** mới được vượt Đại Kiếp (hiện ${R.realmDisplay(row.realm_index, row.stage_index)}).`;
  if (s.fail_until > now()) return `🩹 **Thiên Kiếp Trọng Thương** — còn **${require('./format').fmtTime(s.fail_until - now())}** mới được Chứng Đạo lại.`;
  const need = R.tuViRequiredFor(row);
  if (row.tu_vi < need) return `Chưa đủ tu vi để Chứng Đạo (cần ${fmt(need)}, hiện có ${fmt(row.tu_vi)}).`;
  const miss = Inv.missing(row.user_id, REQ);
  if (miss.length) return `Thiếu tài nguyên: ${miss.map((m) => `**${itemName(m.id)}** ${m.have}/${m.need}`).join(' · ')}`;
  return null;
}
const reqText = (uid) => Object.entries(REQ).map(([id, n]) => `${Inv.qty(uid, id)}/${n} ${itemName(id)}`);

// ================================================================ mô phỏng 1 đạo lôi
const defPctOf = (k, n) => clamp(100 * k.def / (k.atk + k.def + 1), 0, DEF_CAP) * (1 - pierceOf(LOI[n - 1]));
/** Sát thương cơ sở chưa tính ứng phó của đạo n (để UI cảnh báo trước). */
function loiPreview(k, n) {
  const L = LOI[n - 1]; const base = L.pct * CFG.K * CFG.PCT_MUL * k.maxHp; const red = Math.min(0.5, k.dr + k.kiepRes);
  const eff = Math.max(base * CFG.MIN_TAKE, base * (100 / (100 + defPctOf(k, n))) * (1 - red));
  return { base: Math.floor(base), eff: Math.floor(eff), L };
}
function canResp(k, a, row) {
  if (!RESP[a]) return 'Lựa chọn không hợp lệ.';
  if (a === 'dan') {
    if (k.danUsed >= DAN_MAX) return `Đã dùng đủ ${DAN_MAX} viên Đan Dược trong kiếp này.`;
    if (k.cd.dan > 0) return `Đan Dược còn hồi chiêu ${k.cd.dan} đạo lôi.`;
    if (!Object.keys(Inv.byQuality(k.uid, DAN_ID)).length) return `Bạn không còn **${itemName(DAN_ID)}**.`;
  }
  if (a === 'bao') {
    if (k.cd.bao > 0) return `Pháp Bảo còn hồi chiêu ${k.cd.bao} đạo lôi.`;
    if (!(k.hasGear || k.binh === 'chung' || k.binh === 'thap')) return 'Bạn chưa mang trang bị/Đế Binh phòng ngự nào còn độ bền.';
  }
  if (a === 'cp') { if (k.cd.cp > 0) return `Công Pháp còn hồi chiêu ${k.cd.cp} đạo lôi.`; if (!k.eq.length) return 'Bạn chưa trang bị Công Pháp nào.'; }
  if (a === 'sk') { if (k.cd.sk > 0) return `Kỹ năng còn hồi chiêu ${k.cd.sk} đạo lôi.`; if (k.ll < 30) return `Không đủ Linh Lực (cần 30%, còn ${Math.floor(k.ll)}%).`; }
  if (a === 'race') {
    if (!KN.on('chungdao')) return 'Kỹ năng chủng tộc chưa bật ở Chứng Đạo (Combat Kernel đang tắt).';
    return KN.raceCheck(KN.open('chungdao', row, { name: 'Thiên Lôi', ctrlImmune: true, me: 'Bạn' }, k.kx || null), { selfOnly: true });
  }
  if (a === 'dok' && k.ll < 30) return `Cần ít nhất 30% Linh Lực để dốc toàn lực (còn ${Math.floor(k.ll)}%).`;
  return null;
}
/** Bước 1 đạo lôi: áp dụng ứng phó rồi lôi giáng. Hàm thuần trên k (đã parse). Trả { lines, dead }. */
function strike(k, a, KL = null) {
  const n = k.step; const L = LOI[n - 1]; const lines = []; let cut = 0;
  if (a === 'dan') {
    const q = Math.max(...Object.keys(Inv.byQuality(k.uid, DAN_ID)).map(Number));
    const pct = Math.min(0.60, 0.35 * IT.qMult(q)); const h = Math.min(k.maxHp - k.hp, Math.floor(k.maxHp * pct));
    if (!Inv.take(k.uid, DAN_ID, 1, { q, why: 'chung dao 19' })) return { error: 'Không trừ được Đan Dược.' };
    k.hp += h; k.danUsed += 1; k.cd.dan = DAN_CD + 1; lines.push(`💊 Uống Đan Dược: hồi **${fmt(h)}** sinh mệnh.`);
  } else if (a === 'bao') {
    let sh = 0.08; if (k.binh === 'chung' || k.binh === 'thap') sh *= 1.5;
    k.shield += Math.floor(k.maxHp * sh); k.cd.bao = CD.bao + 1;
    D.run('UPDATE gear SET dura = MAX(0, dura - 2) WHERE user_id = ? AND equipped = 1 AND dura > 0', k.uid);
    lines.push(`🔰 Pháp Bảo hộ thể: khiên **${fmt(Math.floor(k.maxHp * sh))}**.`);
  } else if (a === 'cp') {
    cut = Math.min(0.32, 0.20 + 0.04 * k.eq.length); k.cd.cp = CD.cp + 1; lines.push(`📖 Công pháp chống lôi: giảm **${Math.round(cut * 100)}%** uy lực.`);
  } else if (a === 'sk') {
    cut = k.binh === 'kiem' ? 0.40 : 0.30; k.ll -= 30; k.cd.sk = CD.sk + 1; lines.push(`✨ Phá Lôi: đánh tan **${Math.round(cut * 100)}%** uy lực lôi.`);
  } else if (a === 'dok') {
    cut = Math.min(0.60, (k.ll / 100) * 0.60); lines.push(`🔥 Dốc toàn lực (${Math.floor(k.ll)}% Linh Lực): giảm **${Math.round(cut * 100)}%** uy lực.`); k.ll = 0;
  }
  if (KL) {                                                                               // v22.0 (kernel_chungdao = kernel): kỹ năng tộc tự thân tự phát trước khi lôi giáng
    KN.begin(KL, k.maxHp);
    const rc = KN.race(KL, k.hp, k.maxHp, { selfOnly: true, request: a === 'race' });
    if (rc) { lines.push(...rc.lines.map((x) => String(x))); k.hp = rc.heal >= 0 ? Math.min(k.maxHp, k.hp + rc.heal) : Math.max(1, k.hp + rc.heal); }
  }
  const crit = random() < CFG.CRIT_P;   // v22.4.3: lôi có thể giáng chí mạng
  const base = L.pct * CFG.K * CFG.PCT_MUL * k.maxHp * randUniform(0.95, 1.05) * (crit ? CFG.CRIT_M : 1);
  const red = Math.min(0.5, k.dr + k.kiepRes);
  let dmg = base * (100 / (100 + defPctOf(k, n))) * (1 - red) * (1 - cut);
  dmg = Math.floor(Math.max(base * CFG.MIN_TAKE * (1 - cut * 0.5), dmg)); if (KL) dmg = Math.floor(dmg * KN.takeMult(KL)); dmg = Math.max(1, Math.min(dmg, 9e15));   // v22.0: Hộ Thể (kỹ năng tộc) giảm uy lực lôi
  lines.push(`⚡ **Đạo ${n}/12 — ${L.name}** giáng xuống: ${fmt(dmg)} sát thương${crit ? ' 💢 **CHÍ MẠNG THIÊN LÔI!**' : ''}${L.pierce ? ` _(Phá Giáp Thiên Kiếp: bỏ qua ${Math.round(pierceOf(L) * 100)}% phòng ngự)_` : ''}.`);
  if (k.shield > 0) { const ab = Math.min(k.shield, dmg); k.shield -= ab; dmg -= ab; if (ab) lines.push(`🔰 Khiên hấp thụ ${fmt(ab)}.`); }
  if (dmg >= k.hp) {
    if (k.surv > 0) { k.surv -= 1; dmg = k.hp - 1; lines.push('♻️ **Bảo mệnh**: sống sót với 1 sinh mệnh!'); }
  }
  k.hp = Math.max(0, k.hp - dmg);
  if (KL) KN.end(KL);
  lines.push(`💥 Sinh mệnh: **${fmt(k.hp)}/${fmt(k.maxHp)}**`);
  const dead = k.hp <= 0;
  if (!dead) {
    k.step += 1; k.ll = Math.min(100, k.ll + 20);
    for (const key of Object.keys(k.cd)) if (k.cd[key] > 0) k.cd[key] -= 1;
    if (n % 3 === 0 && n < 12) { const h = Math.floor(k.maxHp * 0.03); k.hp = Math.min(k.maxHp, k.hp + h); k.ll = Math.min(100, k.ll + 20); lines.push(`🌫️ Hết **${STAGE_NAMES[L.stage]}** — kiếp vân tạm lắng: hồi ${fmt(h)} sinh mệnh, +20% Linh Lực.`); }
  }
  k.log.push(...lines); if (k.log.length > 30) k.log.splice(0, k.log.length - 30);
  k.last = lines; return { lines, dead };
}

// ================================================================ vòng đời
/** Bắt đầu Đại Kiếp: kiểm tra, trừ tài nguyên, chụp chỉ số. */
function begin(userId) {
  return D.transaction(() => {
    const row = Cu.getCultivator(userId); const s = ensureState(userId);
    if (s && kiepOf(s)) return { ok: true, resumed: true, k: kiepOf(s) };
    const bad = whyCannot(row); if (bad) return { ok: false, error: bad };
    if (!Inv.takeMany(userId, REQ, 'chung dao 19: bắt đầu')) return { ok: false, error: 'Không đủ tài nguyên.' };
    const b = T.bundle(row); const f17 = X17.get(row); const perks = FX.combatPerks(row); const eq = Cu.equippedCongphapTiers(row);
    const maxHp = Math.max(1, Cu.effectiveMaxHp(row));
    const hasGear = D.get('SELECT 1 AS x FROM gear WHERE user_id = ? AND equipped = 1 AND dura > 0', String(userId)) ? 1 : 0;
    const k = {
      v: 1, uid: String(userId), step: 1, maxHp, hp: maxHp, ll: 100, shield: (BM.get(userId) && BM.get(userId).awaken >= 1) ? Math.floor(maxHp * 0.05) : 0, atk: Math.max(1, Cu.effectiveAtk(row)), def: Math.max(0, Cu.effectiveDef(row)),
      dr: clamp((b.dr || 0) + (f17.dr || 0), 0, 0.30), kiepRes: clamp((b.kiepDmg || 0) + (f17.kiep || 0) + (perks.kiepDmg || 0), 0, 0.50),
      eq, binh: perks.binh || null, hasGear, danUsed: 0, cd: { dan: 0, bao: 0, cp: 0, sk: 0 }, surv: (perks.dao === 'luanhoi' && perks.awake >= 1) || eq.includes(1055) ? 1 : 0,
      spent: { ...REQ }, startedAt: now(), expireAt: now() + IDLE_SEC, log: ['🌩️ Thiên địa biến sắc — **Chứng Đạo Đại Kiếp** bắt đầu!'], last: [], tuNeed: R.tuViRequiredFor(row),
    };
    D.run('UPDATE de19_state SET kiep = ?, attempts = attempts + 1 WHERE user_id = ?', JSON.stringify(k), String(userId));
    hist(userId, 'begin', { maxHp });
    return { ok: true, k };
  });
}
/** Ứng phó + lôi giáng. Trả { ok, k, lines, ended?: 'win'|'lose'|'timeout', result? } */
function respond(userId, a) {
  return D.transaction(() => {
    const s = ensureState(userId); const k = s && kiepOf(s); if (!k) return { ok: false, error: 'Bạn không đang trong Đại Kiếp.' };
    if (now() > k.expireAt) { const r = finish(userId, k, false, 'timeout'); return { ok: true, k, lines: ['⌛ Quá lâu không ứng phó — thiên kiếp tự giáng xuống!'], ended: 'lose', result: r }; }
    if (k.step > 12) return { ok: false, error: 'Đại Kiếp đã kết thúc.' };
    const row = Cu.getCultivator(userId); const bad = canResp(k, a, row); if (bad) return { ok: false, error: bad, k };
    const KL = KN.on('chungdao') ? KN.open('chungdao', row, { name: 'Thiên Lôi', ctrlImmune: true, me: 'Bạn' }, k.kx || null) : null;
    const out = strike(k, a, KL); if (KL) k.kx = KN.toJSON(KL); if (out.error) return { ok: false, error: out.error, k };
    k.expireAt = now() + IDLE_SEC;
    if (out.dead) { const r = finish(userId, k, false, 'dead'); return { ok: true, k, lines: out.lines, ended: 'lose', result: r }; }
    if (k.step > 12) { const r = finish(userId, k, true); return { ok: true, k, lines: out.lines, ended: 'win', result: r }; }
    D.run('UPDATE de19_state SET kiep = ? WHERE user_id = ?', JSON.stringify(k), String(userId));
    return { ok: true, k, lines: out.lines };
  });
}
/** Kiểm tra kiếp treo quá hạn (gọi khi mở /chungdao). Trả kết quả nếu đã tự thất bại. */
function sweepIdle(userId) {
  const s = ensureState(userId); const k = s && kiepOf(s);
  if (k && now() > k.expireAt) return D.transaction(() => ({ expired: true, result: finish(userId, k, false, 'timeout') }));
  return null;
}
/** Từ bỏ giữa chừng = thất bại. */
function giveUp(userId) {
  return D.transaction(() => { const s = ensureState(userId); const k = s && kiepOf(s); if (!k) return { ok: false, error: 'Bạn không đang trong Đại Kiếp.' }; return { ok: true, result: finish(userId, k, false, 'giveup') }; });
}
function finish(userId, k, win, why = '') {
  const u = String(userId); const row = Cu.getCultivator(u);
  if (win) {
    const [nr, ns] = [TIEN_DE, 0];
    const G = BAL.stageGain(GATE_REALM, row.world_tier, row);
    const cur = Cu.calcLucChien(row);
    const gained = Math.max(int(cur * K.MAJOR_REALM_BREAKTHROUGH_LUC_CHIEN_MIN_PCT), int(cur * K.MAJOR_REALM_BREAKTHROUGH_LUC_CHIEN_PCT));
    const extra = int(gained / 7); const need = Math.min(row.tu_vi, k.tuNeed);
    const upd = { tu_vi: row.tu_vi - need, realm_index: nr, stage_index: ns, hp: row.hp + G.hp + extra, atk: row.atk + G.atk + extra, def_: row.def_ + G.def + extra, spd: row.spd + G.spd + extra };
    const scale = Cu.hpScale({ ...row, hp: upd.hp }); upd.cur_hp = int(upd.hp * scale) + int(row.ruong_bonus_hp || 0); upd.last_hp_regen = now();
    Object.assign(upd, TO.progFields(row, { tc: 5 }));
    Cu.updateCultivator(u, upd);
    Inv.add(u, 'tdc19_de_an', 1, { why: 'chung dao 19' });
    D.run('UPDATE de19_state SET kiep = NULL, passed_at = ?, injured_until = 0, fail_until = 0 WHERE user_id = ?', now(), u); FX.invalidate(u);
    hist(u, 'win', { luc: gained, turns: 12 });
    return { win: true, lucGain: gained, before: row, after: Cu.getCultivator(u), text: `👑 **CHỨNG ĐẠO THÀNH ĐẾ!** Bạn vượt qua cả 12 đạo Đế Kiếp, bước lên **${R.realmDisplay(nr, ns, true)}** (+${fmt(gained)} Lực Chiến).` };
  }
  const lose = randUniform(0.10, 0.20); const lost = int(row.tu_vi * lose);
  const refund = {}; for (const [id, n] of Object.entries(k.spent || REQ)) if (id !== 'tdc19_de_dao_chung_nhan') { const r = Math.floor(n * REFUND); if (r > 0) refund[id] = r; }
  Cu.updateCultivator(u, { tu_vi: new Cu.Delta(-lost), cur_hp: Math.max(1, Math.floor(k.maxHp * 0.10)), last_hp_regen: now() });
  const got = Inv.addMany(u, refund, 'chung dao 19: hoàn tài nguyên');
  D.run('UPDATE de19_state SET kiep = NULL, fail_until = ?, injured_until = ? WHERE user_id = ?', now() + LOCK_SEC, now() + LOCK_SEC, u);
  hist(u, 'fail', { why, step: k.step, lost });
  return { win: false, why, lost, refund: got, step: Math.min(12, k.step), text: `💥 **CHỨNG ĐẠO THẤT BẠI** (${why === 'timeout' ? 'bỏ lỡ nhịp ứng kiếp' : why === 'giveup' ? 'tự bỏ cuộc' : `gục ở đạo ${Math.min(12, k.step)}/12`}). Mất **${fmt(lost)}** tu vi (${Math.round(lose * 100)}%), nhận **Thiên Kiếp Trọng Thương**, không thể thử lại trong **24 giờ**. Hoàn 50% tài nguyên (trừ Chứng Nhận).` };
}
const historyOf = (userId, n = 8) => D.all('SELECT * FROM de19_history WHERE user_id = ? ORDER BY id DESC LIMIT ?', String(userId), n);
const recentWins = (n = 10) => D.all("SELECT h.ts, h.user_id FROM de19_history h WHERE h.kind = 'win' ORDER BY h.id DESC LIMIT ?", n);

// ================================================================ Sau Chứng Đạo: Đế Đạo · Đế Binh · Đế Hiệu
const needPassed = (uid) => (passed(uid) ? null : 'Bạn chưa **Chứng Đạo Thành Đế**.');
const costOk = (uid, c) => { if (Number(Cu.getCultivator(uid).linh_thach) < c.lt) return `Thiếu Linh Thạch (cần ${fmt(c.lt)}).`; const m = Inv.missing(uid, c.items); return m.length ? `Thiếu: ${m.map((x) => `${itemName(x.id)} ${x.have}/${x.need}`).join(' · ')}` : null; };
const pay = (uid, c, why) => { if (!Inv.takeMany(uid, c.items, why)) return false; Cu.updateCultivator(uid, { linh_thach: new Cu.Delta(-c.lt) }, { linh_thach: c.lt }); require('./ledger').noteOnce(uid, -c.lt, { reason: 'Chứng Đạo/Đế', ref: String(why).slice(0, 100), key: require('./ledger').nonce('cdpay') }); return true; };
const costText = (c) => `${fmt(c.lt)} Linh Thạch · ${Object.entries(c.items).map(([id, n]) => `${n} ${itemName(id)}`).join(' · ')}`;
const awakeOf = (lv, cur) => Math.min(FX.DAO_AWAKEN_LEVELS.filter((x) => lv >= x).length, cur + 1);

function chooseDao(uid, key) {
  return D.transaction(() => {
    const e = needPassed(uid); if (e) return { ok: false, error: e };
    if (!FX.DE_DAO[key]) return { ok: false, error: 'Đế Đạo không tồn tại.' };
    const s = stateRow(uid);
    if (s.de_dao === key) return { ok: false, error: 'Đó đã là Đế Đạo chính của bạn.' };
    if (s.de_dao) {   // đổi: mất cấp, chi phí gấp 3 (mỗi người chỉ 1 Đế Đạo chính)
      const c0 = FX.daoCost(0); const c = { lt: c0.lt * 3, items: Object.fromEntries(Object.entries(c0.items).map(([i, n]) => [i, n * 3])) };
      const bad = costOk(uid, c); if (bad) return { ok: false, error: bad };
      if (!pay(uid, c, 'de dao: doi')) return { ok: false, error: 'Không đủ tài nguyên.' };
      D.run('UPDATE de19_state SET de_dao = ?, de_dao_lv = 1, de_dao_awake = 0 WHERE user_id = ?', key, String(uid)); hist(uid, 'dao_switch', { from: s.de_dao, to: key });
    } else {
      const c = FX.daoCost(0); const bad = costOk(uid, c); if (bad) return { ok: false, error: bad };
      if (!pay(uid, c, 'de dao: linh ngo')) return { ok: false, error: 'Không đủ tài nguyên.' };
      D.run('UPDATE de19_state SET de_dao = ?, de_dao_lv = 1, de_dao_awake = 0 WHERE user_id = ?', key, String(uid)); hist(uid, 'dao_pick', { to: key });
    }
    FX.invalidate(uid); return { ok: true };
  });
}
function upgradeDao(uid) {
  return D.transaction(() => {
    const e = needPassed(uid); if (e) return { ok: false, error: e }; const s = stateRow(uid);
    if (!s.de_dao) return { ok: false, error: 'Hãy chọn Đế Đạo chính trước.' };
    if (s.de_dao_lv >= FX.DAO_MAX_LEVEL) return { ok: false, error: 'Đế Đạo đã đạt cấp tối đa.' };
    const c = FX.daoCost(s.de_dao_lv); const bad = costOk(uid, c); if (bad) return { ok: false, error: bad };
    if (!pay(uid, c, 'de dao: nang cap')) return { ok: false, error: 'Không đủ tài nguyên.' };
    D.run('UPDATE de19_state SET de_dao_lv = de_dao_lv + 1 WHERE user_id = ?', String(uid)); FX.invalidate(uid); hist(uid, 'dao_up', { lv: s.de_dao_lv + 1 });
    return { ok: true, lv: s.de_dao_lv + 1 };
  });
}
const awakenCost = (n) => ({ lt: 100000000 * (n + 1), items: { tdc19_de_cung_co_an: 3 * (n + 1), tdc19_thien_dao_phap_tac: 2 * (n + 1), tdc19_vinh_hang_dao_qua: n + 1 } });
function awakenDao(uid) {
  return D.transaction(() => {
    const e = needPassed(uid); if (e) return { ok: false, error: e }; const s = stateRow(uid);
    if (!s.de_dao) return { ok: false, error: 'Hãy chọn Đế Đạo chính trước.' };
    const need = FX.DAO_AWAKEN_LEVELS[s.de_dao_awake]; if (!need) return { ok: false, error: 'Đã thức tỉnh tối đa.' };
    if (s.de_dao_lv < need) return { ok: false, error: `Thức tỉnh lần ${s.de_dao_awake + 1} cần Đế Đạo cấp ${need} (hiện ${s.de_dao_lv}).` };
    const c = awakenCost(s.de_dao_awake); const bad = costOk(uid, c); if (bad) return { ok: false, error: bad };
    if (!pay(uid, c, 'de dao: thuc tinh')) return { ok: false, error: 'Không đủ tài nguyên.' };
    D.run('UPDATE de19_state SET de_dao_awake = de_dao_awake + 1 WHERE user_id = ?', String(uid)); FX.invalidate(uid); hist(uid, 'dao_awake', { n: s.de_dao_awake + 1 });
    return { ok: true, n: s.de_dao_awake + 1 };
  });
}
const binhOf = (uid) => { const s = stateRow(uid); if (!s) return {}; try { return JSON.parse(s.binh || '{}') || {}; } catch (_) { return {}; } };
function craftBinh(uid, key) {
  return D.transaction(() => {
    const e = needPassed(uid); if (e) return { ok: false, error: e }; const def = FX.DE_BINH[key]; if (!def) return { ok: false, error: 'Đế Binh không tồn tại.' };
    const b = binhOf(uid); if (b[key] !== undefined) return { ok: false, error: `Bạn đã sở hữu **${def.name}**.` };
    const bad = costOk(uid, def.craft); if (bad) return { ok: false, error: bad };
    if (!pay(uid, def.craft, `de binh: ${key}`)) return { ok: false, error: 'Không đủ tài nguyên.' };
    b[key] = 0; const eq = stateRow(uid).binh_eq; D.run('UPDATE de19_state SET binh = ?, binh_eq = ? WHERE user_id = ?', JSON.stringify(b), eq || key, String(uid));
    FX.invalidate(uid); hist(uid, 'binh_craft', { key }); return { ok: true };
  });
}
function equipBinh(uid, key) {
  const e = needPassed(uid); if (e) return { ok: false, error: e }; const b = binhOf(uid); if (b[key] === undefined) return { ok: false, error: 'Bạn chưa sở hữu Đế Binh này.' };
  D.run('UPDATE de19_state SET binh_eq = ? WHERE user_id = ?', key, String(uid)); FX.invalidate(uid); return { ok: true };
}
function upgradeBinh(uid, key) {
  return D.transaction(() => {
    const e = needPassed(uid); if (e) return { ok: false, error: e }; const b = binhOf(uid); if (b[key] === undefined) return { ok: false, error: 'Bạn chưa sở hữu Đế Binh này.' };
    if (b[key] >= FX.BINH_MAX_LEVEL) return { ok: false, error: 'Đế Binh đã đạt cấp tối đa.' };
    const c = FX.binhUpCost(b[key]); const bad = costOk(uid, c); if (bad) return { ok: false, error: bad };
    if (!pay(uid, c, `de binh up: ${key}`)) return { ok: false, error: 'Không đủ tài nguyên.' };
    b[key] += 1; D.run('UPDATE de19_state SET binh = ? WHERE user_id = ?', JSON.stringify(b), String(uid)); FX.invalidate(uid); hist(uid, 'binh_up', { key, lv: b[key] });
    return { ok: true, lv: b[key] };
  });
}
/** Chuẩn hoá Đế Hiệu: 2–24 ký tự, chỉ chữ/số/khoảng trắng (chặn @, #, markdown, link, mention). */
function sanitizeHieu(raw) {
  const t = String(raw == null ? '' : raw).normalize('NFC').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 24) return { ok: false, error: 'Đế Hiệu phải dài **2–24 ký tự**.' };
  if (!/^[\p{L}\p{N} ]+$/u.test(t)) return { ok: false, error: 'Đế Hiệu chỉ được dùng chữ cái, số và khoảng trắng (không ký tự đặc biệt, @, link).' };
  if (/(http|www|discord|everyone|here)/i.test(t)) return { ok: false, error: 'Đế Hiệu không hợp lệ.' };
  return { ok: true, hieu: t };
}
function setHieu(uid, raw) {
  const e = needPassed(uid); if (e) return { ok: false, error: e };
  const v = sanitizeHieu(raw); if (!v.ok) return v;
  D.run('UPDATE de19_state SET de_hieu = ? WHERE user_id = ?', v.hieu, String(uid)); FX.invalidate(uid); hist(uid, 'hieu', { hieu: v.hieu }); return { ok: true, hieu: v.hieu };
}

module.exports = {
  GATE_REALM, GATE_STAGE, TIEN_DE, REQ, LOI, STAGE_NAMES, RESP, DAN_ID, DAN_MAX, LOCK_SEC, IDLE_SEC,
  CFG, ensureState, stateRow, passed, kiepOf, whyCannot, reqText, loiPreview, canResp, strike, begin, respond, sweepIdle, giveUp, finish, historyOf, recentWins,
  chooseDao, upgradeDao, awakenDao, awakenCost, craftBinh, equipBinh, upgradeBinh, binhOf, sanitizeHieu, setHieu, costText, itemName,
};
