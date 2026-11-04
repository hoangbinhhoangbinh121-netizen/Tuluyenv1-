'use strict';
/** Sao lưu / khôi phục database + thu hồi linh thạch (chỉ ADMIN_CODE_APPROVER_IDS). */
const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { defineCommand } = require('./framework');
const D = require('../db');
const { mergeOldDb, isSqlite } = require('../db/importOld');
const Cu = require('../game/cultivator');
const { E } = require('../game/emoji');
const { View } = require('../ui/kit');
const { fmtNum } = require('../util');

const backupDir = () => { const d = path.join(path.dirname(D.DB_PATH), 'db_backups'); fs.mkdirSync(d, { recursive: true }); return d; };
const stamp = () => { const n = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}${p(n.getSeconds())}`; };

/** Sao lưu NHẤT QUÁN (kể cả khi đang ở chế độ WAL) bằng VACUUM INTO — không cần dừng bot. */
function makeBackup(destPath) {
  const G = require('../db/diskguard');
  if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  if (!G.canBackup()) { G.pruneBackups(); if (!G.canBackup()) throw new Error(`Ổ đĩa sắp đầy, không đủ chỗ sao lưu (${G.report().text})`); }
  try { D.db().exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`); }
  catch (e) { try { fs.unlinkSync(destPath); } catch (_) { /* file dở dang → xoá để khỏi chiếm chỗ */ } throw e; }
  return destPath;
}
function listBackups() {
  const dir = backupDir();
  return fs.readdirSync(dir).filter((f) => /^tutien_.*\.db$/.test(f)).map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}
function fmtEntry(p) {
  try {
    const st = fs.statSync(p); const d = new Date(st.mtimeMs); const pad = (x) => String(x).padStart(2, '0');
    const ts = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} — ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const kind = path.basename(p).includes('PRE_RESTORE') ? '🛡️ tự động (trước khi restore)' : '💾 thủ công (backupdb)';
    const size = st.size >= 1048576 ? `${(st.size / 1048576).toFixed(1)} MB` : `${(st.size / 1024).toFixed(1)} KB`;
    return `\`${path.basename(p)}\` — ${ts} — ${size} — ${kind}`;
  } catch (_) { return `\`${path.basename(p)}\` — (không đọc được thông tin file)`; }
}
/** Ghi đè DB bằng file khác. Đóng kết nối trước, xoá -wal/-shm, mở lại + migrate. */
function replaceDb(srcPath) {
  if (fs.existsSync(D.DB_PATH)) makeBackup(path.join(backupDir(), `tutien_PRE_RESTORE_${stamp()}.db`));
  D.closeDb();
  fs.copyFileSync(srcPath, D.DB_PATH);
  for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(D.DB_PATH + ext); } catch (_) { /* không có */ } }
  D.initDb();
}

defineCommand({
  name: 'backupdb', description: '[Admin] Sao lưu database hiện tại', admin: true,
  async run(ctx) {
    if (!fs.existsSync(D.DB_PATH)) return ctx.send('❌ Không tìm thấy file database.');
    let p;
    try { p = makeBackup(path.join(backupDir(), `tutien_${stamp()}.db`)); require('../db/diskguard').pruneBackups(); }
    catch (e) { return ctx.send(`❌ Không sao lưu được: ${e.message}`.slice(0, 1900)); }
    try { return await ctx.send({ content: `✅ Đã sao lưu database vào \`${p}\`.`, files: [new AttachmentBuilder(p)] }); }
    catch (_) { return ctx.send(`✅ Đã sao lưu database vào \`${p}\` (file quá lớn để đính kèm qua Discord).`); }
  },
});

defineCommand({
  name: 'dungluong', description: '[Admin] Xem dung lượng DB / bản sao lưu / ổ đĩa và dọn bản sao lưu thừa', admin: true,
  async run(ctx) {
    const G = require('../db/diskguard');
    const before = G.report();
    const freed = G.pruneBackups();
    const note = before.free != null && before.free < 100 * 1048576 ? '\n⚠️ Ổ đĩa gần đầy — hãy xoá bớt file trong tab Files của host hoặc nâng gói.' : '';
    return ctx.send(`${G.fullReport()}\n🧹 Đã dọn bản sao lưu thừa: giải phóng ${G.fmt(freed)}.${note}`.slice(0, 1990));
  },
});

