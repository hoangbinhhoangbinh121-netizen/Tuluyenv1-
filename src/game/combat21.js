'use strict';
/**
 * v21.3 — COMBAT ENGINE dùng chung cho Đấu Pháp (tương tác `pvp.js` VÀ tự động `pvpCore.doPvp`).
 * Một công thức đánh duy nhất: roundAction() trong pvpCore (không đổi). Engine này chỉ quản lý VÒNG ĐẤU:
 *   • Không giới hạn số hiệp (kết thúc khi KO / đầu hàng / AFK / bế tắc). Không còn "hết 5 hiệp → so sinh lực → tung đồng xu".
 *   • AFK (không chọn hành động) = BỎ LƯỢT (không tự đánh). AFK liên tiếp ≥ PVP_AFK_FORFEIT → xử THUA bên AFK; cả hai cùng AFK liên tiếp → HÒA.
 *   • KO đồng thời → HÒA. Bế tắc (không bên nào chạm sinh lực thấp mới trong PVP_STALEMATE_ROUNDS hiệp) → HÒA. Hòa: không ai mất/được tu vi.
 *   • Hòa, đầu hàng, huỷ đều được ghi vào v213_battles; chốt trận chỉ 1 lần (status 'active' → 'done').
 * Chính sách (mặc định ĐỀ XUẤT — chờ admin/người thiết kế duyệt; chỉnh được bằng bot_settings):
 *   pvp_afk_forfeit (2) · pvp_stalemate_rounds (15) · pvp_safety_rounds (300, chốt chặn an toàn → hòa, không phải giới hạn thiết kế).
 */
const { EmbedBuilder } = require('discord.js');
const Cu = require('./cultivator');
const BAL = require('./balance');
const T = require('./talent');
const PetC = require('./petCombat');
const R = require('./realm');
const K = require('./constants');
const ST = require('./settings');
const SS = require('./stat21');
const FXE = require('./effectEngine');
const SE = require('./statEngine');
const RS = require('./raceSkill21');
const { LEGACY_NAME, KILLMOVE_CD } = require('../data/effects21');
const D = require('../db');
const { E } = require('./emoji');
const { int, choice } = require('../util');

const SURRENDER = '__SURRENDER__';
const SHOW_ROUNDS = 3;                    // số hiệp gần nhất hiện trong embed; toàn bộ nằm ở nhật ký
const sid = (x) => String(x);
const num = (k, d, lo, hi) => { const v = Number(ST.get(k, String(d))); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.trunc(v))) : d; };
const policy = () => ({
  afkForfeit: num('pvp_afk_forfeit', 2, 1, 10), stalemate: num('pvp_stalemate_rounds', 15, 5, 100), safety: num('pvp_safety_rounds', 300, 50, 1000),
  killCd: num('pvp_killmove_cd', KILLMOVE_CD, 0, 10),                       // v21.6 (F-2): Sát Chiêu hồi chiêu — 0 = tắt (hành vi cũ)
  effectsMode: String(ST.get('pvp_effects_mode', 'real')) === 'log' ? 'log' : 'real',   // v21.6 (F-1): 'real' = hiệu ứng có tác dụng; 'log' = chỉ ghi nhật ký như cũ
});
const HX = (id) => { try { const h = require('./fx19').hieuOf(id); return h ? ` 「${h}」` : ''; } catch (_) { return ''; } };

