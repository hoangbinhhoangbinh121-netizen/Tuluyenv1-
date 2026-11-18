'use strict';
/**
 * V19.10 — BẢN HƯỚNG DẪN LỤM VẬT PHẨM CHỨNG ĐẠO.
 * Sinh từ DỮ LIỆU THẬT (yêu cầu Chứng Đạo, nguồn rơi bí cảnh, kỳ vọng rơi theo công thức rollMember) nên không lệch khi chỉnh cân bằng.
 * Chỉ trả cấu trúc dữ liệu thuần (không phụ thuộc discord.js) để dễ kiểm thử; giao diện ở ui/chungdaoViews.js.
 */
const K = require('./constants');
const Cu = require('./cultivator');
const Inv = require('./invsvc');
const BC = require('./bicanh19');
const B = require('../data/bicanh19');
const CD = require('./chungdao19');
const I19 = require('../data/items_v19');
const IT17 = require('../data/items_v17');

const fmt = (n) => Number(n).toLocaleString('vi-VN');
const f1 = (x) => (x >= 10 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toString().replace('.', ','));
const ENTRIES = () => BC.CFG.ENTRIES_PER_DAY;

/** Nguồn ngoài bí cảnh (sự kiện thế giới) của từng vật phẩm — khớp event19.js (BOSS_LOOT / settleContest) & bicanh19.js (Boss cuối). */
const EXTRA = {
  tdc19_de_dao_ban_nguyen: [
    '👑 **Đế Cảnh Xuất Thế** (Boss Thế Giới cấp 10, từ Chân Tiên, tối đa 60 người): đóng góp ≥ 2% sát thương → **90%** rơi **2–6** (đóng góp càng lớn càng nhiều, tối đa ×2; hạ được Boss mới đủ, không hạ chỉ ×0,5).',
    '📜 **Vạn Cổ Truyền Thừa** (tranh đoạt 5 phút, tối đa 20 người): người thắng, nếu đã có sẵn công pháp truyền thừa đó, nhận **8–16**.',
    '🌠 **Thiên Địa Dị Biến**: bí cảnh Tiên Giới rơi ×1,3 (và thưởng ×1,5) trong lúc sự kiện diễn ra.',
  ],
  tdc19_de_dao_chung_nhan: [
    '🏁 **Boss cuối bí cảnh** từ **Đế Đạo Cổ Lộ** trở lên: **lần đầu chinh phục chắc chắn có**, các lần sau **20%**.',
    '👑 **Đế Cảnh Xuất Thế**: người **xếp hạng 1 sát thương** khi Boss bị hạ có **25%**.',
    '🌌 **Siêu Thoát Chi Môn** (Boss cấp 11, dành cho cảnh giới rất cao): hạng 1 khi hạ Boss có **30%**.',
    '⚠️ Chứng Nhận **không được hoàn lại** nếu Chứng Đạo thất bại — chỉ nên bắt đầu khi đã sẵn sàng.',
  ],
  tdc19_bat_hu_de_cot: [
    '🏁 **Boss cuối Đế Đạo Cổ Lộ**: **lần đầu chinh phục chắc chắn có 1**, các lần sau **30%** (đường gom chính khi CHƯA thành Đế).',
    '👑 **Đế Cảnh Xuất Thế**: đóng góp ≥ 2% sát thương → **20%** rơi 1–2.',
  ],
  tdc19_tien_ton_dao_qua: [
    '👑 **Đế Cảnh Xuất Thế**: đóng góp ≥ 2% sát thương → **30%** rơi 1–2.',
  ],
};
const TIPS = [
  `Mỗi bí cảnh chỉ vào được **${ENTRIES()} lần/ngày/người** (tính theo ngày giờ VN) → gom đồ bằng cách **xoay vòng nhiều bí cảnh** chứ không chỉ cày một chỗ.`,
  'Tổ đội 2–5 người: phần thưởng chia theo sát thương (×0,6 → ×1,4 mỗi người) — đánh nhiều hơn thì nhặt nhiều hơn, người gục nhận một nửa.',
  'Rơi vật phẩm hiếm tăng ở các tầng sâu: tầng 3 ×1,4 · tầng 4 ×1,5 · tầng 5 (Boss cuối) ×1,8; **mở rương** thêm 1 lượt nguyên liệu hiếm.',
  'Đế Đạo Bản Nguyên · Bất Hủ Đế Cốt · Tiên Tôn Đạo Quả **không giao dịch / không bán được** — phải tự đi lụm.',
  'Thiếu một món là không bắt đầu được: nhìn tiến độ ✅/❌ ở menu **/chungdao**.',
];

const have = (uid, id) => (uid ? Inv.qty(uid, id) : 0);
const nameOf = (id) => CD.itemName(id);
const reqOf = () => CD.REQ;

