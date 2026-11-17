'use strict';
/**
 * HIỆU ỨNG CHỨNG ĐẠO THÀNH ĐẾ (v19.3) — ảnh/GIF cho từng đạo lôi, chuỗi cảnh chứng đạo thành công, thất bại, tab Đế.
 * Thuần trình diễn: chạy SAU khi logic (chungdao19) đã commit DB. Thiếu file / gửi lỗi → tự rơi về giao diện chữ cũ,
 * KHÔNG ảnh hưởng dữ liệu. Ảnh dựng bằng scripts/build_chungdao_fx_v19_3.py từ gói chung_dao_thanh_de_assets_v2_nhe.zip.
 */
const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

const DIR = path.join(__dirname, '..', '..', 'assets', 'chungdao');
const has = (file) => { try { return fs.existsSync(path.join(DIR, file)); } catch (_) { return false; } };

/** Ảnh nền theo đạo lôi 1..12. */
const loiImage = (n) => `loi_${String(Math.max(1, Math.min(12, n | 0))).padStart(2, '0')}.jpg`;
/** Ảnh/GIF theo tab Đế: image = ảnh lớn, thumb = ảnh nhỏ góc phải. */
const TAB_FX = {
  ov: { image: 'de_toa.jpg', thumb: 'de_an.png' },
  dao: { image: 'anim_luan_ban.gif' },
  binh: { image: 'binh.jpg' },
  hieu: { thumb: 'de_hoan.png' },
};
/** Các cảnh chứng đạo thành công, chiếu lần lượt trước kết quả. */
const WIN_SCENES = [
  { file: 'anim_thien_loi.gif', color: 0x9b59b6, title: '⚡ ĐẠO LÔI CUỐI CÙNG GIÁNG XUỐNG', ms: 2600,
    text: (n) => `**Chung Cực Chứng Đạo Lôi** xé toang trời đất! **${n}** đứng giữa biển lôi quang, đạo tâm không lay chuyển…` },
  { file: 'anim_than_quang.gif', color: 0xf1c40f, title: '🌟 THẦN QUANG BÙNG NỔ', ms: 3000,
    text: () => 'Lôi vân tan rã. Một đạo **Thần Quang** từ đan điền bùng lên, chiếu rọi chín tầng trời.' },
  { file: 'anim_luan_ban.gif', color: 0xf39c12, title: '☯️ ĐẠI ĐẠO LUÂN BÀN XOAY CHUYỂN', ms: 3000,
    text: () => '**Đại Đạo Luân Bàn** hiện ra sau lưng, vạn đạo cùng vang vọng — Thiên Đạo ghi nhận một vị Đế mới.' },
  { file: 'win_a.jpg', color: 0x8e44ad, title: '🌌 VẠN ĐẠO CỘNG MINH', ms: 2600,
    text: (n) => `Vạn đạo cúi đầu, bóng hình **${n}** hiện lên giữa Luân Bàn rực sáng.` },
  { file: 'win_b.jpg', color: 0xf1c40f, title: '🐉 KIM LONG · CHU TƯỚC TRIỀU BÁI', ms: 2600,
    text: () => 'Kim Long cuộn mình, Chu Tước dang cánh, tường vân vàng nâng bước chân Đế Giả.' },
  { file: 'win_c.jpg', color: 0xe67e22, title: '👑 ĐẾ QUÂN GIÁNG THẾ', ms: 2600,
    text: () => 'Bạch Hổ phủ phục, Kim Liên nở rộ — **Đế Quân giáng thế**, chư thiên chấn động!' },
];
const FAIL_SCENE = { file: 'anim_thien_loi.gif', color: 0xe74c3c, title: '💥 ĐẠO LÔI ĐÁNH TRÚNG', ms: 2200,
  text: () => 'Lôi quang nuốt chửng thân hình… đạo tâm rạn vỡ, kiếp vân cuồn cuộn không dứt.' };

let waitFn = (ms) => new Promise((r) => setTimeout(r, ms));
const setWait = (fn) => { waitFn = fn; };