function createBattle(a, b, o = {}) {
  const P = require('./pvpCore');
  const aId = sid(a.user_id); const bId = sid(b.user_id);
  const sa = SS.snapshot(a); const sb = SS.snapshot(b);
  if (!sa.check.ok || !sb.check.ok) console.warn('⚠️ stat21 lệch công thức cũ — dùng Cu.effective*:', JSON.stringify([sa.check.diffs, sb.check.diffs]));
  const atkA = Cu.effectiveAtk(a); const defA = Cu.effectiveDef(a); const spdA = Cu.effectiveSpd(a);
  const atkB = Cu.effectiveAtk(b); const defB = Cu.effectiveDef(b); const spdB = Cu.effectiveSpd(b);
  const PW = BAL.pvpPowers(a, b, Cu, { foe: true }); const powerA = PW.powerA; const powerB = PW.powerB;
  const buffNote = (PW.buffA || PW.debuffA || PW.buffB || PW.debuffB) ? `\n🌀 Công pháp phát động: 🅰️ +${int(PW.buffA * 100)}%/-${int(PW.debuffA * 100)}% · 🅱️ +${int(PW.buffB * 100)}%/-${int(PW.debuffB * 100)}% (buff / debuff đối thủ).` : '';
  const realmA = R.realmDisplay(a.realm_index, a.stage_index); const realmB = R.realmDisplay(b.realm_index, b.stage_index);
  const [mAtkA, mAtkB] = P.statArrow(atkA, atkB); const [mDefA, mDefB] = P.statArrow(defA, defB);
  const [mSpdA, mSpdB] = P.statArrow(spdA, spdB); const [mPowA, mPowB] = P.statArrow(powerA, powerB);
  const header = `🅰️ <@${aId}>${HX(aId)} (${realmA}) — Công ${atkA}${mAtkA} | Thủ ${defA}${mDefA} | Tốc ${spdA}${mSpdA} | Lực Chiến ${powerA}${mPowA}\n🅱️ <@${bId}>${HX(bId)} (${realmB}) — Công ${atkB}${mAtkB} | Thủ ${defB}${mDefB} | Tốc ${spdB}${mSpdB} | Lực Chiến ${powerB}${mPowB}${buffNote}`;
  const arena = PetC.buildArena(a, b);
  const hpMax = 100;                                            // thanh sinh mệnh chuẩn hoá 100 (thiết kế v12.3). Đổi sang HP thật = quyết định cân bằng, chưa làm (xem KNOWN_ISSUES)
  const tag = { A: `<@${aId}>${HX(aId)}`, B: `<@${bId}>${HX(bId)}` };
  return {
    id: o.id || require('node:crypto').randomBytes(6).toString('hex'), mode: o.mode || 'duel', guild_id: o.guildId || '', channel_id: o.channelId || '',
    ids: { A: aId, B: bId }, rowA: a, rowB: b, snap: { A: sa, B: sb },
    atk: { A: atkA, B: atkB }, def_: { A: defA, B: defB }, spd: { A: spdA, B: spdB }, power: { A: powerA, B: powerB },
    skills: { A: P.pvpActionListFor(a), B: P.pvpActionListFor(b) }, pet: { A: arena.A.pet ? arena.A.pet.name : '', B: arena.B.pet ? arena.B.pet.name : '' },
    arena, mods: { A: PetC.mergeMods(T.combatMods(a), arena.A), B: PetC.mergeMods(T.combatMods(b), arena.B) },
    tag, header, realm_line: `🅰️ <@${aId}>${HX(aId)}: ${realmA}\n🅱️ <@${bId}>${HX(bId)}: ${realmB}`,
    hp_max: hpMax, hp: { A: hpMax, B: hpMax }, cur_hp: { A: a.cur_hp, B: b.cur_hp }, round: 0,
    afk: { A: 0, B: 0 }, low: { A: hpMax, B: hpMax }, idle: 0, surrendered: null,
    fx: FXE.createStore(), cd: { A: { kill: 0, race: 0 }, B: { kill: 0, race: 0 } }, race: { A: RS.forRow(a), B: RS.forRow(b) },
    totals: { A: { dealt: 0, taken: 0, heal: 0, crit: 0, dodge: 0, afk: 0 }, B: { dealt: 0, taken: 0, heal: 0, crit: 0, dodge: 0, afk: 0 } },
    log: [], recs: [], policy: policy(), started_at: o.now || require('../util').now(),
  };
}

