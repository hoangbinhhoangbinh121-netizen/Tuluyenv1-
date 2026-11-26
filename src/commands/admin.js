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
  name: 'dungluong', description: '[Admin] Xem dung lượng DB / bản sao lưu / ổ đĩa và dọn bản sao lưu thừa', admin: true, prefixOnly: true,   // v21.5: nhường slot cho /chungtoc
  async run(ctx) {
    const G = require('../db/diskguard');
    const before = G.report();
    const freed = G.pruneBackups();
    const note = before.free != null && before.free < 100 * 1048576 ? '\n⚠️ Ổ đĩa gần đầy — hãy xoá bớt file trong tab Files của host hoặc nâng gói.' : '';
    return ctx.send(`${G.fullReport()}\n🧹 Đã dọn bản sao lưu thừa: giải phóng ${G.fmt(freed)}.${note}`.slice(0, 1990));
  },
});

defineCommand({
  name: 'socai', description: '[Admin] Xem Sổ Cái tiền tệ (Linh Thạch/Linh Tinh) của 1 người chơi — 15 dòng gần nhất', admin: true, prefixOnly: true,
  options: [{ name: 'thanh_vien', type: 'user', description: 'Người chơi' }, { name: 'id', type: 'string', description: 'Hoặc ID Discord' }],
  async run(ctx) {
    const raw = ctx.args.thanh_vien ? ctx.args.thanh_vien.id : String(ctx.args.id || '').replace(/[^\d]/g, ''); const LG = require('../game/ledger');
    if (!raw || !require('../game/cultivator').getCultivator(raw)) return ctx.send('❌ Cú pháp: `!socai @người` hoặc `!socai <ID>` (người này phải đã tu tiên).');
    const rows = LG.recent(raw, 15); const sm = LG.summary(raw); const f = (n) => Number(n).toLocaleString('vi-VN');
    return ctx.send([`📒 **Sổ Cái** <@${raw}> — ${f(sm.count)} dòng (Linh Thạch: +${f(sm.in)} / −${f(sm.out)}).`, '_Chỉ gồm các dòng tiền đã nối vào sổ: đổi tộc, NPC mua/bán, bán trang bị, giao dịch, admin._',
      ...(rows.length ? rows.map((r) => `\`#${r.entry_id}\` <t:${r.created_at}:d> ${r.delta > 0 ? '🟢 +' : '🔴 '}${f(r.delta)} ${r.currency === 'linh_tinh' ? 'LTinh' : 'LT'} → ${f(r.balance_after)} · ${r.reason}${r.ref ? ` (${r.ref})` : ''}`) : ['(chưa có dòng nào)'])].join('\n').slice(0, 1900));
  },
});

defineCommand({
  name: 'kernel', description: '[Admin] Combat Kernel V22.0: bật/tắt hiệu ứng + kỹ năng tộc cho Boss / Bí Cảnh / Chứng Đạo / Tông Chiến', admin: true, prefixOnly: true,
  options: [{ name: 'he_thong', type: 'string', description: 'boss | bicanh | chungdao | tongchien | all | foe | race | cd_<hệ thống> (bỏ trống = xem)' }, { name: 'gia_tri', type: 'string', description: 'kernel | legacy (với all: on|off · foe: 0–50 · race: on|off)' }],
  async run(ctx) {
    const ST = require('../game/settings'); const KN = require('../game/combatKernel'); const k = String(ctx.args.he_thong || '').trim().toLowerCase(); const v = String(ctx.args.gia_tri || '').trim().toLowerCase();
    const show = () => [`🧩 **Combat Kernel V22.1** (đổi: \`!kernel <hệ thống> kernel|legacy\`)`, ...KN.SYSTEMS.map((x) => `• ${KN.SYS_NAME[x]} (\`${x}\`): **${KN.mode(x)}**`),
      `• Cắt khẩn cấp \`all\`: **${ST.get('kernel_all', 'on')}** (off = mọi hệ thống về legacy)`, `• \`foe\` (Thiêu Đốt/độc lên kẻ địch PvE = % một đòn điển hình): **${KN.foePct()}**`, `• \`race\` (kỹ năng tộc tự phát): **${ST.get('kernel_race_auto', 'off')}** (off = người chơi bấm nút Kỹ Năng Tộc)`, `• Hồi chiêu kỹ năng tộc nhân (\`cd_<hệ thống>\`): ${KN.SYSTEMS.map((x) => `${x} ×${KN.cdMult(x)}`).join(' · ')}`].join('\n');
    if (!k) return ctx.send(show());
    if (KN.SYSTEMS.includes(k)) { if (!['kernel', 'legacy'].includes(v)) return ctx.send('❌ Giá trị: `kernel` hoặc `legacy`.'); ST.set(`kernel_${k}`, v); return ctx.send(`✅ ${KN.SYS_NAME[k]} = **${v}** (áp dụng ngay cho lượt đánh kế tiếp; trận đang dở giữ hiệu ứng đã có).`); }
    if (k === 'all') { if (!['on', 'off'].includes(v)) return ctx.send('❌ Giá trị: `on` hoặc `off`.'); ST.set('kernel_all', v); return ctx.send(`✅ kernel_all = **${v}**.`); }
    if (k.startsWith('cd_') && KN.SYSTEMS.includes(k.slice(3))) { if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 100) return ctx.send('❌ Giá trị: số nguyên 1–100.'); ST.set(`kernel_${k}`, v); return ctx.send(`✅ Hồi chiêu kỹ năng tộc ở ${KN.SYS_NAME[k.slice(3)]} = ×**${v}**.`); }
    if (k === 'race') { if (!['on', 'off'].includes(v)) return ctx.send('❌ Giá trị: `on` hoặc `off`.'); ST.set('kernel_race_auto', v); return ctx.send(`✅ kỹ năng tộc tự phát = **${v}** (mặc định off: người chơi tự bấm nút).`); }
    if (k === 'foe') { if (!/^\d+$/.test(v) || Number(v) > 50) return ctx.send('❌ Giá trị: số nguyên 0–50.'); ST.set('kernel_foe_dot_pct', v); return ctx.send(`✅ kernel_foe_dot_pct = **${v}**.`); }
    return ctx.send(`❌ Không hợp lệ.\n${show()}`);
  },
});

