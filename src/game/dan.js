'use strict';
/** Đan Phương / Luyện Đan / Đan Dược / Đan Phá Giới / Tẩy Tủy / Luyện Khí / Linh Thú — port 1:1 */
const K = require('./constants');
const BAL = require('./balance');
const CD = require('./cooldowns');
const R = require('./realm');
const Cu = require('./cultivator');
const T = require('./talent');
const F = require('./format');
const { E } = require('./emoji');
const { geminiGenerate } = require('./ai');
const { now, int, random, randInt, choice, fmtNum } = require('../util');
const { Delta } = Cu;
const bal = (uid, ...c) => F.balanceLine(Cu.getCultivator(uid), ...c);

// ---------- Đan Dược xoay vòng ----------
const ROTATING = {};
const fallbackName = () => `${choice(K._DANDUOC_NAME_PREFIX)} ${choice(K._DANDUOC_NAME_SUFFIX)}`;
async function refreshRotatingDanduoc() {
  for (const item of K.DAN_PHUONG) {
    const q = item.quality; const fbName = fallbackName();
    const fbDesc = `Đan Dược ${item.name}, luyện thành công ${int(item.success_rate * 100)}%.`;
    const prompt = `Đặt 1 cái tên Đan Dược (viên đan) tu tiên phẩm cấp ${q}/9 (2-4 chữ Hán Việt, không giải thích gì thêm) và viết 1 câu mô tả dược tính dưới 15 từ, văn phong tiên hiệp. Trả lời đúng định dạng:\nTên: ...\nMô tả: ...`;
    const text = await geminiGenerate(prompt, `Tên: ${fbName}\nMô tả: ${fbDesc}`);
    let name = fbName; let desc = fbDesc;
    for (const raw of text.split('\n')) {
      const line = raw.trim(); const low = line.toLowerCase();
      if (low.startsWith('tên:')) name = line.split(/:(.*)/s)[1].trim() || name;
      else if (low.startsWith('mô tả:')) desc = line.split(/:(.*)/s)[1].trim() || desc;
    }
    ROTATING[q] = { name: name.slice(0, 60), desc: desc.slice(0, 150) };
  }
}
function getCurrentDanduocList() {
  for (const item of K.DAN_PHUONG) {
    if (!ROTATING[item.quality]) ROTATING[item.quality] = { name: fallbackName().slice(0, 60), desc: `Đan Dược ${item.name}, luyện thành công ${int(item.success_rate * 100)}%.` };
  }
  return K.DAN_PHUONG.map((item) => ({ ...item, rolled_name: ROTATING[item.quality].name, rolled_desc: ROTATING[item.quality].desc }));
}
const DAN_PHUONG_BY_QUALITY = Object.fromEntries(K.DAN_PHUONG.map((d) => [d.quality, d]));

function buyDanPhuong(userId, name) {
  const row = Cu.getCultivator(userId);
  const item = K.DAN_PHUONG.find((d) => d.name === name);
  if (!item) return '❌ Đan Phương không tồn tại.';
  if (row.linh_thach < item.cost) return `❌ Không đủ Linh Thạch để mua **${item.name}** (cần ${fmtNum(item.cost)}, hiện có ${fmtNum(row.linh_thach)}).`;
  if (row.dan_phuong_quality >= item.quality) return `❌ Bạn đã sở hữu Đan Phương phẩm cấp cao hơn hoặc bằng **${item.name}** rồi.`;
  if (!Cu.updateCultivator(userId, { linh_thach: new Delta(-item.cost), dan_phuong_quality: item.quality }, { linh_thach: item.cost })) return Cu.MSG_BALANCE_CHANGED;
  const rolled = getCurrentDanduocList().find((d) => d.quality === item.quality);
  const note = rolled ? ` Đan Dược luyện ra hiện là **${rolled.rolled_name}**.` : '';
  return `📖 Đã mua **${item.name}** với giá ${fmtNum(item.cost)} ${E.linhthach} Linh Thạch! Giờ có thể \`Luyện Đan\` (dùng nguyên liệu luyện xong rồi \`Sử Dụng Đan Dược\`).${note}` + bal(userId, 'linh_thach');
}

