'use strict';
/**
 * V20.0 — KHAI THÁC (mỏ khoáng vật & khu thu thập). Mỗi lượt có thời gian thật; nhận thưởng bằng 1 UPDATE có điều kiện nên bấm dồn không nhân đôi.
 * Giới hạn: tối đa 2 lượt đang chạy · số lượt/ngày theo từng khu · cảnh giới tối thiểu · (vài khu) phí Linh Thạch. Vật phẩm hiếm có trần ngày/tuần trong bảng rơi.
 */
const D = require('../db');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const X = require('./craft17');
const Drops = require('./drops17');
const { C } = Cat;
const { now, int, fmtNum } = require('../util');
const { Delta } = Cu;

const uid = (u) => String(u);
const MAX_RUN = 2;
const fmtT = (s) => require('./format').fmtTime(s);
const zones = () => C.ZONES;
const zoneOf = (id) => C.ZONES.find((z) => z.id === id);
const running = (user) => D.all("SELECT * FROM v20_gather WHERE user_id = ? AND state = 'run' ORDER BY ready_at", uid(user));
const usedToday = (user, zid) => Inv.dailyGet(user, `kt20:${zid}`);
function check(user, zid) {
  const z = zoneOf(zid); if (!z) return { ok: false, reasons: ['Khu vực không tồn tại.'] };
  const me = Cu.getCultivator(user); const reasons = []; if (!me) return { ok: false, reasons: ['Bạn chưa bắt đầu tu tiên.'] };
  if (me.realm_index < z.realm) reasons.push(`Cần cảnh giới ≥ **${require('./constants').REALMS[z.realm].name}**`);
  if (usedToday(user, zid) >= z.daily) reasons.push(`Hôm nay đã khai thác đủ ${z.daily} lượt ở đây`);
  if (running(user).length >= MAX_RUN) reasons.push(`Đang có ${MAX_RUN} lượt chạy — nhận thưởng trước`);
  if (z.gold && me.linh_thach < z.gold) reasons.push(`Thiếu phí khai thác ${fmtNum(z.gold)} Linh Thạch`);
  return { ok: !reasons.length, reasons, z };
}
function start(user, zid) {
  return D.transaction(() => {
    const c = check(user, zid); if (!c.ok) return { ok: false, msg: `❌ Không thể khai thác:\n• ${c.reasons.join('\n• ')}` };
    const z = c.z;
    if (z.gold && !Cu.updateCultivator(user, { linh_thach: new Delta(-z.gold) }, { linh_thach: z.gold })) return { ok: false, msg: Cu.MSG_BALANCE_CHANGED };
    Inv.dailyAdd(user, `kt20:${zid}`, 1);
    const r = D.run("INSERT INTO v20_gather (user_id, zone, started_at, ready_at, state) VALUES (?,?,?,?,'run')", uid(user), zid, now(), now() + z.dur);
    return { ok: true, id: r.lastInsertRowid, msg: `⛏️ Bắt đầu **${z.name}** — xong sau **${fmtT(z.dur)}**.${z.gold ? ` (−${fmtNum(z.gold)} Linh Thạch)` : ''}` };
  });
}
function collect(user, id) {
  const g = D.get('SELECT * FROM v20_gather WHERE id = ? AND user_id = ?', int(id), uid(user));
  if (!g) return { ok: false, msg: 'Không tìm thấy lượt khai thác.' };
  if (g.state !== 'run') return { ok: false, msg: 'Lượt này đã nhận rồi.' };
  if (g.ready_at > now()) return { ok: false, msg: `⏳ Chưa xong — còn **${fmtT(g.ready_at - now())}**.` };
  return D.transaction(() => {
    if (D.run("UPDATE v20_gather SET state = 'done' WHERE id = ? AND user_id = ? AND state = 'run' AND ready_at <= ?", g.id, uid(user), now()).changes === 0) return { ok: false, msg: 'Lượt này đã nhận rồi.' };
    const z = zoneOf(g.zone); const rl = Drops.roll(user, `kt20_${z.id}`);
    D.run('UPDATE v20_gather SET result = ? WHERE id = ?', JSON.stringify(rl.got), g.id);
    const S = require('./so20'); S.addStat(user, 'gather', 1);
    const prof = z.kind === 'kk' ? 'khi' : 'thuc'; const sm = z.stages[z.stages.length - 1];
    const ex = X.addExp(user, prof, 6 * 2 ** (sm - 1));
    const od = require('./donhang20').bump(user, 'gather', 1, { zone: z.id });
    const tt = S.checkTitles(user);
    D.run("DELETE FROM v20_gather WHERE user_id = ? AND state = 'done' AND id NOT IN (SELECT id FROM v20_gather WHERE user_id = ? ORDER BY id DESC LIMIT 30)", uid(user), uid(user));
    return { ok: true, got: rl.got, msg: `🎒 Hoàn thành **${z.name}**.${rl.text || '\n(Không thu được gì.)'}\n📈 +${fmtNum(ex)} EXP ${C.PROFS[prof].name}${od}${tt}` };
  });
}
function collectAll(user) { const out = []; for (const g of running(user)) if (g.ready_at <= now()) { const r = collect(user, g.id); if (r.msg) out.push(r.msg); } return out; }
module.exports = { MAX_RUN, zones, zoneOf, running, usedToday, check, start, collect, collectAll };