const PVP_KEYS = { pvp_hp_mode: ['real', 'norm'], pvp_hp_exp_pct: [5, 100], pvp_hp_lo_pct: [30, 100], pvp_hp_hi_pct: [100, 300], pvp_regen_permille: [0, 100], pvp_resume_window: [0, 86400], pvp_effects_mode: ['real', 'log'], pvp_killmove_cd: [0, 10] };
defineCommand({
  name: 'pvpset', description: '[Admin] Xem / đổi cấu hình PvP: HP thật, hồi phục, cửa sổ khôi phục trận, hiệu ứng, hồi chiêu Sát Chiêu', admin: true, prefixOnly: true,
  options: [{ name: 'khoa', type: 'string', description: 'Tên cấu hình (bỏ trống = xem tất cả)' }, { name: 'gia_tri', type: 'string', description: 'Giá trị mới' }],
  async run(ctx) {
    const ST = require('../game/settings'); const k = String(ctx.args.khoa || '').trim(); const v = String(ctx.args.gia_tri || '').trim();
    const show = () => Object.entries(PVP_KEYS).map(([key, r]) => `• \`${key}\` = **${ST.get(key, '(mặc định)')}** _(${typeof r[0] === 'string' ? r.join(' | ') : `${r[0]}–${r[1]}`})_`).join('\n');
    if (!k) return ctx.send(`⚙️ **Cấu hình PvP** (đổi: \`!pvpset <khoá> <giá trị>\`)\n${show()}`);
    const r = PVP_KEYS[k]; if (!r) return ctx.send(`❌ Khoá không hợp lệ. Có: ${Object.keys(PVP_KEYS).map((x) => `\`${x}\``).join(', ')}`);
    if (!v) return ctx.send(`❌ Thiếu giá trị. Hiện tại \`${k}\` = **${ST.get(k, '(mặc định)')}**.`);
    if (typeof r[0] === 'string' ? !r.includes(v) : !(/^\d+$/.test(v) && Number(v) >= r[0] && Number(v) <= r[1])) return ctx.send(`❌ Giá trị phải ${typeof r[0] === 'string' ? `là ${r.join(' hoặc ')}` : `từ ${r[0]} đến ${r[1]}`}.`);
    ST.set(k, v); return ctx.send(`✅ \`${k}\` = **${v}** (áp dụng cho trận mới).`);
  },
});