/** Chơi 1 hiệp. actions = { A, B } ∈ { chuỗi hành động | null (AFK) | SURRENDER }. Trả { block, verdict }. */
function playRound(b, actions) {
  const P = require('./pvpCore');
  const hp = b.hp; b.round += 1; const rnd = b.round; const block = []; const recs = [];
  const before = { A: hp.A, B: hp.B }; const real = b.policy.effectsMode !== 'log';
  for (const side of ['A', 'B']) if (actions[side] === SURRENDER) { b.surrendered = b.surrendered || side; block.push(`🏳️ ${b.tag[side]} **đầu hàng**.`); }
  if (!b.surrendered) {
    for (const side of ['A', 'B']) { if (actions[side] === null || actions[side] === undefined) { b.afk[side] += 1; b.totals[side].afk += 1; } else b.afk[side] = 0; }
    if (real) {                                                  // v21.6: sát thương theo thời gian ở ĐẦU hiệp (Trúng Độc / Xuất Huyết / Thiêu Đốt)
      const st0 = FXE.startRound(b.fx);
      for (const s of ['A', 'B']) if (st0.dmg[s] > 0 && hp[s] > 0) { const d = Math.min(st0.dmg[s], hp[s]); hp[s] -= d; b.totals[s].taken += d; block.push(`${b.tag[s]}: ${st0.lines[s].join(' ')}`); }
    }
    const fm = { A: real ? FXE.modifiers(b.fx, 'A') : null, B: real ? FXE.modifiers(b.fx, 'B') : null };
    const spdOf = (s) => (fm[s] ? b.spd[s] * fm[s].spdMult : b.spd[s]);
    const first = spdOf('A') === spdOf('B') ? choice(['A', 'B']) : (spdOf('A') > spdOf('B') ? 'A' : 'B');       // ngang tốc: chọn ngẫu nhiên SERVER-SIDE
    const second = first === 'A' ? 'B' : 'A';
    for (const [ak, dk] of [[first, second], [second, first]]) {
      if (hp[ak] <= 0 || hp[dk] <= 0) continue;
      let action = actions[ak];
      if (real && FXE.consumeStun(b.fx, ak)) { block.push(`💫 ${b.tag[ak]} bị **Choáng Váng** — mất lượt.`); block.push(...PetC.idle(b.arena, ak, hp)); continue; }
      if (action === null || action === undefined) {
        block.push(`⏳ ${b.tag[ak]} không chọn hành động — **bỏ lượt** (${b.afk[ak]}/${b.policy.afkForfeit}).`);
        block.push(...PetC.idle(b.arena, ak, hp)); continue;
      }
      // v21.6 (F-2): Sát Chiêu có hồi chiêu; kỹ năng tộc có hồi chiêu — hết hồi mới dùng được (đòi dùng khi còn hồi = Đánh Thường, có ghi chú)
      if (action === P.PVP_ACTION_KILLMOVE && (b.cd[ak].kill || 0) > 0) { block.push(`💢 ${b.tag[ak]}: Sát Chiêu còn hồi **${b.cd[ak].kill}** hiệp — ra Đánh Thường.`); action = P.ATTACK_NORMAL; }
      else if (RS.isAction(b, ak, action) && !RS.available(b, ak)) { block.push(`${b.tag[ak]}: kỹ năng tộc còn hồi **${b.cd[ak].race}** hiệp — ra Đánh Thường.`); action = P.ATTACK_NORMAL; }
      if (action === P.PVP_ACTION_DEFEND) {
        block.push(`${b.tag[ak]} thi triển **${P.PVP_ACTION_DEFEND}**, không ra đòn hiệp này.`);
        block.push(...PetC.idle(b.arena, ak, hp)); continue;
      }
      const raceAct0 = RS.isAction(b, ak, action) ? RS.of(b, ak) : null; let raceAct = raceAct0;
      if (raceAct && raceAct.def.kind === 'self') {
        block.push(...RS.castSelf(b, ak, dk)); b.cd[ak].race = raceAct.cd;
        if (!raceAct.def.free) { block.push(...PetC.idle(b.arena, ak, hp)); continue; }                       // kỹ năng 'free' = thi triển rồi VẪN ra đòn thường trong hiệp (không mất lượt)
        action = P.ATTACK_NORMAL; raceAct = null;
      }
      const defending = actions[dk] === P.PVP_ACTION_DEFEND;
      const rp = raceAct ? RS.params(b, ak) : null;
      const fa = fm[ak] ? FXE.modifiers(b.fx, ak) : null; const fd = fm[dk] ? FXE.modifiers(b.fx, dk) : null;     // đọc lại: hiệu ứng có thể vừa đổi trong hiệp
      const sa = SE.applyBattle({ atk: b.atk[ak], def: b.def_[ak], spd: b.spd[ak] }, b.mods[ak], fa);             // v21.6: StatEngine — chồng hiệu ứng trong trận lên chỉ số bền vững
      const sd = SE.applyBattle({ atk: b.atk[dk], def: b.def_[dk], spd: b.spd[dk] }, b.mods[dk], fd);
      const att = { ...sa.mods, ...(rp ? { crit: (sa.mods.crit || 0) + rp.critAdd, skillDmg: rp.skillDmg } : {}) }; const dmod = sd.mods;
      const effects = real ? { proc: (name, dur) => { const id = LEGACY_NAME[name]; return id ? FXE.apply(b.fx, dk, id, { dur: id === 'stun' ? 1 : dur, source: ak }) : { applied: false, line: '' }; } } : null;
      const atkStat = sa.atk; const defStat = sd.def;
      const isKill = action === P.PVP_ACTION_KILLMOVE;
      const r = P.roundAction(b.tag[ak], b.tag[dk], atkStat, defStat, b.power[ak], b.power[dk], b.skills[ak], b.pet[ak], hp, dk, action, defending, isKill, { att, def: dmod, pet: { arena: b.arena }, effects });
      block.push(...r.lines); recs.push(r.record);
      if (isKill) b.cd[ak].kill = b.policy.killCd;
      if (raceAct) { b.cd[ak].race = raceAct.cd; if (real) block.push(...RS.after(b, ak, dk, r.record)); }
      const rc = r.record;
      if (rc.damage) { b.totals[ak].dealt += rc.damage; b.totals[dk].taken += rc.damage; }
      if (rc.counter_damage) { b.totals[dk].dealt += rc.counter_damage; b.totals[ak].taken += rc.counter_damage; }
      if (rc.heal_amount) b.totals[ak].heal += rc.heal_amount;
      if (rc.is_crit) b.totals[ak].crit += 1;
      if (rc.dodge) b.totals[dk].dodge += 1;
    }
    if (real) FXE.endRound(b.fx);
    for (const s of ['A', 'B']) { if (b.cd[s].kill > 0) b.cd[s].kill -= 1; if (b.cd[s].race > 0) b.cd[s].race -= 1; }
    if (real) { const fxl = ['A', 'B'].map((s) => { const d = FXE.describe(b.fx, s); return d ? `${s === 'A' ? '🅰️' : '🅱️'} ${d}` : ''; }).filter(Boolean); if (fxl.length) block.push(`🌀 Hiệu ứng: ${fxl.join(' | ')}`); }
  }
  block.push(`❤️ ${b.tag.A}: ${Math.max(0, hp.A)}/${b.hp_max}  |  ${b.tag.B}: ${Math.max(0, hp.B)}/${b.hp_max}`);
  // bế tắc: hiệp mà không bên nào chạm sinh lực thấp hơn mức thấp nhất từng có
  let fresh = false;
  for (const s of ['A', 'B']) if (hp[s] < b.low[s]) { b.low[s] = hp[s]; fresh = true; }
  b.idle = fresh || b.surrendered ? 0 : b.idle + 1;
  b.log.push({ r: rnd, t: P.fitBlock(block), a: Math.max(0, hp.A), b: Math.max(0, hp.B), x: before.A !== hp.A || before.B !== hp.B ? 1 : 0 });
  if (b.recs.length < 6) b.recs.push({ round: rnd, actions: recs, hp_a_after: Math.max(0, hp.A), hp_b_after: Math.max(0, hp.B) });
  return { block, verdict: judge(b) };
}

