'use strict';
/**
 * V20.0 — Giao diện tab mới của bảng Nghề Nghiệp: ⛏️ Khai Thác · 🔥 Dị Hỏa · 📋 Đơn Hàng · 📒 Sổ Tay.
 * Được ngheViews.render()/handler gọi (nhận bộ dựng chung `H` để không import vòng). Mọi nút là nút TĨNH `ng|uid|act|a|b` (sống sót khởi động lại bot).
 */
const { E } = require('../game/emoji');
const Cu = require('../game/cultivator');
const Inv = require('../game/invsvc');
const Cat = require('../game/catalog17');
const Kt = require('../game/khaithac20');
const Dh = require('../game/dihoa20');
const Od = require('../game/donhang20');
const Learn = require('../game/learn20');
const So = require('../game/so20');
const Mk = require('../game/marks20');
const X = require('../game/craft17');
const V = require('../data/v20_data');
const K = require('../game/constants');
const { fmtNum, now } = require('../util');
const { I, C } = Cat;

const ico = (k, d) => E[k] || d;
const fmtT = (s) => require('../game/format').fmtTime(s);
const realmName = (r) => K.REALMS[Math.min(K.REALMS.length - 1, r)].name;
const itn = (id) => (I.BY_ID[id] ? I.BY_ID[id].name : id);

// ---------------------------------------------------------------- Khai Thác
function viewKt(uid, a, H) {
  const { E0, cid, btn, rowOf, StringSelectMenuBuilder, optEmoji, ButtonStyle, listFit, fit } = H;
  const me = Cu.getCultivator(uid); const sel = Kt.zoneOf(a) ? a : Kt.zones()[0].id; const z = Kt.zoneOf(sel);
  const run = Kt.running(uid); const t = now();
  const lines = Kt.zones().map((q) => {
    const open = me && me.realm_index >= q.realm; const left = q.daily - Kt.usedToday(uid, q.id);
    return `${q.id === sel ? '▶️' : '▫️'} ${q.icon} **${q.name}** — ${open ? `còn ${Math.max(0, left)}/${q.daily} lượt` : `🔒 ${realmName(q.realm)}`} · ⏱ ${fmtT(q.dur)}${q.gold ? ` · 💰 ${fmtNum(q.gold)}` : ''}`;
  });
  const e = E0(`${ico('n20_khaithac', '⛏️')} Khai Thác — Mỏ & Khu Thu Thập`, 0xb45309)
    .setDescription(listFit([`Cử người đi khai thác: mỗi lượt chạy theo giờ thật (tối đa **${Kt.MAX_RUN}** lượt cùng lúc). Mỏ cho **khoáng vật + vật liệu trận đạo**, khu thu thập cho **Linh Dược + Linh Chủng + nguyên liệu yêu thú**. Mỗi khu có số lượt/ngày riêng.`, '', ...lines], 3500));
  const rv = run.map((g) => { const zz = Kt.zoneOf(g.zone); return `${zz.icon} ${zz.name}: ${g.ready_at <= t ? '✅ **xong — nhận thưởng**' : `⏳ ${fmtT(g.ready_at - t)}`}`; });
  e.addFields({ name: `${ico('n20_thuthap', '🧺')} Lượt đang chạy (${run.length}/${Kt.MAX_RUN})`, value: fit(rv.join('\n') || '_Chưa có lượt nào._', 1000, '_Chưa có._'), inline: false });
  const stNames = z.stages.map((n) => V.stage(n).name).join(' · ');
  e.addFields({ name: `${z.icon} ${z.name}`, value: fit(`Giai đoạn rơi: ${stNames}\nYêu cầu: ${realmName(z.realm)}${z.gold ? `\nPhí: ${fmtNum(z.gold)} Linh Thạch` : ''}\nVật phẩm hiếm có **trần ngày/tuần** nên không thể cày vô hạn.`, 1000) });
  const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'ktz')).setPlaceholder('Chọn khu vực…');
  sm.addOptions(Kt.zones().map((q) => ({ label: q.name, value: q.id, description: `${q.kind === 'kk' ? 'Mỏ' : 'Thu thập'} · ${fmtT(q.dur)} · ${q.daily} lượt/ngày`.slice(0, 100), emoji: optEmoji(q.icon), default: q.id === sel })));
  const c = Kt.check(uid, sel); const ready = run.some((g) => g.ready_at <= t);
  const rows = [rowOf(sm), rowOf(btn(cid(uid, 'kts', sel), 'Khai thác khu này', '⛏️', ButtonStyle.Success, !c.ok), btn(cid(uid, 'ktc', sel), 'Nhận thưởng', '🎁', ButtonStyle.Primary, !ready), btn(cid(uid, 'v', 'kt20', sel), 'Làm mới', '🔄'))];
  if (!c.ok) e.setFooter({ text: fit(c.reasons.join(' · ').replace(/\*/g, ''), 200) });
  return { e, rows };
}