/** Gắn ảnh vào embed đầu tiên của payload; thiếu file thì giữ nguyên (chỉ chữ). Luôn đặt attachments: [] để thay ảnh cũ khi update. */
function dress(payload, { image = null, thumb = null } = {}) {
  if (!payload || !payload.embeds || !payload.embeds[0]) return payload;
  const files = [];
  const e = payload.embeds[0];
  if (image && has(image)) { e.setImage(`attachment://${image}`); files.push(new AttachmentBuilder(path.join(DIR, image), { name: image })); }
  if (thumb && has(thumb) && thumb !== image) { e.setThumbnail(`attachment://${thumb}`); files.push(new AttachmentBuilder(path.join(DIR, thumb), { name: thumb })); }
  payload.attachments = [];
  if (files.length) payload.files = files;
  return payload;
}
const dressKiep = (payload, n) => dress(payload, { image: loiImage(n) });
const dressTab = (payload, tab) => dress(payload, TAB_FX[tab] || {});
const dressPre = (payload) => dress(payload, { image: 'intro.jpg' });

function scenePayload(sc, name, { footer = null, content = '' } = {}) {
  const e = new EmbedBuilder().setColor(sc.color).setTitle(sc.title).setDescription(String(sc.text(name)).slice(0, 4000));
  if (footer) e.setFooter({ text: footer });
  return dress({ content, embeds: [e], components: [] }, { image: sc.file });
}

/**
 * io = { first(payload), edit(payload) } (Promise). Trả true nếu chiếu đủ, false nếu bị gián đoạn.
 * Cảnh cuối (kết quả) do hàm gọi dựng: finalPayload = payload đã dress sẵn.
 */
async function playSequence(io, scenes, name, finalPayload, { footerPrefix = 'Chứng Đạo' } = {}) {
  let started = false; let ok = true;
  try {
    for (let i = 0; i < scenes.length; i += 1) {
      const sc = scenes[i]; const p = scenePayload(sc, name, { footer: `${footerPrefix} · cảnh ${i + 1}/${scenes.length + 1}` });
      if (!started) { await io.first(p); started = true; } else await io.edit(p);
      await waitFn(sc.ms);
    }
  } catch (_) { ok = false; }
  try { if (started) await io.edit(finalPayload()); else await io.first(finalPayload()); }
  catch (_) {
    try { const plain = finalPayload({ plain: true }); if (started) await io.edit(plain); else await io.first(plain); } catch (_e) { ok = false; }
  }
  return ok;
}
const playWin = (io, name, finalPayload) => playSequence(io, WIN_SCENES, name, finalPayload, { footerPrefix: 'Chứng Đạo Thành Đế' });
const playFail = (io, name, finalPayload) => playSequence(io, [FAIL_SCENE], name, finalPayload, { footerPrefix: 'Chứng Đạo Thất Bại' });

/** Cảnh đạo lôi đánh xuống giữa 2 đạo; sau đó gọi nextPayload() để hiện đạo kế. */
async function playHit(io, n, loiName, lines, nextPayload) {
  const sc = { file: 'anim_thien_loi.gif', color: 0xe74c3c, title: `⚡ ĐẠO LÔI ${n}/12 ĐÁNH XUỐNG`,
    text: () => `**${loiName}** giáng thẳng vào đạo thể!${lines && lines.length ? `\n\n${lines.slice(-3).join('\n')}` : ''}` };
  let shown = false;
  try { await io.first(scenePayload(sc, '', { footer: 'Nếu bảng không hiện tiếp, gõ /chungdao' })); shown = true; await waitFn(1500); } catch (_) { /* bỏ qua cảnh */ }
  const next = nextPayload();
  try { if (shown) await io.edit(next); else await io.first(next); return true; }
  catch (_) { try { await waitFn(800); if (shown) await io.edit(next); else await io.first(next); return true; } catch (_e) { return false; } }
}

/** Danh sách mọi file mà module tham chiếu — test kiểm tra đủ & tồn tại. */
const ALL_FILES = [...new Set([
  ...Array.from({ length: 12 }, (_, i) => loiImage(i + 1)), 'intro.jpg', 'fail.jpg', 'de_toa.jpg', 'binh.jpg', 'de_an.png', 'de_hoan.png',
  'anim_thien_loi.gif', 'anim_than_quang.gif', 'anim_luan_ban.gif', 'win_a.jpg', 'win_b.jpg', 'win_c.jpg', 'win_d.jpg',
])];
module.exports = { DIR, has, loiImage, TAB_FX, WIN_SCENES, FAIL_SCENE, ALL_FILES, dress, dressKiep, dressTab, dressPre, scenePayload, playWin, playFail, playHit, setWait };