function doLuyendan(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const brewing = row.luyendan_start || 0;
  if (brewing > 0) {
    const remainBrew = CD.LUYENDAN_BREW_SECONDS - (t - brewing);
    if (remainBrew > 0) return `⏳ Đan lò đang luyện, còn **${F.fmtTime(remainBrew)}** nữa mới thu đan được. Quay lại sau nhé!`;
    const quality = row.dan_phuong_quality;
    const dp = DAN_PHUONG_BY_QUALITY[quality] || K.DAN_PHUONG[0];
    let rate = dp.success_rate;
    if (Cu.ngusuyActive(row)) rate *= K.NGUSUY_LUYENDAN_FAIL_MULT;
    const success = random() < rate;
    const updates = { luyendan_start: 0, last_luyendan: t };
    if (success) {
      updates.dan_duoc = row.dan_duoc + quality;
      Cu.updateCultivator(userId, updates);
      const rolled = getCurrentDanduocList().find((d) => d.quality === quality);
      return `${E.luyendan} Đan lò mở ra — Luyện đan THÀNH CÔNG (tỉ lệ ${int(rate * 100)}%)! Nhận được **${quality}** ${rolled ? rolled.rolled_name : 'Đan Dược'} (dùng nút **Dùng Đan Dược** để tăng tu vi tức thì). Còn ${F.fmtTime(CD.COOLDOWN_LUYENDAN)} nữa mới bắt đầu mẻ mới được.`;
    }
    Cu.updateCultivator(userId, updates);
    return `💢 Đan lò mở ra — Luyện đan THẤT BẠI, mẻ đan hỏng nhưng tích lũy thêm kinh nghiệm. Còn ${F.fmtTime(CD.COOLDOWN_LUYENDAN)} nữa mới bắt đầu mẻ mới được.`;
  }
  const remainCd = CD.COOLDOWN_LUYENDAN - (t - row.last_luyendan);
  if (remainCd > 0) return `⏳ Còn ${F.fmtTime(remainCd)} nữa mới bắt đầu luyện đan mẻ mới được.`;
  if (!process.env.V17_LEGACY_BREW) return '🔥 Từ V17, luyện đan do **Đan Sư** đảm nhiệm — dùng `/nghenghiep` → **Đan Sư** → **Công Thức** (Nguyên Liệu cũ vẫn dùng được làm nguyên liệu).';
  if (row.dan_phuong_quality <= 0) return `❌ Bạn chưa có Đan Phương nào — cần **mua Đan Phương** trước khi Luyện Đan (ở **Cửa Hàng**, tối thiểu 10.000 ${E.linhthach} Linh Thạch).`;
  if (row.nguyen_lieu < K.LUYENDAN_COST) return `❌ Cần ${K.LUYENDAN_COST} nguyên liệu để luyện đan (hiện có ${row.nguyen_lieu}).`;
  Cu.updateCultivator(userId, { nguyen_lieu: row.nguyen_lieu - K.LUYENDAN_COST, luyendan_start: t });
  return `${E.luyendan} Đã bỏ nguyên liệu vào lò, bắt đầu LUYỆN ĐAN! Mẻ đan cần **${F.fmtTime(CD.LUYENDAN_BREW_SECONDS)}** mới xong — quay lại bấm Luyện Đan lần nữa lúc đó để **thu đan**.`;
}

function doSudungdan(userId) {
  const row = Cu.getCultivator(userId);
  if (row.dan_phuong_quality <= 0) return `❌ Bạn chưa có **Đan Phương** nào nên chưa rành dược tính Đan Dược — hãy **Mua Đan Phương** trước (tối thiểu 10.000 ${E.linhthach} Linh Thạch).`;
  if (row.dan_duoc <= 0) return '❌ Bạn không có Đan Dược nào để dùng.';
  const gained = int(randInt(60, 120) * BAL.paceFactor(row));
  Cu.updateCultivator(userId, { dan_duoc: row.dan_duoc - 1, tu_vi: row.tu_vi + gained });
  return `${E.danduoc} Sử dụng Đan Dược, nhận ngay **${gained}** tu vi.`;
}