// ---------------------------------------------------------------- Dị Hỏa
function viewDh(uid, a, H) {
  const { E0, cid, btn, rowOf, StringSelectMenuBuilder, optEmoji, ButtonStyle, fit } = H;
  const n = Math.min(10, Math.max(1, Number(a) || (Dh.active(uid) ? Dh.active(uid).fire_n : 1))); const S = V.stage(n);
  const mine = Dh.owned(uid); const own = Object.fromEntries(mine.map((f) => [f.fire_n, f]));
  const lines = V.STAGES.map((s) => { const f = own[s.n]; return `${s.n === n ? '▶️' : '▫️'} **${s.hoaName}** — ${f ? `Cấp ${f.lv}/${V.FIRE_MAXLV}${f.evo ? ` · Tiến Hoá ${f.evo}` : ''}${f.active ? ' · 🔥 đang dùng' : ''}` : '_chưa thu phục_'}`; });
  const e = E0(`${ico('n20_dihoa', '🔥')} Dị Hỏa của Đan Sư`, 0xdc2626).setDescription(fit(`Thu phục Dị Hỏa bằng **Hỏa Chủng** (rơi hiếm từ mỏ đặc biệt, Boss, bí cảnh). Dị Hỏa đang dùng giúp chế **đan** có giai đoạn ≤ giai đoạn của ngọn lửa: tăng tỉ lệ thành công, giảm thời gian; cấp 3/6/9 mở kĩ năng. Mỗi ngọn Tiến Hoá tối đa ${Dh.EVO_MAX} lần (tốn Linh Thạch).\n\n${lines.join('\n')}`, 3600));
  const f = own[n]; const sk = V.FIRE_SKILLS.map((k) => `${f && f.lv >= k.lv ? '✅' : '🔒'} Cấp ${k.lv} · **${k.name}**: ${k.desc}`).join('\n');
  const fx = f ? Dh.fxOf(f) : {};
  e.addFields({ name: `${S.hoaName} (${S.name})`, value: fit(f ? `Cấp **${f.lv}** · EXP ${fmtNum(f.exp)}/${f.lv >= V.FIRE_MAXLV ? '—' : fmtNum(V.fireExpNeed(f.lv))} · Tiến Hoá ${f.evo}/${Dh.EVO_MAX}\nHiệu lực: thành công +${Math.round((fx.succ || 0) * 1000) / 10}% · thời gian −${Math.round((fx.time || 0) * 1000) / 10}%${fx.qup ? ` · phẩm +${Math.round(fx.qup * 100)}%` : ''}${fx.save ? ` · hoàn liệu +${Math.round(fx.save * 100)}%` : ''}${fx.dbl ? ` · nhân đôi +${Math.round(fx.dbl * 100)}%` : ''}\n${sk}` : `Cần Đan Sư cấp **${C.LEVELS[S.lv - 1].name}**, cảnh giới ≥ **${realmName(S.band[0])}** và 1 × ${itn(V.ID.hoachung(n))} (có ${Inv.qtyAny(uid, V.ID.hoachung(n))}).\n${sk}`, 1000) });
  const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'dhz')).setPlaceholder('Chọn ngọn Dị Hỏa…');
  sm.addOptions(V.STAGES.map((s) => ({ label: s.hoaName, value: String(s.n), description: `${s.name}${own[s.n] ? ` · cấp ${own[s.n].lv}` : ''}`.slice(0, 100), emoji: optEmoji(own[s.n] ? '🔥' : '🌰'), default: s.n === n })));
  const row = f ? rowOf(btn(cid(uid, 'dhac', n), 'Dùng làm chính', '🔥', ButtonStyle.Success, f.active === 1), btn(cid(uid, 'dhev', n), `Tiến Hoá (${fmtNum(Dh.evolveCost(f))})`, '✨', ButtonStyle.Primary, f.lv < V.FIRE_MAXLV || f.evo >= Dh.EVO_MAX))
    : rowOf(btn(cid(uid, 'dhab', n), 'Thu phục', '🔥', ButtonStyle.Success, Inv.qtyAny(uid, V.ID.hoachung(n)) < 1));
  return { e, rows: [rowOf(sm), row] };
}

