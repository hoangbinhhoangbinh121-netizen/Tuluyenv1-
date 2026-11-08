'use strict';
/** Lệnh admin ẨN (chỉ nhận qua tin nhắn bắt đầu bằng "!" và chỉ khi người gõ nằm trong ADMIN_DISCORD_IDS) */
const K = require('../game/constants');
const W = require('../game/sectwar');
const D = require('../db');
const { getSectName } = require('../game/sectBase');

const ADMINS = new Set(K.ADMIN_DISCORD_IDS.map(String));
const isHoangAdmin = (user) => ADMINS.has(String(user.id));
const HELP = '🕵️ **Lệnh Admin Ẩn — Tông Môn Chiến**\n(chỉ hoạt động khi gõ đúng tiền tố `!`, không phải slash command, không ai khác thấy được)\n\n' +
  '`!tongmonchien_start [nhan|linh]` — (v14.0: Nhân Giới / Linh Giới có chiến trường riêng; bỏ trống = cả hai) Ép khởi động/kích hoạt ngay trận đang "launching" ở server này (hoặc tạo trận mới và active luôn nếu chưa có trận nào), bỏ qua màn chờ.\n' +
  '`!tongmonchien_stop` — Ép kết thúc trận đang diễn ra ở server này (huỷ, KHÔNG trả thưởng).\n' +
  '`!tongmonchien_reset` — Xoá sạch trận hiện tại (nodes/participants/scores) ở server này để bắt đầu lại từ đầu.\n' +
  '`!tongmonchien_addpoint <tên tông môn> <số điểm>` — Cộng thẳng điểm cho 1 tông môn trong trận đang diễn ra.\n' +
  '`!tongmonchien_debug` — Xem trạng thái đầy đủ của trận hiện tại (debug).\n' +
  '`!restore_db` — Đính kèm 1 file .db trong CÙNG tin nhắn để GHI ĐÈ toàn bộ database hiện tại (tự sao lưu bản đang chạy trước khi ghi đè). NGUY HIỂM nếu đính nhầm file.\n' +
  '`!listdb` / `!usedb <số thứ tự>` — Xem & khôi phục từ danh sách bản sao lưu (cũng có sẵn dạng slash command).';
const HIDDEN = new Set(['!hoang', '!tongmonchien_start', '!tongmonchien_stop', '!tongmonchien_reset', '!tongmonchien_addpoint', '!tongmonchien_debug']);

