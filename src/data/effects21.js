'use strict';
/**
 * v21.6 — DỮ LIỆU HIỆU ỨNG CHIẾN ĐẤU + KỸ NĂNG CHỦNG TỘC (nguồn số liệu duy nhất; logic không chứa số).
 * Thang sinh lực PvP hiện tại = 100 (thiết kế v12.3) → các số "hp" dưới đây là điểm trên thanh 100. Khi có HP thật (V21.7) sẽ đổi sang % sinh lực tối đa.
 * Chính sách chồng hiệu ứng (stack): refresh | stackDuration | stackIntensity | strongest | replace | unique   (xem game/effectEngine.js)
 * Tất cả là ĐỀ XUẤT đã benchmark (scripts/bench_effects21.js) — chờ người thiết kế duyệt.
 */
const EFFECTS = {
  poison: { id: 'poison', name: 'Trúng Độc', icon: '☠️', kind: 'dot', policy: 'stackIntensity', maxStacks: 3, power: 1, dur: 2, desc: 'Mất 1 sinh lực mỗi hiệp mỗi tầng (tối đa 3 tầng).' },
  bleed: { id: 'bleed', name: 'Xuất Huyết', icon: '🩸', kind: 'dot', policy: 'strongest', power: 2, dur: 2, desc: 'Mất 2 sinh lực mỗi hiệp (không cộng dồn, giữ mức mạnh nhất).' },
  burn: { id: 'burn', name: 'Thiêu Đốt', icon: '🔥', kind: 'dot', policy: 'refresh', power: 2, dur: 2, desc: 'Mất 2 sinh lực mỗi hiệp; bị thiêu lại thì làm mới thời gian.' },
  stun: { id: 'stun', name: 'Choáng Váng', icon: '💫', kind: 'ctrl', policy: 'unique', dur: 1, immuneRounds: 1, desc: 'Mất lượt hành động kế tiếp; sau khi tỉnh miễn nhiễm choáng 1 hiệp (chống khoá cứng).' },
  freeze: { id: 'freeze', name: 'Băng Phong', icon: '🧊', kind: 'mod', policy: 'refresh', dur: 2, mod: { spdMult: 0.7, dodge: -0.05 }, desc: 'Giảm 30% tốc độ và 5% né tránh.' },
  weaken: { id: 'weaken', name: 'Suy Nhược', icon: '🥀', kind: 'mod', policy: 'strongest', dur: 2, power: 0.15, mod: { dmgOut: -1 }, scale: true, desc: 'Gây ít hơn 15% sát thương (mạnh nhất thắng, không cộng dồn).' },
  guard: { id: 'guard', name: 'Hộ Thể', icon: '🔰', kind: 'mod', policy: 'strongest', dur: 2, power: 0.15, mod: { dr: 1 }, scale: true, desc: 'Giảm sát thương nhận.' },
  frenzy: { id: 'frenzy', name: 'Cuồng Huyết', icon: '💢', kind: 'mod', policy: 'refresh', dur: 2, power: 0.35, mod: { dmgOut: 1 }, scale: true, desc: 'Tăng sát thương gây ra.' },
  evasion: { id: 'evasion', name: 'Linh Thân', icon: '🌬️', kind: 'mod', policy: 'refresh', dur: 2, power: 0.18, mod: { dodge: 1 }, scale: true, desc: 'Tăng né tránh.' },
};
// tên hiệu ứng ngẫu nhiên cũ trong PvP (PVP_EFFECT_LIST) → id mới. Trước v21.6 chúng CHỈ hiện trong nhật ký (F-1).
const LEGACY_NAME = { 'Trúng Độc': 'poison', 'Choáng Váng': 'stun', 'Xuất Huyết': 'bleed', 'Băng Phong': 'freeze', 'Thiêu Đốt': 'burn', 'Suy Nhược': 'weaken' };

// Kỹ năng chủ động của chủng tộc — dùng như 1 hành động trong PvP. Mở khoá: thức tỉnh ≥ unlockAwaken. cd = số hiệp chờ giữa 2 lần dùng (tiến hóa −1).
const RACE_SKILLS = {
  nhan: { id: 'nhan_bat_khuat', name: 'Ý Chí Bất Khuất', icon: '🧑', kind: 'self', cd: 5, unlockAwaken: 1, free: true, heal: 5, cleanse: true, applySelf: [{ id: 'guard', power: 0.08, dur: 2 }], desc: 'Hồi 5 sinh lực, xoá mọi hiệu ứng xấu, giảm 8% sát thương nhận 2 hiệp. Không mất lượt (vẫn ra đòn thường).' },
  long: { id: 'long_uy', name: 'Long Uy', icon: '🐉', kind: 'self', cd: 5, unlockAwaken: 1, free: true, applySelf: [{ id: 'guard', power: 0.18, dur: 2 }], applyFoe: [{ id: 'weaken', power: 0.20, dur: 2 }], desc: 'Giảm 18% sát thương nhận và khiến đối thủ gây ít hơn 20% sát thương trong 2 hiệp. Không mất lượt.' },
  phuong: { id: 'phuong_niet_ban', name: 'Niết Bàn Hỏa', icon: '🔥', kind: 'attack', cd: 3, unlockAwaken: 1, dmg: 1.25, applyFoeOnHit: [{ id: 'burn', dur: 2 }], desc: 'Đòn lửa ×1.25 sát thương, thiêu đốt đối thủ 2 hiệp.' },
  ma: { id: 'ma_huyet_te', name: 'Huyết Tế', icon: '😈', kind: 'self', cd: 5, unlockAwaken: 1, free: true, costHp: 3, applySelf: [{ id: 'frenzy', power: 0.30, dur: 2 }], desc: 'Hiến tế 3 sinh lực (không tự giết), tăng 30% sát thương gây ra trong 2 hiệp. Không mất lượt.' },
  linh: { id: 'linh_linh_than', name: 'Linh Thân', icon: '✨', kind: 'self', cd: 5, unlockAwaken: 1, free: true, heal: 2, cleanse: true, applySelf: [{ id: 'evasion', power: 0.12, dur: 2 }], desc: 'Hồi 2 sinh lực, xoá hiệu ứng xấu, tăng 12% né tránh 2 hiệp. Không mất lượt.' },
  yeu: { id: 'yeu_hoang_da', name: 'Hoang Dã Nhào Tới', icon: '🦊', kind: 'attack', cd: 4, unlockAwaken: 1, dmg: 1.3, critAdd: 0.25, applyFoeOnCrit: [{ id: 'bleed', dur: 2 }], desc: 'Đòn ×1.3 sát thương, +25% bạo kích; nếu bạo kích gây Xuất Huyết 2 hiệp.' },
};
const KILLMOVE_CD = 3;           // F-2: Sát Chiêu hồi chiêu (số hiệp chờ giữa 2 lần dùng) — setting pvp_killmove_cd
const EFFECT_PROC = 0.22;        // xác suất hiệu ứng ngẫu nhiên trên mỗi đòn trúng (giữ đúng 22% của V21.5 trở về trước)
module.exports = { EFFECTS, LEGACY_NAME, RACE_SKILLS, KILLMOVE_CD, EFFECT_PROC };