// ---------------------------------------------------------------- Đơn Hàng
function viewOd(uid, a, H) {
  const { E0, cid, btn, rowOf, ButtonStyle, fit } = H;
  const os = Od.ensure(uid);
  const lines = os.map((o) => `${o.state === 'done' ? '✅' : o.progress >= o.need || o.kind === 'deliver' ? '🟢' : '🔸'} **#${o.idx + 1}** ${Od.label(o)}\n　tiến độ ${o.kind === 'deliver' ? `${Math.min(o.need, Inv.qtyAny(uid, o.spec.item))}/${o.need} (trong kho)` : `${o.progress}/${o.need}`} · thưởng 💰 ${fmtNum(o.spec.rw)} + EXP nghề ${fmtNum(o.spec.ex)}`);
  const e = E0(`${ico('n20_donhang', '📋')} Đơn Hàng Nghề Nghiệp`, 0x0ea5e9).setDescription(fit(`Mỗi ngày có **${Od.PER_DAY}** đơn mới theo cảnh giới của bạn (làm mới 0h giờ VN). Chế tạo, khai thác, thu hoạch sẽ tự cộng tiến độ; đơn *Giao nguyên liệu* nhận bằng cách nộp vật phẩm. Mỗi đơn nhận thưởng **một lần**.\n\n${lines.join('\n\n')}`, 3600));
  const rows = [rowOf(...os.map((o) => btn(cid(uid, 'odc', o.idx), `Nhận đơn #${o.idx + 1}`, '🎁', ButtonStyle.Success, o.state === 'done' || (o.kind === 'deliver' ? Inv.qtyAny(uid, o.spec.item) < o.need : o.progress < o.need))), btn(cid(uid, 'v', 'od20'), 'Làm mới', '🔄'))];
  return { e, rows };
}