/** @returns true nếu tin nhắn đã được xử lý (không cho framework xử lý tiếp) */
async function handleHiddenAdmin(message) {
  if (message.author.bot || !message.content.startsWith('!')) return false;
  const parts = message.content.trim().split(/\s+/); const cmd = parts[0].toLowerCase();
  if (!HIDDEN.has(cmd) || !isHoangAdmin(message.author)) return false; // người khác: im lặng, không lộ lệnh ẩn
  const reply = async (text) => { try { await message.author.send(text); } catch (_) { await message.channel.send(text); } };
  if (cmd === '!hoang') { await reply(HELP); return true; }
  if (!message.guild) return true;
  const gid = message.guild.id;
  // v14.0: Tông Môn Chiến có 2 chiến trường (nhan = Nhân Giới, linh = Linh Giới). Thêm `nhan` / `linh` vào cuối lệnh để chọn; bỏ trống = áp dụng cho CẢ HAI.
  const wsel = parts.find((x, idx) => idx > 0 && /^(nhan|linh)$/i.test(x));
  const worldsSel = wsel ? [/^linh$/i.test(wsel) ? 1 : 0] : [0, 1];
  const wars = worldsSel.map((w) => W.getActiveWar(gid, w)).filter(Boolean);
  const wl = (w) => W.worldLabel(w);
  if (cmd === '!tongmonchien_start') {
    const out = [];
    for (const w of worldsSel) {
      const war = W.getActiveWar(gid, w);
      if (!war) { const id = W.createWar(gid, message.channel.id, 'launching', w); W.activateWar(id); out.push(`✅ ${wl(w)}: đã tạo và kích hoạt ngay trận mới (war_id=${id}).`); }
      else if (['registration', 'launching'].includes(war.status)) { W.activateWar(war.war_id); out.push(`✅ ${wl(w)}: đã ép kích hoạt trận đang chờ (war_id=${war.war_id}).`); }
      else out.push(`ℹ️ ${wl(w)}: trận (war_id=${war.war_id}) đã đang active rồi.`);
    }
    await reply(out.join('\n')); return true;
  }
  if (cmd === '!tongmonchien_stop') {
    if (!wars.length) { await reply('❌ Không có trận nào đang diễn ra ở server này.'); return true; }
    for (const war of wars) D.run("UPDATE sect_wars SET status = 'cancelled' WHERE war_id = ?", war.war_id);
    await reply(`🛑 Đã ép dừng ${wars.map((w) => `${wl(w.world || 0)} (war_id=${w.war_id})`).join(', ')}, KHÔNG trả thưởng.`); return true;
  }
  if (cmd === '!tongmonchien_reset') {
    if (!wars.length) { await reply('❌ Không có trận nào đang diễn ra ở server này để reset.'); return true; }
    D.transaction(() => {
      for (const war of wars) {
        D.run("UPDATE sect_wars SET status = 'cancelled' WHERE war_id = ?", war.war_id);
        for (const t of ['sect_war_nodes', 'sect_war_participants', 'sect_war_scores']) D.run(`DELETE FROM ${t} WHERE war_id = ?`, war.war_id);
      }
    });
    await reply(`♻️ Đã reset sạch ${wars.map((w) => `${wl(w.world || 0)} (war_id=${w.war_id})`).join(', ')}. Dùng \`/tongmonchien\` để bắt đầu trận mới.`); return true;
  }
  if (cmd === '!tongmonchien_addpoint') {
    const args = parts.filter((x, idx) => !(idx > 0 && /^(nhan|linh)$/i.test(x)));
    if (args.length < 3) { await reply('❌ Cú pháp: `!tongmonchien_addpoint <tên tông môn> <số điểm> [nhan|linh]`'); return true; }
    const last = args[args.length - 1];
    if (!/^-?\d+$/.test(last)) { await reply('❌ Số điểm không hợp lệ.'); return true; }
    const amount = Number(last); const name = args.slice(1, -1).join(' ');
    const actives = wars.filter((w) => w.status === 'active');
    if (!actives.length) { await reply('❌ Không có trận đang active ở server này.'); return true; }
    const sect = D.get('SELECT sect_id, name FROM sects WHERE name = ?', name);
    if (!sect) { await reply(`❌ Không tìm thấy tông môn **${name}**.`); return true; }
    const war = actives.find((w) => D.get('SELECT 1 x FROM sect_war_participants WHERE war_id = ? AND sect_id = ?', w.war_id, sect.sect_id)) || actives[0];
    D.run('INSERT INTO sect_war_scores (war_id, sect_id, points) VALUES (?, ?, ?) ON CONFLICT(war_id, sect_id) DO UPDATE SET points = points + excluded.points', war.war_id, sect.sect_id, amount);
    await reply(`✅ Đã cộng **${amount}** điểm cho **${sect.name}** (${wl(war.world || 0)}, war_id=${war.war_id}).`); return true;
  }
  if (cmd === '!tongmonchien_debug') {
    if (!wars.length) { await reply('ℹ️ Không có trận nào (launching/active) ở server này.'); return true; }
    const lines = [];
    for (const war of wars) {
      const nodes = W.getWarNodes(war.war_id); const scores = W.getWarScores(war.war_id);
      const n = D.get('SELECT COUNT(*) c FROM sect_war_participants WHERE war_id = ?', war.war_id).c;
      lines.push(`🔧 **Debug ${wl(war.world || 0)} war_id=${war.war_id}** — status=\`${war.status}\``, `Kênh: <#${war.channel_id}> | Người tham chiến: ${n}`);
      if (war.status === 'active') lines.push(`Còn lại: ${W.fmtTimeLeft(war.ends_at - Date.now() / 1000)}`);
      for (const key of W.NODE_ORDER) { const nd = nodes[key]; lines.push(`• ${W.NODES[key].name}: chủ=${nd && nd.owner_sect_id ? getSectName(nd.owner_sect_id) : 'Trung Lập'}`); }
      if (Object.keys(scores).length) lines.push('Điểm: ' + Object.entries(scores).map(([s2, p2]) => `${getSectName(s2)}=${p2}`).join(', '));
    }
    await reply(lines.join('\n')); return true;
  }
  return false;
}
module.exports = { handleHiddenAdmin, isHoangAdmin };