/** Danh sách bí cảnh có rơi `id`, kèm kỳ vọng/lượt và số lượt cần để đủ phần còn thiếu. */
function sourcesOf(uid, id) {
  const row = uid ? Cu.getCultivator(uid) : null; const need = reqOf()[id]; const missing = Math.max(0, need - have(uid, id));
  const out = [];
  for (const key of (I19.SRC[id] || [])) {
    const m = /^bc19_(\d+)$/.exec(key); if (!m) continue; const idx = Number(m[1]); const bc = B.BCS[idx]; if (!bc) continue;
    const e = BC.expectedDrop(id, idx); if (!(e > 0)) continue;
    const can = row ? row.realm_index >= bc.realm : false; const runs = missing > 0 ? Math.ceil(missing / e) : 0;
    out.push({ idx, name: bc.name, realm: K.REALMS[bc.realm].name, realmIdx: bc.realm, can, e, runs, days: Math.ceil(runs / ENTRIES()) });
  }
  return out.sort((a, b) => b.e - a.e);
}
const sourceLines = (list) => list.map((s) => `${s.can ? '✅' : '🔒'} **${s.name}** _(${s.realm})_ — ~**${f1(s.e)}**/lượt${s.runs ? ` → còn cần ~**${s.runs}** lượt (~${s.days} ngày)` : ' · đã đủ'}`);

function itemPage(uid, id) {
  const need = reqOf()[id]; const h = have(uid, id); const list = sourcesOf(uid, id);
  const fields = [];
  if (list.length) fields.push({ name: '🗺️ Bí Cảnh Tiên Giới (✅ vào được · 🔒 chưa đủ cảnh giới)', value: sourceLines(list).join('\n').slice(0, 1020) });
  fields.push({ name: '🎪 Nguồn khác', value: (EXTRA[id] || ['—']).join('\n').slice(0, 1020) });
  return { title: `${h >= need ? '✅' : '❌'} ${nameOf(id)} — ${fmt(h)}/${fmt(need)}`, description: (IT17.BY_ID[id] && IT17.BY_ID[id].desc) || undefined, fields };
}

/** Toàn bộ trang hướng dẫn (key → {title, description, fields}). */
function pages(uid) {
  const R = reqOf(); const ids = Object.keys(R); const row = uid ? Cu.getCultivator(uid) : null;
  const bestOf = (id) => { const l = sourcesOf(uid, id).filter((s) => s.can); return l.length ? l[0] : null; };
  const ov = [];
  for (const id of ids) {
    const h = have(uid, id); const b = bestOf(id);
    ov.push(`${h >= R[id] ? '✅' : '❌'} **${nameOf(id)}** ${fmt(h)}/${fmt(R[id])}${h >= R[id] ? '' : b ? ` — nhanh nhất: **${b.name}** (~${f1(b.e)}/lượt, ~${b.runs} lượt)` : ' — _chưa có bí cảnh nào bạn vào được; xem sự kiện thế giới_'}`);
  }
  const gate = `${K.REALMS[CD.GATE_REALM].name} · Viên Mãn`;
  return {
    ov: {
      title: '📘 LỤM VẬT PHẨM CHỨNG ĐẠO — Tổng quan',
      description: `Muốn **Chứng Đạo Thành Đế** cần 4 loại vật phẩm bên dưới, cùng cảnh giới **${gate}** và đủ tu vi. Chọn từng món ở menu để xem chỗ lụm chi tiết.\n\n${ov.join('\n')}`,
      fields: [
        { name: '✅ Điều kiện vào Bí Cảnh Tiên Giới', value: 'Đã **Phi Thăng Tiên Giới** + vượt **Thiên Nhân Ngũ Suy** + cảnh giới ≥ cảnh giới của bí cảnh. Dùng `/bicanhtiengioi`.' },
        { name: '🧭 Lộ trình gợi ý', value: `1) Lên **${K.REALMS[B.BCS[8].realm].name}** → cày **Đế Đạo Cổ Lộ** (nơi duy nhất vào được mà rơi cả Bản Nguyên, Đế Cốt, Đạo Quả và Chứng Nhận).\n2) Xoay thêm **Cửu U Tôn Giả Giới / Tôn Giả Thần Điện** lấy Tiên Tôn Đạo Quả.\n3) Theo dõi **sự kiện thế giới** (Đế Cảnh Xuất Thế…) để bù phần thiếu.\n4) Đủ đồ + đủ cảnh giới → \`/chungdao\` → **Bắt Đầu Đại Kiếp**.` },
        { name: '💡 Mẹo', value: TIPS.map((t) => `• ${t}`).join('\n').slice(0, 1020) },
      ],
    },
    ban: itemPage(uid, 'tdc19_de_dao_ban_nguyen'),
    nhan: itemPage(uid, 'tdc19_de_dao_chung_nhan'),
    cot: itemPage(uid, 'tdc19_bat_hu_de_cot'),
    qua: itemPage(uid, 'tdc19_tien_ton_dao_qua'),
    _row: !!row,
  };
}
const PAGE_KEYS = [['ov', 'Tổng quan lộ trình', '📘'], ['ban', 'Đế Đạo Bản Nguyên ×100', '🌀'], ['nhan', 'Đế Đạo Chứng Nhận ×1', '📜'], ['cot', 'Bất Hủ Đế Cốt ×5', '🦴'], ['qua', 'Tiên Tôn Đạo Quả ×10', '🍑']];

module.exports = { pages, sourcesOf, PAGE_KEYS, EXTRA, TIPS };