// ---------------------------------------------------------------- Sổ Tay
const PAGE_ORDER = ['nl', 'dp', 'bv', 'td', 'lt', 'cuon', 'tt'];
const PAGE_LABEL = { nl: 'Nguyên Liệu', dp: 'Đan Phương', bv: 'Bản Vẽ Trang Bị', td: 'Trận Đồ', lt: 'Linh Thực', cuon: 'Cuộn Thất Truyền (học)', tt: 'Danh Hiệu & Thành Tựu' };
const PAGE_ICON = { nl: '⛏️', dp: '💊', bv: '⚒️', td: '🧿', lt: '🌱', cuon: '📜', tt: '🏆' };
function viewSt(uid, a, H) {
  const { E0, cid, btn, rowOf, StringSelectMenuBuilder, optEmoji, ButtonStyle, fit, listFit } = H;
  const [p0, s0] = String(a || '').split(':'); const page = PAGE_ORDER.includes(p0) ? p0 : 'nl'; const stage = Math.min(10, Math.max(0, Number(s0 === undefined || s0 === '' ? 1 : s0) || 0));
  const e = E0(`${ico('n20_sotay', '📒')} Sổ Tay Nghề Nghiệp — ${PAGE_LABEL[page]}`, 0x7c3aed);
  const rows = [];
  let lines = []; let head = '';
  if (page === 'nl' || page === 'lt') {
    const rs = So.itemRows(page, stage); head = `${stage ? V.stage(stage).name : 'Tất cả giai đoạn'} · ${rs.length} mục — mỗi dòng cho biết **nguồn nhận** và **nơi dùng**.`;
    lines = rs.map((r) => `${require('./emo17').item(r.id)} **${r.name}** — 📍 ${(r.src.slice(0, 3).join(', ')) || '—'} · 🔧 ${(r.use.slice(0, 3).join(', ')) || '—'}`);
  } else if (page === 'dp' || page === 'bv' || page === 'td') {
    const rs = So.recipeRows(page, stage, uid); head = `${stage ? V.stage(stage).name : 'Tất cả giai đoạn'} · ${rs.length} công thức (🔒 = thất truyền, cần học bằng cuộn).`;
    lines = rs.map((r) => `${r.rare ? (r.learned ? '📖' : '🔒') : '▫️'} **${r.name}** — cấp nghề ${C.LEVELS[r.lv - 1].name}${r.rare && !r.learned ? ' · chưa học' : ''}`);
  } else if (page === 'cuon') {
    const own = Learn.scrollsOwned(uid); head = 'Cuộn Đan Phương / Trận Đồ Thất Truyền rơi rất hiếm từ Mỏ Tài Nguyên Đặc Biệt. Học 1 lần, vĩnh viễn; cuộn bị tiêu hao.';
    lines = own.map((s) => `${require('./emo17').item(s.id)} **${itn(s.id)}** ×${s.n} → ${C.RBY[s.rid].name}${s.done ? ' _(đã học — giữ cuộn)_' : ''}`);
    if (!lines.length) lines = ['_Bạn chưa có cuộn nào._'];
  } else {
    const ts = So.titlesOf(uid); head = `Danh hiệu: ${ts.filter((t) => t.done).length}/${ts.length} · Thành tựu từng nghề xem ở trang nghề.`;
    lines = ts.map((t) => `${t.done ? '🏷️' : '▫️'} **${t.name}** — ${t.desc}`);
    for (const pr of C.PROF_ORDER) { const st = X.state(uid, pr); lines.push(`${require('./emo17').prof(pr)} ${C.PROFS[pr].name}: cấp ${C.LEVELS[st.level - 1].name} · giai đoạn cao nhất ${st.ex.stage || 0}/10`); }
  }
  e.setDescription(listFit([head, '', ...lines], 3800));
  const sm = new StringSelectMenuBuilder().setCustomId(cid(uid, 'stp')).setPlaceholder('Chọn trang Sổ Tay…');
  sm.addOptions(PAGE_ORDER.map((k) => ({ label: PAGE_LABEL[k], value: k, emoji: optEmoji(PAGE_ICON[k]), default: k === page })));
  rows.push(rowOf(sm));
  if (['nl', 'dp', 'bv', 'td', 'lt'].includes(page)) {
    const ss = new StringSelectMenuBuilder().setCustomId(cid(uid, 'sts', page)).setPlaceholder('Chọn giai đoạn…');
    ss.addOptions([{ label: 'Tất cả giai đoạn', value: '0', default: stage === 0 }, ...V.STAGES.map((s) => ({ label: `${s.n}. ${s.name}`, value: String(s.n), default: s.n === stage }))]);
    rows.push(rowOf(ss));
  }
  if (page === 'cuon') {
    const own = Learn.scrollsOwned(uid).filter((s) => !s.done).slice(0, 25);
    if (own.length) { const ls = new StringSelectMenuBuilder().setCustomId(cid(uid, 'stl')).setPlaceholder('Chọn cuộn để HỌC…'); ls.addOptions(own.map((s) => ({ label: itn(s.id).slice(0, 100), value: s.id, description: `×${s.n}`, emoji: optEmoji(require('./emo17').item(s.id)) }))); rows.push(rowOf(ls)); }
  }
  return { e, rows };
}

function build(uid, v, a, b, H) {
  switch (v) {
    case 'kt20': return viewKt(uid, a, H);
    case 'dh20': return viewDh(uid, a, H);
    case 'od20': return viewOd(uid, a, H);
    default: return viewSt(uid, a, H);
  }
}
/** Xử lý hành động tĩnh của V20. Trả { view, a, note } hoặc null nếu không phải hành động V20. */
function act(u, action, a, b, sel) {
  switch (action) {
    case 'ktz': return { view: 'kt20', a: sel };
    case 'kts': { const r = Kt.start(u, a); return { view: 'kt20', a, note: r.msg }; }
    case 'ktc': { const m = Kt.collectAll(u); return { view: 'kt20', a, note: m.length ? m.join('\n\n') : '🎁 Chưa có lượt nào xong.' }; }
    case 'dhz': return { view: 'dh20', a: sel };
    case 'dhab': { const r = Dh.absorb(u, Number(a)); return { view: 'dh20', a, note: r.msg }; }
    case 'dhac': { const r = Dh.setActive(u, Number(a)); return { view: 'dh20', a, note: r.msg }; }
    case 'dhev': { const r = Dh.evolve(u, Number(a)); return { view: 'dh20', a, note: r.msg }; }
    case 'odc': { const r = Od.claim(u, Number(a)); return { view: 'od20', note: r.msg }; }
    case 'stp': return { view: 'st20', a: `${sel}:${['cuon', 'tt'].includes(sel) ? '' : 1}` };
    case 'sts': return { view: 'st20', a: `${a}:${sel}` };
    case 'stl': { const r = Learn.learn(u, sel); return { view: 'st20', a: 'cuon:', note: r.msg }; }
    default: return null;
  }
}
module.exports = { build, act, PAGE_ORDER, PAGE_LABEL };
