'use strict';
/**
 * ĐỘNG CƠ NGHỀ NGHIỆP v17 — dùng chung cho 4 nghề (Đan Sư · Luyện Khí Sư · Trận Pháp Sư · Linh Thực Sư).
 *  • Cấp bậc/EXP/kỹ thuật/thành tựu/thành thạo riêng từng nghề (bảng prof_state, prof_mastery, prof_ach).
 *  • Chế tạo = LỆNH CHẾ có hạn giờ (craft_jobs): nguyên liệu + Linh Thạch bị trừ MỘT LẦN, nguyên tử, lúc tạo lệnh; nhận thành phẩm bằng thao tác nhận,
 *    chuyển state 'brewing'→'done' bằng 1 UPDATE có điều kiện nên bấm dồn/đồng thời không thể nhận 2 lần hay trừ 2 lần.
 *  • Sản phẩm đi thẳng vào Inventory Service (hoặc bảng gear cho trang bị).
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const { I, C } = Cat;
const { now, int, random, randInt, clamp, fmtNum } = require('../util');
const { Delta } = Cu;

const uid = (u) => String(u);
const MAX_JOBS_KEEP = 40;
const parseJ = (s, d) => { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : d; } catch (_) { return d; } };

// ------------------------------------------------------------------ hồ sơ nghề
function state(user, prof) {
  if (!C.PROFS[prof]) throw new Error(`nghề lạ: ${prof}`);
  let r = D.get('SELECT * FROM prof_state WHERE user_id = ? AND prof_id = ?', uid(user), prof);
  if (!r) { D.run('INSERT OR IGNORE INTO prof_state (user_id, prof_id, created_at) VALUES (?,?,?)', uid(user), prof, now()); r = D.get('SELECT * FROM prof_state WHERE user_id = ? AND prof_id = ?', uid(user), prof); }
  r.ex = parseJ(r.extra, {}); return r;
}
const levelDef = (lv) => C.LEVELS[clamp(lv, 1, 9) - 1];
const levelName = (lv) => levelDef(lv).name;
const nextDef = (lv) => (lv >= 9 ? null : C.LEVELS[lv]);
const expCap = (st) => { const n = nextDef(st.level); return n ? n.exp : 1e12; };
/** Cộng EXP nghề (không vượt ngưỡng cấp kế cho tới khi thăng cấp). Trả EXP thực nhận. */
function addExp(user, prof, n) {
  n = Math.max(0, int(n)); if (!n) return 0;
  const st = state(user, prof); const cap = expCap(st); const nx = Math.min(cap, st.exp + n);
  D.run('UPDATE prof_state SET exp = ? WHERE user_id = ? AND prof_id = ?', nx, uid(user), prof);
  return nx - st.exp;
}
function bumpExtra(user, prof, key, n = 1, mode = 'add') {
  const st = state(user, prof); const ex = st.ex; ex[key] = mode === 'max' ? Math.max(ex[key] || 0, n) : (ex[key] || 0) + n;
  D.run('UPDATE prof_state SET extra = ? WHERE user_id = ? AND prof_id = ?', JSON.stringify(ex), uid(user), prof);
}
function promoteInfo(user, prof) {
  const st = state(user, prof); const nx = nextDef(st.level); if (!nx) return { max: true, st };
  const me = Cu.getCultivator(user); const miss = [];
  if (st.exp < nx.exp) miss.push(`EXP nghề ${fmtNum(st.exp)}/${fmtNum(nx.exp)}`);
  if (st.crafts < nx.crafts) miss.push(`số lần chế ${st.crafts}/${nx.crafts}`);
  if (me && me.realm_index < nx.realm) miss.push(`cảnh giới ≥ ${require('./constants').REALMS[nx.realm].name}`);
  if (me && me.linh_thach < nx.fee) miss.push(`Linh Thạch ${fmtNum(me.linh_thach)}/${fmtNum(nx.fee)}`);
  return { max: false, st, nx, miss, can: miss.length === 0 };
}
function promote(user, prof) {
  return D.transaction(() => {
    const p = promoteInfo(user, prof);
    if (p.max) return { ok: false, msg: `Bạn đã là **${levelName(9)}** — cấp cao nhất.` };
    if (!p.can) return { ok: false, msg: `Chưa đủ điều kiện thăng **${p.nx.name}**: ${p.miss.join(' · ')}.` };
    if (p.nx.fee && !Cu.updateCultivator(user, { linh_thach: new Delta(-p.nx.fee) }, { linh_thach: p.nx.fee })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    D.run('UPDATE prof_state SET level = level + 1 WHERE user_id = ? AND prof_id = ? AND level = ?', uid(user), prof, p.st.level);
    const techs = C.TECHS[prof].filter((t) => t.lv === p.nx.lv).map((t) => `**${t.name}**`);
    const recs = C.RECIPES.filter((r) => r.prof === prof && r.lv === p.nx.lv).map((r) => r.name);
    return { ok: true, msg: `🎓 **Thăng cấp ${C.PROFS[prof].name}: ${levelName(p.st.level)} → ${p.nx.name}!**${p.nx.fee ? ` (−${fmtNum(p.nx.fee)} Linh Thạch)` : ''}${techs.length ? `\n🧠 Kỹ thuật mới: ${techs.join(', ')}` : ''}${recs.length ? `\n📜 Công thức mới: ${recs.join(', ')}` : ''}\nMỗi lần chế tối đa **${p.nx.batch}**, ${C.slotsOf(p.nx.lv)} lò cùng lúc.` };
  });
}

// ------------------------------------------------------------------ kỹ thuật / thành thạo
function techFx(user, prof) {
  const st = state(user, prof); const out = {};
  for (const t of C.TECHS[prof]) if (st.level >= t.lv) for (const [k, v] of Object.entries(t.fx)) out[k] = (out[k] || 0) + v;
  return out;
}
const masteryN = (user, rid) => { const r = D.get('SELECT n FROM prof_mastery WHERE user_id = ? AND recipe_id = ?', uid(user), rid); return r ? r.n : 0; };
/** Bậc thành thạo 0–5 theo số lần chế riêng công thức đó: 5/15/40/90/180 lần. */
const masteryTier = (n) => [5, 15, 40, 90, 180].filter((x) => n >= x).length;
const MASTERY_NAMES = ['Mới học', 'Quen tay', 'Thuần thục', 'Tinh thông', 'Đại thành', 'Viên mãn'];

// ------------------------------------------------------------------ tính tỉ lệ / thời gian / phẩm chất
const catalystOf = { dan: 'tdc_dan_hoa_tinh', khi: 'nl_manh_phap_bao', tran: 'td_thien_dien_sa' };
function phuongQ(user) { const me = Cu.getCultivator(user); return me ? Math.max(0, int(me.dan_phuong_quality || 0)) : 0; }
function calc(user, rid, { boost = false } = {}) {
  const r = C.RBY[rid]; const st = state(user, r.prof); const tf = techFx(user, r.prof); const mt = masteryTier(masteryN(user, rid));
  const surplus = Math.max(0, st.level - r.lv);
  let rate = r.rate >= 1 ? 1 : clamp(r.rate + (tf.succ || 0) + 0.01 * mt + Math.min(0.05, 0.01 * surplus) + (boost ? 0.06 : 0) + (r.prof === 'dan' ? Math.min(0.08, 0.01 * phuongQ(user)) : 0), 0.05, 0.98);
  const cut = clamp((tf.time || 0) + 0.02 * mt, 0, 0.35);
  const time = Math.round(r.time * (1 - cut));
  let avgR = 0; let cnt = 0; for (const [k, n] of Object.entries(r.ing)) { avgR += I.BY_ID[k].rarity * n; cnt += n; } avgR = cnt ? avgR / cnt : 1;
  const shift = clamp(0.03 * surplus + 0.02 * mt + (tf.qup || 0) + (boost ? 0.10 : 0) + (r.prof === 'dan' ? 0.01 * Math.min(8, phuongQ(user)) : 0) + clamp((avgR - 2) * 0.02, 0, 0.08), 0, 0.15);
  return { r, st, rate, time, shift, mt, tf, cut };
}
const Q_CUT = [0.30, 0.78, 0.94, 0.985];
function rollQuality(shift) { const u = random() + shift; let q = 1; for (const c of Q_CUT) if (u >= c) q += 1; return q; }
/** Phân bố phẩm chất (để UI hiển thị): xác suất q=1..5 với dịch `shift`. */
function qualityDist(shift) { const d = [0, 0, 0, 0, 0]; const cuts = [0, ...Q_CUT, 1.0001]; for (let q = 0; q < 5; q += 1) { const lo = Math.max(0, cuts[q] - shift); const hi = Math.min(1, cuts[q + 1] - shift); d[q] = Math.max(0, hi - lo); if (q === 4) d[q] = Math.max(0, 1 - Math.max(0, cuts[4] - shift)); } return d; }

// ------------------------------------------------------------------ kiểm tra & bắt đầu chế
const cdLeft = (user, rid) => { const r = D.get('SELECT until FROM craft_cd WHERE user_id = ? AND recipe_id = ?', uid(user), rid); return r ? Math.max(0, r.until - now()) : 0; };
const activeJobs = (user, prof) => D.all("SELECT * FROM craft_jobs WHERE user_id = ? AND state = 'brewing'" + (prof ? ' AND prof_id = ?' : '') + ' ORDER BY ready_at ASC', ...[uid(user), ...(prof ? [prof] : [])]);
function needList(r, qty, boost) {
  const m = {}; for (const [k, n] of Object.entries(r.ing)) m[k] = n * qty;
  if (boost) { const c = catalystOf[r.prof]; if (c) m[c] = (m[c] || 0) + qty; }
  return m;
}
/** Phân tích: có chế được không, thiếu gì (UI dùng để chặn thao tác). */
function check(user, rid, qty = 1, { boost = false } = {}) {
  const r = C.RBY[rid]; if (!r) return { ok: false, reasons: ['Công thức không tồn tại.'] };
  const me = Cu.getCultivator(user); const st = state(user, r.prof); const reasons = []; qty = clamp(int(qty), 1, 99);
  if (!me) return { ok: false, reasons: ['Bạn chưa bắt đầu tu tiên.'] };
  if (st.level < r.lv) reasons.push(`Cần ${C.PROFS[r.prof].name} cấp **${levelName(r.lv)}** (hiện ${levelName(st.level)})`);
  if (me.realm_index < r.realm) reasons.push(`Cần cảnh giới ≥ **${require('./constants').REALMS[r.realm].name}**`);
  const maxB = levelDef(st.level).batch; if (qty > maxB) reasons.push(`Cấp hiện tại chỉ chế tối đa ${maxB} mỗi lần`);
  if (r.cd && qty > 1) reasons.push('Công thức có hồi chiêu: chỉ chế 1 mỗi lần');
  const cl = cdLeft(user, rid); if (cl > 0) reasons.push(`Đang hồi chiêu ${require('./format').fmtTime(cl)}`);
  const need = needList(r, qty, boost); const miss = Inv.missing(user, need);
  for (const m of miss) reasons.push(`Thiếu ${m.need - m.have} × ${I.BY_ID[m.id].name} (có ${m.have}/${m.need})`);
  const gold = r.gold * qty; if (me.linh_thach < gold) reasons.push(`Thiếu Linh Thạch (${fmtNum(me.linh_thach)}/${fmtNum(gold)})`);
  const busy = activeJobs(user, r.prof).length; if (busy >= C.slotsOf(st.level)) reasons.push(`Lò đầy (${busy}/${C.slotsOf(st.level)}) — nhận thành phẩm trước`);
  return { ok: reasons.length === 0, reasons, need, gold, miss, qty, r, st };
}
function start(user, rid, qty = 1, { boost = false } = {}) {
  qty = clamp(int(qty), 1, 99);
  return D.transaction(() => {
    const c = check(user, rid, qty, { boost });
    if (!c.ok) return { ok: false, msg: `❌ Không chế được **${c.r ? c.r.name : rid}**:\n• ${c.reasons.join('\n• ')}` };
    const { r } = c; const cal = calc(user, rid, { boost });
    if (c.gold && !Cu.updateCultivator(user, { linh_thach: new Delta(-c.gold) }, { linh_thach: c.gold })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    if (!Inv.takeMany(user, c.need, `chế ${rid}`)) throw new Error('trừ nguyên liệu thất bại');          // ROLLBACK cả Linh Thạch
    const total = Math.round(cal.time * qty * (qty > 1 ? 0.9 : 1));
    const j = D.run("INSERT INTO craft_jobs (user_id, prof_id, recipe_id, qty, boost, started_at, ready_at, state) VALUES (?,?,?,?,?,?,?,'brewing')", uid(user), r.prof, rid, qty, boost ? 1 : 0, now(), now() + total);
    if (r.cd) D.run('INSERT OR REPLACE INTO craft_cd (user_id, recipe_id, until) VALUES (?,?,?)', uid(user), rid, now() + r.cd);
    D.run("DELETE FROM craft_jobs WHERE user_id = ? AND state = 'done' AND job_id NOT IN (SELECT job_id FROM craft_jobs WHERE user_id = ? ORDER BY job_id DESC LIMIT ?)", uid(user), uid(user), MAX_JOBS_KEEP);
    const res = { ok: true, jobId: j.lastInsertRowid, ready: total <= 0 };
    if (total <= 0) { const cl = claim(user, j.lastInsertRowid); res.msg = cl.msg; res.claim = cl; return res; }
    res.msg = `🔥 Bắt đầu chế **${qty} × ${r.name}** — xong sau **${require('./format').fmtTime(total)}** (tỉ lệ thành công ~${Math.round(cal.rate * 100)}%). Dùng nút **Nhận thành phẩm** khi xong.`;
    return res;
  });
}

// ------------------------------------------------------------------ nhận thành phẩm
function claim(user, jobId) {
  const job = D.get('SELECT * FROM craft_jobs WHERE job_id = ? AND user_id = ?', int(jobId), uid(user));
  if (!job) return { ok: false, msg: 'Không tìm thấy lệnh chế này.' };
  if (job.state !== 'brewing') return { ok: false, msg: 'Lệnh chế này đã được nhận rồi.' };
  if (job.ready_at > now()) return { ok: false, msg: `⏳ Chưa xong — còn **${require('./format').fmtTime(job.ready_at - now())}**.` };
  return D.transaction(() => {
    // Chốt trạng thái bằng 1 UPDATE có điều kiện: chỉ MỘT lời gọi thắng, các lời gọi đồng thời khác thấy changes = 0.
    if (D.run("UPDATE craft_jobs SET state = 'done' WHERE job_id = ? AND user_id = ? AND state = 'brewing' AND ready_at <= ?", job.job_id, uid(user), now()).changes === 0) return { ok: false, msg: 'Lệnh chế này đã được nhận rồi.' };
    const r = C.RBY[job.recipe_id]; const cal = calc(user, r.id, { boost: !!job.boost });
    const outIt = I.BY_ID[r.out.item]; const isGear = r.kind === 'gear';
    let ok = 0; let bad = 0; let bestQ = 0; const got = {}; const qs = {}; const refund = {}; const gearNames = [];
    for (let i = 0; i < job.qty; i += 1) {
      if (random() < cal.rate) {
        ok += 1;
        const q = r.q ? rollQuality(cal.shift) : 0; bestQ = Math.max(bestQ, q);
        let n = r.out.qty; if (!isGear && random() < (cal.tf.dbl || 0)) n *= 2;
        if (isGear) { const gid = require('./gear17').create(user, r.out.item, q || 1); gearNames.push(`${C.GEAR[r.out.item].name} (${I.qName(q || 1)})`); got[`gear:${gid}`] = 1; }
        else { const real = Inv.add(user, r.out.item, n, { q, why: `chế ${r.id}` }); const k = `${r.out.item}|${q}`; qs[k] = (qs[k] || 0) + real; }
        if (random() < (cal.tf.save || 0)) for (const k of Object.keys(r.ing)) refund[k] = (refund[k] || 0) + 1;
      } else {
        bad += 1;
        for (const [k, n] of Object.entries(r.ing)) { const f = n * (r.fail || 0); const base = Math.floor(f); const add = random() < f - base ? 1 : 0; if (base + add > 0) refund[k] = (refund[k] || 0) + base + add; }
      }
    }
    const back = Inv.addMany(user, refund, `hoàn ${r.id}`);
    // EXP + thống kê
    const st = cal.st; const d = Math.max(0, st.level - r.lv); const dm = [1, 0.8, 0.6, 0.4, 0.2][Math.min(4, d)];
    const gain = Math.round(r.exp * dm * (ok + bad * 0.3));
    const real = addExp(user, r.prof, gain);
    D.run('UPDATE prof_state SET crafts = crafts + ?, successes = successes + ?, fails = fails + ?, best_q = MAX(best_q, ?) WHERE user_id = ? AND prof_id = ?', job.qty, ok, bad, bestQ, uid(user), r.prof);
    D.run('INSERT INTO prof_mastery (user_id, recipe_id, n) VALUES (?,?,?) ON CONFLICT(user_id, recipe_id) DO UPDATE SET n = n + excluded.n', uid(user), r.id, job.qty);
    D.run('INSERT INTO craft_log (ts, user_id, prof_id, recipe_id, qty, ok, bad, best_q, note) VALUES (?,?,?,?,?,?,?,?,?)', now(), uid(user), r.prof, r.id, job.qty, ok, bad, bestQ, '');
    if (r.id === 'rc_dan_tay_tuy_nua' || true) D.run('UPDATE craft_jobs SET result = ? WHERE job_id = ?', JSON.stringify({ ok, bad, bestQ }), job.job_id);
    const achMsg = checkAch(user, r.prof);
    // dựng thông báo
    const lines = [];
    if (ok) {
      if (isGear) lines.push(`✅ Chế thành công: ${gearNames.join(', ')}`);
      else lines.push(`✅ Thành công **${ok}/${job.qty}**: ${Object.entries(qs).filter(([, n]) => n > 0).map(([k, n]) => { const [id, q] = k.split('|'); return `${n} × ${I.BY_ID[id].name}${Number(q) ? ` (${I.qName(Number(q))})` : ''}`; }).join(', ') || '—'}`);
    }
    if (bad) lines.push(`💥 Thất bại ${bad}/${job.qty}${Object.keys(back).length ? ` — hoàn lại ${Object.entries(back).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ')}` : ' — mất nguyên liệu'}`);
    lines.push(`📈 +${fmtNum(real)} EXP ${C.PROFS[r.prof].name}${real < gain ? ' (đã chạm ngưỡng — hãy **Thăng cấp**)' : ''}`);
    return { ok: true, win: ok > 0, ok_n: ok, bad_n: bad, bestQ, msg: `🔔 **${r.name}** ×${job.qty}\n${lines.join('\n')}${achMsg}` };
  });
}
function claimAll(user, prof = null) {
  const out = []; for (const j of activeJobs(user, prof)) if (j.ready_at <= now()) { const c = claim(user, j.job_id); if (c.msg) out.push(c.msg); }
  return out;
}
const jobsOf = (user, prof = null) => activeJobs(user, prof).map((j) => ({ ...j, r: C.RBY[j.recipe_id], left: Math.max(0, j.ready_at - now()) }));
const historyOf = (user, prof, n = 10) => D.all('SELECT * FROM craft_log WHERE user_id = ? AND prof_id = ? ORDER BY id DESC LIMIT ?', uid(user), prof, n);

// ------------------------------------------------------------------ thành tựu
function checkAch(user, prof) {
  const st = state(user, prof); const stat = { crafts: st.crafts, successes: st.successes, fails: st.fails, bestQ: st.best_q, level: st.level, extra: st.ex };
  const msgs = [];
  for (const a of C.ACH[prof]) {
    if (D.get('SELECT 1 AS x FROM prof_ach WHERE user_id = ? AND ach_id = ?', uid(user), a.id)) continue;
    let pass = false; try { pass = !!a.test(stat); } catch (_) { pass = false; }
    if (!pass) continue;
    if (D.run('INSERT OR IGNORE INTO prof_ach (user_id, ach_id, at) VALUES (?,?,?)', uid(user), a.id, now()).changes === 0) continue;
    if (a.lt) Cu.updateCultivator(user, { linh_thach: new Delta(a.lt) });
    const items = a.items ? Inv.addMany(user, a.items, `thành tựu ${a.id}`) : {};
    msgs.push(`🏅 **Thành tựu: ${a.name}** — +${fmtNum(a.lt || 0)} Linh Thạch${Object.keys(items).length ? `, ${Object.entries(items).map(([k, n]) => `${n} × ${I.BY_ID[k].name}`).join(', ')}` : ''}`);
  }
  return msgs.length ? `\n${msgs.join('\n')}` : '';
}
const achList = (user, prof) => C.ACH[prof].map((a) => ({ ...a, done: !!D.get('SELECT 1 AS x FROM prof_ach WHERE user_id = ? AND ach_id = ?', uid(user), a.id) }));

// ------------------------------------------------------------------ Tàn Quyển Đan Phương: đọc để tăng EXP Đan Sư (giới hạn/ngày)
function useTanQuyen(user) {
  const LIM = 5; if (Inv.dailyGet(user, 'tanquyen') >= LIM) return { ok: false, msg: `Hôm nay bạn đã đọc đủ ${LIM} Tàn Quyển.` };
  return D.transaction(() => {
    if (!Inv.take(user, 'tdc_tan_quyen_dan_phuong', 1, { why: 'đọc tàn quyển' })) return { ok: false, msg: 'Bạn không có Tàn Quyển Đan Phương.' };
    Inv.dailyAdd(user, 'tanquyen', 1);
    const st = state(user, 'dan'); const g = addExp(user, 'dan', 40 + 25 * st.level);
    return { ok: true, msg: `📜 Nghiền ngẫm Tàn Quyển Đan Phương: **+${fmtNum(g)} EXP Đan Sư**${g === 0 ? ' (đã chạm ngưỡng — hãy Thăng cấp)' : ''}.` };
  });
}

module.exports = {
  state, levelDef, levelName, nextDef, addExp, bumpExtra, promoteInfo, promote, techFx, masteryN, masteryTier, MASTERY_NAMES, calc, qualityDist, rollQuality, catalystOf,
  cdLeft, check, start, claim, claimAll, jobsOf, historyOf, checkAch, achList, useTanQuyen, needList, activeJobs,
};