/** Phán quyết: { over, result: 'A'|'B'|'draw', reason } */
function judge(b) {
  const hp = b.hp; const p = b.policy;
  if (b.surrendered) return { over: true, result: b.surrendered === 'A' ? 'B' : 'A', reason: 'surrender' };
  if (hp.A <= 0 && hp.B <= 0) return { over: true, result: 'draw', reason: 'double_ko' };
  if (hp.A <= 0) return { over: true, result: 'B', reason: 'ko' };
  if (hp.B <= 0) return { over: true, result: 'A', reason: 'ko' };
  const fa = b.afk.A >= p.afkForfeit; const fb = b.afk.B >= p.afkForfeit;
  if (fa && fb) return { over: true, result: 'draw', reason: 'afk_both' };
  if (fa) return { over: true, result: 'B', reason: 'afk' };
  if (fb) return { over: true, result: 'A', reason: 'afk' };
  if (b.idle >= p.stalemate) return { over: true, result: 'draw', reason: 'stalemate' };
  if (b.round >= p.safety) return { over: true, result: 'draw', reason: 'safety' };
  return { over: false };
}
const REASON = { ko: 'hạ gục đối thủ', double_ko: 'cả hai cùng gục', surrender: 'đối thủ đầu hàng', afk: 'đối thủ bỏ trận (AFK)', afk_both: 'cả hai cùng bỏ trận (AFK)', stalemate: 'bế tắc — không bên nào chiếm thế', safety: 'trận quá dài (chốt chặn an toàn)', restart: 'bot khởi động lại', cooldown: 'cooldown đã bị trận khác tiêu mất' };