function doLuyenkhi(userId) {
  if (!process.env.V17_LEGACY_BREW) return '⚒️ Từ V17, rèn pháp khí do **Luyện Khí Sư** đảm nhiệm (trang bị 7 ô, không còn cộng chỉ số vĩnh viễn) — dùng `/nghenghiep` → **Luyện Khí Sư**. Chỉ số Luyện Khí cũ của bạn vẫn được giữ nguyên.';
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_LUYENKHI - (t - row.last_luyenkhi);
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa mới luyện khí tiếp được.`;
  if (row.nguyen_lieu < K.LUYENKHI_COST) return `❌ Cần ${K.LUYENKHI_COST} nguyên liệu để luyện pháp bảo (hiện có ${row.nguyen_lieu}).`;
  if (Cu.ngusuyActive(row) && random() < K.NGUSUY_LUYENKHI_FAIL_CHANCE) {
    Cu.updateCultivator(userId, { nguyen_lieu: row.nguyen_lieu - K.LUYENKHI_COST, last_luyenkhi: t });
    return `💢 ${E.thiennhanngusuy} Đang chịu Thiên Nhân Ngũ Suy, tâm thần bất định — Luyện Khí THẤT BẠI, mất nguyên liệu.`;
  }
  const a = BAL.scaledFlat(randInt(2, 6), row.realm_index); const d = BAL.scaledFlat(randInt(2, 6), row.realm_index);
  Cu.updateCultivator(userId, { nguyen_lieu: row.nguyen_lieu - K.LUYENKHI_COST, atk: row.atk + a, def_: row.def_ + d, last_luyenkhi: t });
  return `⚒️ Luyện thành pháp bảo mới! Vĩnh viễn +${a} Công Kích, +${d} Phòng Ngự.`;
}

// ---------- Đan Dược Phá Giới ----------
function buyDanPhaGioi(userId) {
  const row = Cu.getCultivator(userId);
  const c = K.DAN_PHA_GIOI_COST_LINH_THACH;
  if (row.linh_thach < c) return `❌ Cần **${fmtNum(c)}** ${E.linhthach} Linh Thạch để mua ${E.phagioidan} Đan Dược Phá Giới (hiện có ${fmtNum(row.linh_thach)}).`;
  if (!Cu.updateCultivator(userId, { linh_thach: new Delta(-c), dan_pha_gioi: new Delta(1) }, { linh_thach: c })) return Cu.MSG_BALANCE_CHANGED;
  return `${E.phagioidan} Đã mua **1** Đan Dược Phá Giới với giá ${fmtNum(c)} ${E.linhthach} Linh Thạch.` + bal(userId, 'linh_thach');
}
function craftDanPhaGioi(userId) {
  const row = Cu.getCultivator(userId);
  const have = row.linh_duoc_dac_biet || 0;
  if (have < K.DAN_PHA_GIOI_CRAFT_COST) return `❌ Cần **${K.DAN_PHA_GIOI_CRAFT_COST}** ${E.linhduocdacbiet} Linh Dược Đặc Biệt để luyện 1 viên Đan Dược Phá Giới (hiện có ${have}) — đi **Bí Cảnh** nhặt thêm.`;
  Cu.updateCultivator(userId, { linh_duoc_dac_biet: have - K.DAN_PHA_GIOI_CRAFT_COST, dan_pha_gioi: (row.dan_pha_gioi || 0) + 1 });
  return `${E.phagioidan} Luyện chế thành công **1** Đan Dược Phá Giới (tốn ${K.DAN_PHA_GIOI_CRAFT_COST} ${E.linhduocdacbiet} Linh Dược Đặc Biệt).`;
}
function doCanDanGiamDotpha(userId) {
  const row = Cu.getCultivator(userId);
  const t = now();
  const remain = CD.COOLDOWN_DOTPHA_FAIL - (t - row.last_dotpha_fail);
  if (remain <= 0) return '✅ Bạn hiện không bị khóa Đột Phá, không cần dùng Đan Dược Phá Giới.';
  if ((row.dan_pha_gioi || 0) <= 0) return `❌ Bạn không có ${E.phagioidan} Đan Dược Phá Giới nào — mua ở **Cửa Hàng** (${fmtNum(K.DAN_PHA_GIOI_COST_LINH_THACH)} ${E.linhthach}) hoặc luyện chế bằng Linh Dược Đặc Biệt nhặt từ **Bí Cảnh** (nút **Luyện Phá Giới Đan**).`;
  const skip = Math.min(CD.DAN_PHA_GIOI_SKIP_SECONDS, remain);
  const newFail = row.last_dotpha_fail - skip;
  Cu.updateCultivator(userId, { dan_pha_gioi: row.dan_pha_gioi - 1, last_dotpha_fail: newFail });
  const after = Math.max(0, CD.COOLDOWN_DOTPHA_FAIL - (t - newFail));
  if (after <= 0) return `${E.phagioidan} Cắn 1 Đan Dược Phá Giới, hóa giải hết chấn thương do Đột Phá thất bại — có thể **Đột Phá lại ngay**!`;
  return `${E.phagioidan} Cắn 1 Đan Dược Phá Giới, bỏ **5 phút** thời gian chờ — còn **${F.fmtTime(after)}** nữa mới Đột Phá lại được.`;
}

// ---------- Tẩy Tủy ----------
function doTaytuyReroll(userId) {
  const row = Cu.getCultivator(userId);
  const hasFree = (row.dan_taytuy_trongsinh || 0) > 0;
  if (!hasFree && row.linh_thach < K.TAYTUY_LINH_THACH_COST) return `❌ Cần **${fmtNum(K.TAYTUY_LINH_THACH_COST)}** ${E.linhthach} Linh Thạch (hoặc 1 viên ${E.taytuydan} Đan Tẩy Tủy Trọng Sinh có sẵn trong Kho Đồ) để luyện — hiện có ${fmtNum(row.linh_thach)}.`;
  const oldLc = row.linh_can; const oldTc = row.the_chat;
  const newLc = R.rollWeighted(K.LINH_CAN); const newTc = R.rollWeighted(K.THE_CHAT);
  const updates = { linh_can: newLc.name, the_chat: newTc.name, ...T.tcFields(newTc.name), ...T.lcFields(newLc.name) };   // v13.6: hồ sơ thức tỉnh/tiến hóa đặt lại theo phẩm cấp mới
  let costLine;
  if (hasFree) { updates.dan_taytuy_trongsinh = row.dan_taytuy_trongsinh - 1; costLine = `Đã dùng **1** ${E.taytuydan} Đan Tẩy Tủy Trọng Sinh có sẵn (miễn phí, còn lại ${updates.dan_taytuy_trongsinh}).`; }
  else { updates.linh_thach = new Delta(-K.TAYTUY_LINH_THACH_COST); costLine = `-${fmtNum(K.TAYTUY_LINH_THACH_COST)} ${E.linhthach} Linh Thạch.`; }
  if (!Cu.updateCultivator(userId, updates, hasFree ? null : { linh_thach: K.TAYTUY_LINH_THACH_COST })) return Cu.MSG_BALANCE_CHANGED;
  return `${E.taytuydan} **ĐAN TẨY TỦY TRỌNG SINH** phát huy tác dụng — toàn bộ tư chất được tái sinh!\n${E.linhcan} Linh Căn: ${oldLc} → **${newLc.name}** (x${newLc.mult})\n${E.thechat} Thể Chất: ${oldTc} → **${newTc.name}** (x${newTc.mult})\n⚠️ Hồ sơ Thức Tỉnh / Tiến Hóa của phẩm cấp cũ đã được đặt lại; Linh Căn mới có hành và độ tinh khiết mới.\n${costLine}`;
}
function doTaytuyNuabanReroll(userId, stat = 'linh_can') {
  if (stat !== 'linh_can' && stat !== 'the_chat') stat = 'linh_can';
  const row = Cu.getCultivator(userId);
  const hasFree = (row.dan_taytuy_nuaban || 0) > 0;
  const price = K.TAYTUY_NUABAN_LINH_THACH_COST;
  if (!hasFree && row.linh_thach < price) return `❌ Cần **${fmtNum(price)}** ${E.linhthach} Linh Thạch (hoặc 1 viên ${E.taytuydan} Đan Tẩy Tủy Nửa Tác Dụng có sẵn trong Kho Đồ) để luyện — hiện có ${fmtNum(row.linh_thach)}.`;
  let updates; let statLine; let keptLine;
  if (stat === 'linh_can') {
    const nv = R.rollWeighted(K.LINH_CAN); updates = { linh_can: nv.name, ...T.lcFields(nv.name) };
    statLine = `${E.linhcan} Linh Căn: ${row.linh_can} → **${nv.name}** (x${nv.mult})`; keptLine = `${E.thechat} Thể Chất giữ nguyên: **${row.the_chat}**.`;
  } else {
    const nv = R.rollWeighted(K.THE_CHAT); updates = { the_chat: nv.name, ...T.tcFields(nv.name) };
    statLine = `${E.thechat} Thể Chất: ${row.the_chat} → **${nv.name}** (x${nv.mult})`; keptLine = `${E.linhcan} Linh Căn giữ nguyên: **${row.linh_can}**.`;
  }
  let costLine;
  if (hasFree) { updates.dan_taytuy_nuaban = row.dan_taytuy_nuaban - 1; costLine = `Đã dùng **1** ${E.taytuydan} Đan Tẩy Tủy Nửa Tác Dụng có sẵn (miễn phí, còn lại ${updates.dan_taytuy_nuaban}).`; }
  else { updates.linh_thach = new Delta(-price); costLine = `-${fmtNum(price)} ${E.linhthach} Linh Thạch.`; }
  if (!Cu.updateCultivator(userId, updates, hasFree ? null : { linh_thach: price })) return Cu.MSG_BALANCE_CHANGED;
  return `${E.taytuydan} **ĐAN TẨY TỦY NỬA TÁC DỤNG** phát huy tác dụng!\n${statLine}\n${keptLine}\n${costLine}`;
}

// ---------- menu Dùng Đan Dược ----------
function getDanDuocUses(row) {
  const uses = [];
  if (row.dan_phuong_quality > 0 && (row.dan_duoc || 0) > 0) uses.push({ key: 'tangtuvi', label: `Tăng Tu Vi ngay (${row.dan_duoc} viên)`, desc: 'Cắn 1 Đan Dược, nhận ngay 60~120 tu vi' });
  if ((row.dan_pha_gioi || 0) > 0) uses.push({ key: 'phagioi', label: `Bỏ 5 phút chờ Đột Phá (${row.dan_pha_gioi} viên)`, desc: 'Cắn 1 Đan Dược Phá Giới, bỏ tối đa 5 phút cooldown Đột Phá thất bại' });
  if ((row.dan_taytuy_trongsinh || 0) > 0 || row.linh_thach >= K.TAYTUY_LINH_THACH_COST)
    uses.push({ key: 'taytuytrongsinh', label: `Tẩy Tủy Trọng Sinh — reroll Linh Căn+Thể Chất (${row.dan_taytuy_trongsinh || 0} viên)`, desc: 'Cắn 1 Đan Tẩy Tủy Trọng Sinh, roll lại CẢ Linh Căn lẫn Thể Chất' });
  if ((row.dan_taytuy_nuaban || 0) > 0 || row.linh_thach >= K.TAYTUY_NUABAN_LINH_THACH_COST)
    uses.push({ key: 'taytuynuaban', label: `Tẩy Tủy Nửa Tác Dụng — chọn 1 chỉ số (${row.dan_taytuy_nuaban || 0} viên)`, desc: 'Cắn 1 Đan Tẩy Tủy Nửa Tác Dụng, TỰ CHỌN reroll Linh Căn HOẶC Thể Chất' });
  return uses;
}
function useDanDuoc(userId, key) {
  if (key === 'tangtuvi') return doSudungdan(userId);
  if (key === 'phagioi') return doCanDanGiamDotpha(userId);
  if (key === 'taytuytrongsinh') return doTaytuyReroll(userId);
  return '❌ Lựa chọn không hợp lệ.';
}

module.exports = {
  refreshRotatingDanduoc, getCurrentDanduocList, buyDanPhuong, doLuyendan, doSudungdan, doLuyenkhi,
  buyDanPhaGioi, craftDanPhaGioi, doCanDanGiamDotpha, doTaytuyReroll, doTaytuyNuabanReroll, getDanDuocUses, useDanDuoc,
};