defineCommand({
  name: 'phienban', description: '[Admin] Xem mã bản (ID), phiên bản, host của bot đang trả lời — để phát hiện 2 bản bot chạy cùng token', admin: true, prefixOnly: true,
  async run(ctx) {
    const I = require('../instance').info(); const dup = require('../errorlog').getDup();
    return ctx.send([`🆔 **Bản bot đang trả lời:** \`${I.id}\` · phiên bản **v${I.version}**`, `🖥️ Host \`${I.host}\` · PID ${I.pid} · Node ${I.node} · RAM ${I.rssMb} MB`, `🕒 Chạy liên tục từ <t:${I.bootAt}:R>`,
      dup.count ? `🚨 Đã gặp **${dup.count}** lần "đã có bản khác trả lời trước" (40060), lần cuối <t:${Math.trunc(dup.last / 1000)}:R>.` : '✅ Chưa thấy dấu hiệu bản khác cùng trả lời.',
      '👉 Gõ lệnh này **3–4 lần liên tiếp**: nếu ra **nhiều tin trả lời** hoặc **ID / phiên bản khác nhau** ⇒ đang có bản bot khác chạy cùng token. Cách dứt điểm: Developer Portal → Bot → **Reset Token**, rồi chỉ dán token mới vào MỘT nơi (VibeHost).'].join('\n'));
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
  name: 'phatcongphap', description: '[Admin] Sự Kiện Đặc Biệt: cấp 1 Công Pháp V16 (mã 1001–1055, mặc định 1039 Càn Khôn Trấn Giới Kinh) cho 1 thành viên', admin: true,
  options: [{ name: 'thanh_vien', type: 'user', required: true, description: 'Thành viên nhận' }, { name: 'ma', type: 'int', description: 'Mã công pháp 1001–1055 (bỏ trống = 1039)' }],
  async run(ctx) {
    const u = ctx.args.thanh_vien; const tier = ctx.args.ma || 1039;
    if (!u || !Cu.getCultivator(u.id)) return ctx.send(`❌ <@${u?.id}> chưa bắt đầu tu tiên.`);
    const CP16 = require('../game/congphapV16');
    if (!CP16.isNew(tier)) return ctx.send('❌ Mã công pháp phải nằm trong 1001–1055.');
    return ctx.send(`${CP16.grantEvent(u.id, tier)} (người nhận: <@${u.id}>)`);
  },
});

defineCommand({
  name: 'loigannhat', description: '[Admin] Xem các lỗi gần nhất của bot (kèm mã lỗi người chơi báo)', admin: true,
  options: [{ name: 'ma_loi', type: 'string', description: 'Mã lỗi cần xem chi tiết (bỏ trống = danh sách)' }],
  async run(ctx) {
    const { getRecent } = require('../errorlog');
    const list = getRecent();
    const st = require('../errorlog').getStale();   // v14.5: lượt bấm hết hạn (10062) — không tính là lỗi code
    const staleNote = st.count ? `\n⏱️ Có **${st.count}** lượt bấm bị hết hạn (bot trả lời >3s, lần cuối <t:${Math.trunc(st.last / 1000)}:R>) — do host/mạng chậm hoặc vòng lặp bị chặn; xem console để biết "🐢 Vòng lặp bị chặn".` : '';
    const nt = require('../errorlog').getNet();   // v21.6: lỗi mạng/DNS tạm thời — không phải lỗi code
    const dupN = require('../errorlog').getDup(); const dupNote = dupN.count ? `\n🚨 **${dupN.count}** lần "đã có bản bot khác trả lời trước" (40060) — nghi đang chạy 2 bản bot cùng token, gõ \`!phienban\` nhiều lần để kiểm tra.` : '';
    const upNote = dupNote + `\n🕒 Bot chạy liên tục từ <t:${require('../ui/kit').BOOT_AT}:R> (khởi động lại = mọi menu/biểu mẫu cũ báo "không còn").`;
    const netNote = upNote + (nt.count ? `\n🌐 Có **${nt.count}** lần mạng/DNS chập chờn (${nt.lastCode}, lần cuối <t:${Math.trunc(nt.last / 1000)}:R>) — do host/mạng, không phải lỗi game; bot tự thử lại khi gửi tin. Nếu liên tục: kiểm tra mạng của host (VibeHost) hoặc khởi động lại.` : '');
    if (!list.length) return ctx.send(`✅ Chưa ghi nhận lỗi nào kể từ lần khởi động gần nhất.${staleNote}${netNote}`);
    const code = (ctx.args.ma_loi || '').trim().toLowerCase();
    if (code) {
      const e = list.find((x) => x.code === code);
      return ctx.send(e ? `**[${e.code}]** ${e.where}\n\`\`\`\n${e.msg.slice(0, 1700)}\n\`\`\`` : '❌ Không có lỗi mang mã này (chỉ giữ 20 lỗi gần nhất).');
    }
    return ctx.send(`🧾 **${list.length} lỗi gần nhất** (mới nhất trước):\n` + list.slice(0, 10).map((e) => `• \`${e.code}\` — ${e.where} — <t:${Math.trunc(e.at / 1000)}:R>`).join('\n') + staleNote + netNote + '\nDùng `/loigannhat ma_loi:<mã>` để xem chi tiết. File đầy đủ: `logs/error.log`.');
  },
});

module.exports = { makeBackup, listBackups };

// v22.2 — ẩn / xoá một người khỏi bảng xếp hạng + công tắc bật/tắt
defineCommand({
  name: 'bxh', description: '[Admin] Ẩn hoặc xoá một người khỏi bảng xếp hạng; bật/tắt tính năng ẩn (an | xoa | hien | ds | bat | tat)', anyAdmin: true, prefixOnly: true,
  options: [{ name: 'hanh_dong', type: 'string', description: 'an | xoa | hien | ds | bat | tat (bỏ trống = hướng dẫn)' }, { name: 'thanh_vien', type: 'user', description: 'Người chơi (@ hoặc ID)' }],
  async run(ctx) {
    const LB = require('../game/lbHide'); const a = String(ctx.args.hanh_dong || '').trim().toLowerCase();
    const help = () => ['🏆 **Ẩn / xoá khỏi bảng xếp hạng** — chỉ admin', `Tính năng đang: **${LB.enabled() ? 'BẬT' : 'TẮT'}** · đang ẩn/xoá: **${LB.list().length}** người`,
      '`!bxh an @người [lý do]` — **ẩn**: không hiện ở bảng, dữ liệu giữ nguyên.', '`!bxh xoa @người [lý do]` — **xoá**: ẩn + gỡ điểm xếp hạng đã lưu (thành tích Siêu Thoát, sát thương Boss đã kết thúc); có bản sao để khôi phục.',
      '`!bxh hien @người` — hiện lại + khôi phục điểm đã gỡ · `!bxh ds` — danh sách', '`!bxh tat` / `!bxh bat` — tắt/bật cả tính năng (tắt = mọi người hiện lại, dữ liệu ẩn/xoá vẫn giữ).',
      '_Áp dụng: Thiên Kiêu Bảng, sát thương Boss, bảng thành tích Siêu Thoát, bảng Chuỗi Đồng Tu. Không áp: bảng Tông Môn/Tông Chiến, Đại Phú Đường._'].join('\n');
    if (!a) return ctx.send(help());
    if (a === 'bat' || a === 'tat') { LB.setEnabled(a === 'bat'); return ctx.send(`✅ Tính năng ẩn/xoá khỏi bảng xếp hạng: **${a === 'bat' ? 'BẬT' : 'TẮT'}**.`); }
    if (a === 'ds') { const rows = LB.list(); return ctx.send(rows.length ? [`📋 **Đang ẩn/xoá** (${rows.length}) — tính năng ${LB.enabled() ? 'BẬT' : 'TẮT'}`, ...rows.map((r) => `• <@${r.user_id}> \`${r.user_id}\` — **${r.mode === 'xoa' ? 'xoá' : 'ẩn'}** · <t:${r.ts}:d>${r.reason ? ` · ${r.reason}` : ''}`)].join('\n').slice(0, 1900) : 'Chưa ẩn/xoá ai.'); }
    if (!['an', 'xoa', 'hien'].includes(a)) return ctx.send(`❌ Hành động không hợp lệ.\n${help()}`);
    const uid = ctx.args.thanh_vien ? String(ctx.args.thanh_vien.id) : '';
    if (!uid) return ctx.send('❌ Cần người chơi: `!bxh ' + a + ' @người` hoặc `!bxh ' + a + ' <ID>`.');
    if (a === 'hien') { const r = LB.unset(uid, ctx.user.id); return ctx.send(r.ok ? `✅ <@${uid}> đã hiện lại trên bảng xếp hạng${r.restored ? ` (khôi phục ${r.restored} dòng điểm đã gỡ)` : ''}.` : `ℹ️ ${r.error}`); }
    const reason = String((ctx.message && ctx.message.content) || '').trim().split(/\s+/).slice(3).join(' ');
    const r = LB.set(uid, a, ctx.user.id, reason); if (!r.ok) return ctx.send(`❌ ${r.error}`);
    return ctx.send(a === 'an' ? `🙈 Đã **ẩn** <@${uid}> khỏi bảng xếp hạng${r.restored ? ` (trả lại ${r.restored} dòng điểm đã gỡ trước đó)` : ''}.${LB.enabled() ? '' : ' ⚠️ Tính năng đang TẮT — `!bxh bat` để có hiệu lực.'}`
      : `🗑️ Đã **xoá** <@${uid}> khỏi bảng xếp hạng (gỡ ${r.purged} dòng điểm lưu riêng, có bản sao khôi phục).${LB.enabled() ? '' : ' ⚠️ Tính năng đang TẮT — `!bxh bat` để có hiệu lực.'}`);
  },
});