defineCommand({
  name: 'restore_db', description: '[Admin] Khôi phục database từ file .db đính kèm, hoặc bản sao lưu gần nhất', admin: true,
  options: [{ name: 'file', type: 'attachment', description: 'File .db cần khôi phục (bỏ trống = bản sao lưu gần nhất)' }],
  async run(ctx) {
    const att = ctx.attachments[0];
    let desc;
    if (att) {
      if (!att.name.toLowerCase().endsWith('.db')) return ctx.send('❌ File đính kèm phải là file `.db` (đúng file database, không phải zip/khác).');
      const res = await fetch(att.url);
      if (!res.ok) return ctx.send('❌ Không tải được file đính kèm.');
      const tmp = path.join(backupDir(), `_upload_${stamp()}.db`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.subarray(0, 16).toString('latin1') !== 'SQLite format 3\u0000') return ctx.send('❌ File đính kèm không phải file SQLite hợp lệ (sai header). Đã huỷ, KHÔNG ghi đè gì cả.');
      fs.writeFileSync(tmp, buf);
      try { replaceDb(tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) { /* initDb→pruneBackups đã xoá file tạm */ } }
      desc = `file đính kèm \`${att.name}\``;
    } else {
      const cands = listBackups().filter((p) => !p.includes('PRE_RESTORE'));
      if (!cands.length) return ctx.send('❌ Không có bản sao lưu nào và cũng không có file đính kèm. Chạy `/backupdb` trước.');
      replaceDb(cands[0]);
      desc = `bản sao lưu gần nhất \`${path.basename(cands[0])}\``;
    }
    return ctx.send(`✅ Đã khôi phục database từ ${desc}.\n⚠️ Nên khởi động lại bot ngay sau lệnh này để chắc chắn mọi lệnh đọc đúng dữ liệu mới.`);
  },
});