/** Chạy trọn trận tự động. chooser(side, battle) → hành động (mặc định: ngẫu nhiên trong bộ chiêu — đúng như đấu tự động cũ). */
function simulate(b, chooser = null) {
  const pick = chooser || ((side) => RS.autoPick(b, side) || choice(b.skills[side]));
  for (;;) { const { verdict } = playRound(b, { A: pick('A', b), B: pick('B', b) }); if (verdict.over) return verdict; }
}

const sumLine = (b) => ['A', 'B'].map((s) => { const t = b.totals[s]; return `${s === 'A' ? '🅰️' : '🅱️'} gây ${t.dealt} · nhận ${t.taken}${t.heal ? ` · hồi/hút ${t.heal}` : ''} · bạo kích ${t.crit} · né ${t.dodge}${t.afk ? ` · bỏ lượt ${t.afk}` : ''}`; }).join('\n');
/** Embed: tiêu đề + header + CHỈ SHOW_ROUNDS hiệp gần nhất (không bao giờ vượt 25 field / 6000 ký tự dù trận dài bao nhiêu hiệp). */
function embed(b, { title = '⚔️ ĐẤU PHÁP', verdict = null, extra = [], live = null, real = null } = {}) {
  const e = new EmbedBuilder().setTitle(title).setDescription(b.header.slice(0, 3500)).setColor(verdict ? (verdict.result === 'draw' ? 0x95a5a6 : verdict.result === 'A' ? 0xf1c40f : 0xe74c3c) : 0xf1c40f);
  const shown = b.log.slice(-SHOW_ROUNDS);
  if (b.log.length > shown.length) e.addFields({ name: '📜 Các hiệp trước', value: `Đã qua **${b.log.length - shown.length}** hiệp (ẩn cho gọn). Xem đầy đủ sau trận: \`/lichsupvp\` → mã trận \`${b.id}\`.`, inline: false });
  for (const l of shown) e.addFields({ name: `⏱️ Hiệp ${l.r}`, value: String(l.t).slice(0, 1000), inline: false });
  if (live) e.addFields({ name: `⏱️ Hiệp ${b.round + 1} — Chọn hành động`, value: String(live).slice(0, 1000), inline: false });
  if (verdict) {
    e.addFields({ name: `${E.cup} Kết Quả`, value: `${resultText(b, verdict, real)}\n${b.realm_line}`.slice(0, 1000), inline: false });
    e.addFields({ name: '📊 Tổng kết trận', value: `${b.round} hiệp\n${sumLine(b)}`.slice(0, 1000), inline: false });
  }
  for (const f of extra) e.addFields(f);
  return e;
}
function resultText(b, v, real = null) {
  const why = REASON[v.reason] || v.reason;
  if (v.result === 'draw') return `🤝 **HÒA** — ${why}. Không ai mất hay được tu vi.`;
  const win = v.result === 'A' ? b.tag.A : b.tag.B; const lose = v.result === 'A' ? b.tag.B : b.tag.A;
  const gain = real === null ? '' : (real > 0 ? ` Đoạt được **${real}** tu vi.` : ' Đối thủ không còn tu vi để đoạt.');
  return `${E.cup} ${win} **chiến thắng** (${why})!${gain}${real > 0 ? `\n💥 ${lose} mất **${real}** tu vi.` : ''}`;
}