defineCommand({
  name: 'nhapdb', description: '[Admin] Nhập TOÀN BỘ dữ liệu từ file .db cũ vào bot (không cần khởi động lại)', admin: true,
  options: [
    { name: 'file', type: 'attachment', required: true, description: 'File .db của bản cũ (vd tutien_xxx.db)' },
    { name: 'chedo', type: 'string', description: 'ghep = dữ liệu cũ đè lên (mặc định) · bosung = chỉ thêm phần còn thiếu',
      choices: [{ name: 'ghep — dữ liệu cũ đè lên, giữ phần mới', value: 'ghep' }, { name: 'bosung — chỉ thêm phần chưa có', value: 'bosung' }] },
  ],
  async run(ctx) {
    const att = ctx.attachments[0];
    if (!att) return ctx.send('❌ Hãy đính kèm file `.db` cần nhập.');
    if (!att.name.toLowerCase().endsWith('.db')) return ctx.send('❌ File đính kèm phải là file `.db` (không phải zip/khác).');
    const mode = ctx.args.chedo === 'bosung' ? 'bosung' : 'ghep';
    const res = await fetch(att.url);
    if (!res.ok) return ctx.send('❌ Không tải được file đính kèm.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isSqlite(buf)) return ctx.send('❌ File không phải SQLite hợp lệ (sai header). Đã huỷ, KHÔNG thay đổi gì.');
    const tmp = path.join(backupDir(), `_import_${stamp()}.db`);
    fs.writeFileSync(tmp, buf);
    let rep;
    try {
      if (fs.existsSync(D.DB_PATH)) makeBackup(path.join(backupDir(), `tutien_PRE_IMPORT_${stamp()}.db`));
      rep = mergeOldDb(tmp, mode);
    } catch (e) {
      return ctx.send(`❌ Nhập thất bại, dữ liệu hiện tại KHÔNG bị thay đổi: ${e.message}`);
    } finally { try { fs.unlinkSync(tmp); } catch (_) { /* bỏ qua */ } }
    const top = rep.tables.filter((t) => t.rows).sort((a, b) => b.rows - a.rows).slice(0, 12).map((t) => `• \`${t.name}\`: ${fmtNum(t.rows)} dòng`);
    const n = D.get('SELECT COUNT(*) c FROM cultivators').c;
    const lines = [`✅ Đã nhập dữ liệu cũ (${mode === 'bosung' ? 'chỉ bổ sung' : 'ghép, dữ liệu cũ đè lên'}) từ \`${att.name}\`.`,
      `Tổng ${fmtNum(rep.rows)} dòng từ ${rep.tables.length} bảng · hiện có ${fmtNum(n)} nhân vật.`, ...top];
    if (rep.failed.length) lines.push(`⚠️ Bảng lỗi (đã bỏ qua): ${rep.failed.join('; ').slice(0, 400)}`);
    if (rep.skipped.length) lines.push(`ℹ️ Bảng không còn dùng: ${rep.skipped.join(', ').slice(0, 200)}`);
    lines.push('🛡️ Bản sao lưu trước khi nhập: `tutien_PRE_IMPORT_*.db` (xem `/listdb`, khôi phục bằng `/usedb`).');
    return ctx.send(lines.join('\n').slice(0, 1990));
  },
});

defineCommand({
  name: 'listdb', description: '[Admin] Xem danh sách các bản sao lưu database đã lưu', admin: true,
  async run(ctx) {
    const b = listBackups();
    if (!b.length) return ctx.send('ℹ️ Chưa có bản sao lưu nào. Dùng `/backupdb` để tạo bản đầu tiên.');
    const lines = ['🗂️ **Danh sách bản sao lưu database** (mới nhất trước tiên):', ...b.map((p, i) => `**${i + 1}.** ${fmtEntry(p)}`),
      '\nDùng `/usedb <số thứ tự>` để chọn khôi phục (sẽ hỏi xác nhận trước khi ghi đè).'];
    return ctx.send(lines.join('\n').slice(0, 1990));
  },
});

defineCommand({
  name: 'usedb', description: '[Admin] Khôi phục database từ 1 bản sao lưu trong /listdb', admin: true,
  options: [{ name: 'so_thu_tu', type: 'int', required: true, description: 'Số thứ tự trong /listdb (1 = mới nhất)' }],
  async run(ctx) {
    const b = listBackups(); const n = ctx.args.so_thu_tu;
    if (!n || n < 1 || n > b.length) return ctx.send(`❌ Số thứ tự không hợp lệ. Hiện có ${b.length} bản sao lưu — dùng \`/listdb\` để xem lại.`);
    const chosen = b[n - 1];
    const emb = new EmbedBuilder().setTitle('⚠️ Xác nhận khôi phục database').setColor(0xe67e22).setDescription(
      `Bạn sắp GHI ĐÈ database hiện tại bằng bản sao lưu:\n${fmtEntry(chosen)}\n\nBản đang chạy sẽ được tự động sao lưu trước khi ghi đè, nhưng mọi thay đổi từ SAU thời điểm bản sao lưu này sẽ MẤT.\n\nBạn có chắc chắn muốn tiếp tục?`);
    const v = new View({ ownerId: ctx.user.id, timeout: 60 });
    let done = false;
    const finish = async (i, text) => { done = true; v.disableAll(); await i.update({ content: text, embeds: [], components: v.components() }); v.stop(); };
    v.button({ key: 'ok', label: 'Xác nhận', emoji: E.xacnhan, style: 'danger' }, async (i) => {
      if (done) return;
      if (!fs.existsSync(chosen)) return finish(i, `❌ File \`${path.basename(chosen)}\` không còn tồn tại. Đã huỷ.`);
      try { replaceDb(chosen); } catch (e) { return finish(i, `❌ Lỗi khi khôi phục: ${e.message}`); }
      return finish(i, `✅ Đã khôi phục database từ \`${path.basename(chosen)}\`.\n⚠️ Nên khởi động lại bot ngay sau lệnh này.`);
    });
    v.button({ key: 'no', label: 'Không', emoji: E.tuchoi, style: 'secondary' }, (i) => (done ? null : finish(i, 'Đã huỷ, không có gì thay đổi.')));
    return ctx.send({ embeds: [emb], components: v.components() });
  },
});

defineCommand({
  name: 'thuhoilinhthach', description: '[Admin] Thu hồi bớt Linh Thạch của 1 thành viên về đúng 1 mốc cố định', admin: true,
  options: [{ name: 'thanh_vien', type: 'user', required: true, description: 'Thành viên' }, { name: 'giu_lai', type: 'int', required: true, description: 'Số Linh Thạch giữ lại' }],
  async run(ctx) {
    const u = ctx.args.thanh_vien; const keep = ctx.args.giu_lai;
    const row = u && Cu.getCultivator(u.id);
    if (!row) return ctx.send(`❌ <@${u?.id}> chưa bắt đầu tu tiên.`);
    if (!(keep >= 0)) return ctx.send('❌ Số Linh Thạch giữ lại phải >= 0.');
    Cu.updateCultivator(u.id, { linh_thach: keep });
    return ctx.send(`✅ Đã thu hồi ${E.linhthach} Linh Thạch của <@${u.id}>: **${fmtNum(row.linh_thach)}** → **${fmtNum(keep)}** (vật phẩm giữ nguyên).`);
  },
});

defineCommand({
  name: 'loigannhat', description: '[Admin] Xem các lỗi gần nhất của bot (kèm mã lỗi người chơi báo)', admin: true,
  options: [{ name: 'ma_loi', type: 'string', description: 'Mã lỗi cần xem chi tiết (bỏ trống = danh sách)' }],
  async run(ctx) {
    const { getRecent } = require('../errorlog');
    const list = getRecent();
    if (!list.length) return ctx.send('✅ Chưa ghi nhận lỗi nào kể từ lần khởi động gần nhất.');
    const code = (ctx.args.ma_loi || '').trim().toLowerCase();
    if (code) {
      const e = list.find((x) => x.code === code);
      return ctx.send(e ? `**[${e.code}]** ${e.where}\n\`\`\`\n${e.msg.slice(0, 1700)}\n\`\`\`` : '❌ Không có lỗi mang mã này (chỉ giữ 20 lỗi gần nhất).');
    }
    return ctx.send(`🧾 **${list.length} lỗi gần nhất** (mới nhất trước):\n` + list.slice(0, 10).map((e) => `• \`${e.code}\` — ${e.where} — <t:${Math.trunc(e.at / 1000)}:R>`).join('\n') + '\nDùng `/loigannhat ma_loi:<mã>` để xem chi tiết. File đầy đủ: `logs/error.log`.');
  },
});

module.exports = { makeBackup, listBackups };