// ---------------------------------------------------------------- nhật ký trận (v213_battles)
const logPayload = (b) => {
  let rows = b.log; let s = JSON.stringify(rows);
  if (s.length > 200000) { rows = rows.slice(-Math.max(5, Math.floor(rows.length * 200000 / s.length))); s = JSON.stringify(rows); }
  return s;
};
const summaryPayload = (b) => JSON.stringify({ rounds: b.round, totals: b.totals, power: b.power, hp: b.hp, policy: b.policy, snap: { A: { atk: b.snap.A.atk, def: b.snap.A.def, spd: b.snap.A.spd, maxHp: b.snap.A.maxHp }, B: { atk: b.snap.B.atk, def: b.snap.B.def, spd: b.snap.B.spd, maxHp: b.snap.B.maxHp } } });
function record(b) {
  D.run("INSERT OR IGNORE INTO v213_battles (id, a_id, b_id, status, mode, channel_id, started_at) VALUES (?, ?, ?, 'active', ?, ?, ?)", b.id, b.ids.A, b.ids.B, b.mode, b.channel_id, b.started_at);
}
const setMessage = (id, messageId) => D.run('UPDATE v213_battles SET message_id = ? WHERE id = ?', String(messageId), id);
const abort = (id, reason, t = require('../util').now()) => D.run("UPDATE v213_battles SET status = 'aborted', result = 'aborted', reason = ?, ended_at = ? WHERE id = ? AND status = 'active'", reason, t, id).changes > 0;
/** Khởi động lại bot: mọi trận còn 'active' chưa chốt → huỷ (KHÔNG ai mất/được gì). Trả danh sách để báo kênh. */
function abortStale(t = require('../util').now()) {
  const rows = D.all("SELECT id, a_id, b_id, channel_id, message_id FROM v213_battles WHERE status = 'active'");
  for (const r of rows) abort(r.id, 'restart', t);
  return rows;
}
function getLog(id) { const r = D.get('SELECT * FROM v213_battles WHERE id = ?', id); if (!r) return null; let log = []; let sum = {}; try { log = JSON.parse(r.log || '[]'); } catch (_) { /* log hỏng */ } try { sum = JSON.parse(r.summary || '{}'); } catch (_) { /* summary hỏng */ } return { ...r, logRows: log, sum }; }
const recent = (uid, n = 5) => D.all("SELECT id, a_id, b_id, status, result, reason, rounds, stake, ended_at FROM v213_battles WHERE (a_id = ? OR b_id = ?) AND status != 'active' ORDER BY ended_at DESC LIMIT ?", sid(uid), sid(uid), n);

module.exports = { SURRENDER, SHOW_ROUNDS, REASON, policy, createBattle, playRound, judge, simulate, embed, resultText, record, setMessage, abort, abortStale, getLog, recent, logPayload, summaryPayload };
