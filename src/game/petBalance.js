'use strict';
/**
 * CÂN BẰNG LINH THÚ v14.0 — TOÀN BỘ công thức/hằng số của hệ thống Linh Thú nằm ở file này (và chỉ ở đây).
 * Các module khác (pets.js, petCombat.js, giao diện) chỉ GỌI hàm; không tự tính số liệu riêng.
 * `balance.js` re-export dưới tên `BAL.pets` để mọi nơi cân bằng game vẫn đi qua một cửa.
 *
 * Nguyên tắc:
 *  • Linh Thú KHÔNG cộng HP/ATK/DEF trực tiếp vào nhân vật. Chúng chỉ tác động qua chiến đấu (trợ chiến + kỹ năng) và các hệ phụ.
 *  • Sức mạnh một Linh Thú gói trong 1 con số "rating" (≈0,2 … 2,2) — mọi hiệu ứng chiến đấu nhân với rating đó rồi bị chặn trần.
 */
const { int, clamp } = require('../util');

// ------------------------------------------------------------------ phẩm cấp
const TIERS = [
  { n: 1, name: 'Phàm Thú', icon: '⚪', req: 0 },
  { n: 2, name: 'Linh Thú', icon: '🟢', req: 1 },
  { n: 3, name: 'Huyền Thú', icon: '🔵', req: 3 },
  { n: 4, name: 'Địa Thú', icon: '🟤', req: 4 },
  { n: 5, name: 'Thiên Thú', icon: '🟣', req: 5 },
  { n: 6, name: 'Thánh Thú', icon: '🟡', req: 6 },
  { n: 7, name: 'Tiên Thú', icon: '🟠', req: 8 },
  { n: 8, name: 'Thần Thú', icon: '🔴', req: 10 },
  { n: 9, name: 'Hỗn Độn Thú', icon: '⚫', req: 12 },
];
const tierInfo = (n) => TIERS[clamp(int(n), 1, 9) - 1];
/** Đại cảnh giới (realm_index) tối thiểu để khế ước/ép được Linh Thú phẩm cấp này mà không bị áp chế. */
const tierReqRealm = (n) => tierInfo(n).req;

// ------------------------------------------------------------------ cấp độ & EXP
const LEVEL_MAX = 100;
/** EXP cần để lên cấp (level → level+1). */
const expNeed = (level) => Math.max(40, int(25 * (Math.max(1, level) ** 1.6)));
/** Trần cấp theo cảnh giới chủ: 15 + 6/đại cảnh giới (Hóa Thần=45, Độ Kiếp=69, Chân Tiên=75…); Bản Mệnh +10. */
const levelCap = (realmIdx, contract) => clamp(15 + 6 * Math.max(0, realmIdx || 0) + (contract === 'ban_menh' ? 10 : 0), 15, LEVEL_MAX);

// ------------------------------------------------------------------ chỉ số hiển thị (không dùng để cộng cho nhân vật)
const STAT_BASE = { hp: 300, atk: 40, def: 30, spd: 20 };
const STAT_TIER_GROWTH = 1.75;
const levelFactor = (level) => 0.3 + 0.7 * ((clamp(level, 1, LEVEL_MAX) / LEVEL_MAX) ** 0.9);
const purityFactor = (purity) => 1 + 0.25 * clamp(purity, 0, 100) / 100;
const bondFactor = (bond) => 1 + 0.10 * clamp(bond, 0, 100) / 100;
const tierFactor = (tier) => 0.55 + 0.1 * (clamp(tier, 1, 9) - 1);

// ------------------------------------------------------------------ khế ước
const CONTRACTS = {
  binh_dang: {
    name: 'Bình Đẳng Khế', short: 'Bình Đẳng', rating: 1.0, talent: 1.0, bondGain: 1.25, bondCap: 100, allowAlt: true,
    needBond: 30, needItem: { khe_uoc_phu: 1 }, cost: (tier) => 5000 * tier * tier,
    desc: 'Đồng hành ngang hàng: Linh Thú giữ đủ thiên phú, thân mật tăng nhanh (+25%), được chọn mọi nhánh tiến hóa.',
  },
  chu_to: {
    name: 'Chủ Tớ Khế', short: 'Chủ Tớ', rating: 1.10, talent: 0.8, bondGain: 0.6, bondCap: 60, allowAlt: false,
    needBond: 0, needItem: { khe_uoc_phu: 1 }, cost: (tier) => 3000 * tier * tier,
    desc: 'Áp chế phục tùng: sức chiến đấu +10% nhưng thiên phú chỉ phát huy 80%, thân mật tăng chậm (−40%) và tối đa 60, không được rẽ nhánh Dị Hóa. Cảnh giới chủ phải đạt mức của phẩm cấp thú.',
  },
  ban_menh: {
    name: 'Bản Mệnh Khế', short: 'Bản Mệnh', rating: 1.18, talent: 1.15, bondGain: 1.0, bondCap: 100, allowAlt: true,
    needBond: 70, needItem: { ban_menh_huyet: 1 }, cost: (tier) => 20000 * tier * tier,
    desc: 'Liên kết sinh mệnh (chỉ 1 ô): sức chiến đấu +18%, thiên phú +15%, trần cấp +10, và 1 lần/trận “Hộ Chủ” cứu chủ khỏi đòn chí mạng. Phải có Bình Đẳng hoặc Chủ Tớ Khế trước.',
  },
};
const CONTRACT_BREAK_BOND = 20;      // giải khế: mất thân mật
const SLOT_COUNT = { ban_menh: 1, dong_hanh: 2 };
const VIEN_CAPACITY = 30;            // sức chứa Linh Thú Viên (không tính thú đang ở ô)
const EGG_CAPACITY = 10;

// ------------------------------------------------------------------ huyết mạch
const PURITY_STAGES = [0, 40, 70, 100];                  // ngưỡng thức tỉnh huyết mạch (giai đoạn 0..3)
const STAGE_NAMES = ['Phàm Huyết', 'Giác Tỉnh', 'Thuần Huyết', 'Chân Huyết'];
const STAGE_TALENT = [0.6, 0.8, 1.0, 1.3];               // hiệu lực thiên phú theo giai đoạn
const purityStage = (p) => (p >= 100 ? 3 : p >= 70 ? 2 : p >= 40 ? 1 : 0);
const REFINE = { item: 'huyet_mach_tinh', gain: [3, 8], softCap: 70, softMult: 0.5, cost: (tier) => 8000 * tier };
const INHERIT = { cost: (tier) => 30000 * tier * tier, frac: 0.25, skillChance: 0.35, maxGen: 9, minTierGap: 1 };   // hy sinh thú cùng/ kém ≤1 phẩm hoặc cao hơn

// ------------------------------------------------------------------ rating (sức chiến đấu gói gọn)
/** Áp chế cảnh giới: chủ thấp hơn mức của phẩm cấp thú → ×0,85 mỗi đại cảnh giới thiếu. */
function suppression(tier, ownerRealm) {
  const gap = Math.max(0, tierReqRealm(tier) - Math.max(0, ownerRealm || 0));
  return gap ? 0.85 ** gap : 1;
}
/** rating ≈ 0,12 … 2,2 : phẩm cấp × cấp độ × huyết mạch × thân mật × khế ước × áp chế. */
function rating(pet, ownerRealm) {
  const c = CONTRACTS[pet.contract];
  return tierFactor(pet.tier) * levelFactor(pet.level) * purityFactor(pet.purity) * bondFactor(pet.bond) * (c ? c.rating : 0.9) * suppression(pet.tier, ownerRealm);
}
/** Chỉ số hiển thị (HP/ATK/DEF/TỐC) — tỉ lệ với rating, nhân với thiên hướng loài. */
function statsOf(pet, bias, ownerRealm) {
  const g = (STAT_TIER_GROWTH ** (pet.tier - 1)) * (rating(pet, ownerRealm) / tierFactor(pet.tier));
  const o = {};
  for (const k of ['hp', 'atk', 'def', 'spd']) o[k] = Math.max(1, Math.round(STAT_BASE[k] * g * (bias[k] || 1) * (k === 'spd' ? 0.35 : 1)) + (k === 'spd' ? 10 : 0));
  return o;
}

// ------------------------------------------------------------------ thân mật & EXP nguồn
const BOND_MAX = 100;
const PLAY = { cooldown: 600, bond: 3, exp: (level) => 20 + 2 * level };                // "Dạo Chơi"
const BOND_PER_PVP_WIN = 1; const BOND_PER_PVP_LOSS = 0;
const BOND_PER_FEED = (foodTier) => [1, 2, 4][foodTier - 1] || 1;
const bondGain = (contract, base) => Math.max(0, Math.round(base * ((CONTRACTS[contract] || {}).bondGain || 1)));
const bondCap = (contract) => (CONTRACTS[contract] ? CONTRACTS[contract].bondCap : 100);
/** Phần EXP chia cho thú đồng hành không xuất chiến (đang ở ô). */
const COMPANION_EXP_SHARE = 0.4;
const expPvp = (won, level) => int((won ? 90 : 35) + 3 * level);
const expBicanh = (srcIdx, level) => int(14 + 9 * srcIdx + 0.8 * level);
const expBoss = (level) => int(60 + 4 * level);

// ------------------------------------------------------------------ vật phẩm Linh Thú (bảng pet_items)
const ITEMS = {
  linh_thu_luong:   { name: 'Linh Thú Lương', icon: 'luong', exp: 300, bond: 1, price: 3000, desc: 'Thức ăn cơ bản: +300 EXP, +1 thân mật.' },
  linh_thu_dan:     { name: 'Linh Thú Đan', icon: 'luong', exp: 3000, bond: 2, price: 30000, desc: 'Đan dược cho thú: +3.000 EXP, +2 thân mật.' },
  than_thu_dan:     { name: 'Thần Thú Đan', icon: 'luong', exp: 30000, bond: 4, price: 400000, desc: 'Đan thượng phẩm: +30.000 EXP, +4 thân mật.' },
  bat_phu:          { name: 'Thu Phục Phù', icon: 'phu', price: 8000, desc: 'Dùng khi thu phục thú hoang: +25% tỉ lệ thành công, không tiêu nếu thất bại do thú bỏ chạy.' },
  khe_uoc_phu:      { name: 'Khế Ước Phù', icon: 'phu', price: 20000, desc: 'Cần để ký Bình Đẳng Khế hoặc Chủ Tớ Khế.' },
  ban_menh_huyet:   { name: 'Bản Mệnh Tinh Huyết', icon: 'huyet', price: 600000, desc: 'Giọt tinh huyết của chủ nhân — cần để ký Bản Mệnh Khế.' },
  huyet_mach_tinh:  { name: 'Huyết Mạch Tinh', icon: 'huyet', price: 150000, desc: 'Tẩy luyện huyết mạch: +3~8 độ thuần (giảm hiệu quả sau 70).' },
  ky_nang_gian:     { name: 'Kỹ Năng Ngọc Giản', icon: 'phu', price: 60000, desc: 'Nâng bậc 1 kỹ năng Linh Thú (tối đa bậc 5).' },
  trung_nho:        { name: 'Thúc Ấp Linh Dịch', icon: 'luong', price: 25000, desc: 'Cho trứng nở ngay lập tức.' },
};
// Hóa Linh Châu theo phẩm cấp (tiến hóa từ phẩm t sang t+1) và Nguyên Tố Tinh Hoa theo hành
for (let t = 1; t <= 8; t += 1) ITEMS[`evo_t${t}`] = { name: `Hóa Linh Châu · ${tierInfo(t).name}`, icon: 'chau', price: int(15000 * (2.1 ** (t - 1))), desc: `Nguyên liệu tiến hóa từ ${tierInfo(t).name} lên ${tierInfo(t + 1).name}.` };
const HANH = ['Kim', 'Mộc', 'Thủy', 'Hỏa', 'Thổ'];
const HANH_KEY = { Kim: 'kim', Mộc: 'moc', Thủy: 'thuy', Hỏa: 'hoa', Thổ: 'tho' };
for (const h of HANH) ITEMS[`ess_${HANH_KEY[h]}`] = { name: `Nguyên Tố Tinh Hoa · ${h}`, icon: 'hanh_' + HANH_KEY[h], price: 40000, desc: `Tinh hoa hành ${h}: dùng cho nhánh Dị Hóa sang dòng hành ${h}.` };
const ITEM_ORDER = Object.keys(ITEMS);
/** Cửa hàng Linh Thú: những vật phẩm bán bằng Linh Thạch (không gồm Bản Mệnh Tinh Huyết hiếm — bán giá cao có giới hạn ngày). */
const SHOP_ITEMS = ['linh_thu_luong', 'linh_thu_dan', 'than_thu_dan', 'bat_phu', 'khe_uoc_phu', 'huyet_mach_tinh', 'ky_nang_gian', 'trung_nho', 'ban_menh_huyet',
  ...Array.from({ length: 8 }, (_, i) => `evo_t${i + 1}`), ...HANH.map((h) => `ess_${HANH_KEY[h]}`)];
const SHOP_DAILY_LIMIT = { ban_menh_huyet: 2, than_thu_dan: 20 };    // mỗi ngày/người

// ------------------------------------------------------------------ thức ăn cơ bản bằng nguyên liệu (không cần mua)
const BASIC_FEED = { nguyen_lieu: 5, exp: 120, bond: 1, cooldown: 20 };
// v17: nguyên liệu Yêu Thú dùng làm thức ăn (đi qua Inventory Service)
const MAT_FEED = { yt_yeu_dan: { exp: 500, bond: 1 } };

// ------------------------------------------------------------------ kỹ năng
const SKILL_UNLOCK = { a1: 1, p1: 15, a2: 40 };            // cấp mở khóa kỹ năng thứ 1 / bị động / thứ 2
const SKILL_RANK_MAX = 5;
const skillRankMult = (rank) => 1 + 0.12 * (clamp(rank, 1, SKILL_RANK_MAX) - 1);
const SKILL_UPGRADE = { item: 'ky_nang_gian', cost: (rank, tier) => 4000 * rank * tier };

// ------------------------------------------------------------------ tiến hóa
const EVO_LEVEL = [10, 20, 30, 40, 50, 60, 70, 80];
const EVO = {
  main: (t) => ({ level: EVO_LEVEL[t - 1], bond: 20 + 5 * t, purity: 0, items: { [`evo_t${t}`]: 1 + t }, cost: 20000 * t * t, ownerRealm: tierReqRealm(t + 1) }),
  alt: (t, hanh) => ({ level: EVO_LEVEL[t - 1] + 5, bond: 60, purity: 60, items: { [`evo_t${t}`]: 1 + t, [`ess_${HANH_KEY[hanh]}`]: 2 + t }, cost: 35000 * t * t, ownerRealm: tierReqRealm(t + 1) }),
};

// ------------------------------------------------------------------ nguồn: thu phục & trứng
const EGG = { seconds: (tier) => 120 * tier, rush: 'trung_nho' };
const CAPTURE = {
  base: [0.92, 0.82, 0.70, 0.58, 0.46, 0.36, 0.27, 0.18, 0.10],
  phuBonus: 0.25, luongBonus: 0.08, flee: 0.30, ttl: 1800,
};
function captureChance(tier, ownerRealm, bonus) {
  const gap = Math.max(0, tierReqRealm(tier) - Math.max(0, ownerRealm || 0));
  return clamp(CAPTURE.base[clamp(tier, 1, 9) - 1] * (0.6 ** gap) + bonus, 0.02, 0.95);
}
/** Chỉ số nguồn: 1..4 = Bí Cảnh thường Sơ/Trung/Cao/Vạn Linh Cốc, 5 = Bí Cảnh Đặc Biệt, 6..9 = Linh Giới Luyện Hư/Hợp Thể/Đại Thừa/Độ Kiếp. */
const SOURCE_IDX = { thuong: (t) => 1 + t, dacbiet: () => 5, linhgioi: { luyenhu: 6, hopthe: 7, daithua: 8, dokiep: 9 } };
const EGG_CHANCE = (srcIdx) => clamp(0.02 + 0.008 * srcIdx, 0, 0.12);
const WILD_CHANCE = (srcIdx) => clamp(0.04 + 0.008 * srcIdx, 0, 0.14);
const ITEM_DROP = [      // [item, chance] theo srcIdx (cộng dồn: mỗi dòng một lần tung)
  (s) => ['linh_thu_luong', clamp(0.35, 0, 1), 1 + (s >= 3 ? 1 : 0)],
  (s) => ['linh_thu_dan', clamp(0.02 * s, 0, 0.2), 1],
  (s) => ['bat_phu', 0.05 + 0.005 * s, 1],
  (s) => ['khe_uoc_phu', 0.015 + 0.004 * s, 1],
  (s) => ['huyet_mach_tinh', s >= 4 ? 0.01 * (s - 3) : 0, 1],
  (s) => [`evo_t${clamp(s - 1, 1, 8)}`, 0.04 + 0.006 * s, 1],
  (s) => ['ky_nang_gian', s >= 3 ? 0.012 * (s - 2) : 0, 1],
  (s) => ['ban_menh_huyet', s >= 6 ? 0.004 * (s - 5) : 0, 1],
];
/** Phẩm cấp thú xuất hiện từ nguồn srcIdx: trọng số cho tier 1..9. */
function tierWeights(srcIdx) {
  const w = new Array(9).fill(0);
  const put = (t, v) => { if (t >= 1 && t <= 9) w[t - 1] += v; };
  put(srcIdx, 50); put(srcIdx - 1, 30); put(srcIdx - 2, 14); put(srcIdx + 1, 5); put(srcIdx - 3, 1);
  return w;
}
const WILD_LEVEL = (tier) => [3 + 2 * tier, 8 + 3 * tier];       // [min, max]
const WILD_PURITY = [12, 55];
const EGG_PURITY = [20, 65];
const LEGACY = { purity: 30, bond: 40, contract: 'binh_dang' };   // thú cũ chuyển đổi: giữ tên & cấp, vào ô Đồng Hành 1, xuất chiến

// ------------------------------------------------------------------ chiến đấu (PvP 5 hiệp, thanh sinh mệnh 100)
const COMBAT = {
  HIT: 12,                    // = B.PVP_BASE_HIT (mất % sinh mệnh cho 1 đòn khi ngang nhau) — dùng làm đơn vị
  ASSIST_FRAC: 0.045,          // trợ chiến mỗi hiệp = HIT × 0,20 × rating × thiên hướng ATK
  SKILL_FRAC: 0.065,           // đơn vị kỹ năng chủ động
  DOT_FRAC: 0.04,             // đơn vị sát thương theo thời gian (mỗi hiệp)
  SHIELD_FRAC: 0.10,          // đơn vị khiên (% thanh sinh mệnh)
  HEAL_FRAC: 0.12,            // đơn vị hồi máu
  GUARD_FRAC: 0.06,           // khiên mở màn theo HP thú
  PROC_BASE: 0.28, PROC_SPD: 0.18, PROC_BOND: 0.12, PROC_MIN: 0.2, PROC_MAX: 0.7,
  STUN_BASE: 0.4,             // hệ số nhân tỉ lệ choáng theo rating
  LAST_STAND_HP: 8,           // Bản Mệnh: giữ lại bấy nhiêu % máu khi bị đánh chí mạng (1 lần/trận)
  ELEMENT_ADV: 0.12,          // thú khắc hành chủ địch → trợ chiến +12%, bị khắc −12%
  DEFEND_MULT: 0.55,
  ROUNDS_MAX_MULT: 2.6,
  GLOBAL: 0.55,               // hệ số chung nhân vào rating khi vào trận (PvP rất nhạy: chênh vài % sinh mệnh đã đổi tỉ lệ thắng nhiều)
  SPECIES_TUNE: { thai_son_cu_hung: 0.8, van_han_bang_phuong: 0.75, bach_ho_sat_than: 0.72, hon_don_hu_thuy: 0.7, dung_nham_ma_nguu: 0.9, huyen_bang_giao: 0.9, tuyet_ho_ly: 0.9, co_moc_loc: 0.92, tuc_nhuong_tien_thu: 0.92, hon_don_thieu_the: 1.1, liet_diem_hoa_phuong: 1.0 },   // vi chỉnh từng loài sau mô phỏng
  LINE_TUNE: { Kim: 1.1, Mộc: 1.0, Thủy: 0.6, Hỏa: 1.0, Thổ: 0.8 },   // cân chỉnh theo dòng sau mô phỏng (xem scripts/sim_pets_v14.js)       // trần tổng sát thương trợ chiến mỗi đòn (× HIT)
};
/** Trần cộng dồn hiệu ứng bị động của Linh Thú (đã gồm thiên phú + kỹ năng bị động + kỹ năng truyền thừa). */
const PASSIVE_CAPS = { crit: 0.04, critMult: 0.12, dodge: 0.04, pierce: 0.06, lifesteal: 0.04, dr: 0.04, thorns: 0.06, regen: 1.0, opening: 0.15, execute: 0.15, assist: 0.4, dotAmp: 0.4, shieldAmp: 0.4, proc: 0.12, guard: 1.0 };
/** Hiệu ứng bị động nhân thêm hệ số rating^0.5 để thú yếu không hưởng đủ, rồi chặn trần. */
const passiveScale = (rating) => clamp(Math.max(0, rating), 0.1, 1.6);

const procChance = (rating, spdBias, bond, extra) => clamp(COMBAT.PROC_BASE + COMBAT.PROC_SPD * (spdBias - 1) * 2 + COMBAT.PROC_BOND * clamp(bond, 0, 100) / 100 + (extra || 0) + 0.05 * (rating - 1), COMBAT.PROC_MIN, COMBAT.PROC_MAX);

// ------------------------------------------------------------------ chuyển đổi dữ liệu cũ
const LEGACY_MAP = { 'Hỏa Vân Báo': 'hoa_van_bao', 'Thanh Long Sủng': 'thanh_long_sung', 'Tuyết Hồ Ly': 'tuyet_ho_ly', 'Huyền Vũ Quy': 'huyen_vu_quy' };

// ------------------------------------------------------------------ thả thú
const RELEASE = { items: (tier, level) => ({ linh_thu_luong: Math.max(1, int(level / 8)), [`evo_t${Math.max(1, tier - 1)}`]: tier >= 2 ? 1 : 0 }), linhThach: (tier, level) => 800 * tier * (1 + int(level / 10)) };
const RENAME_MAX = 20;
const CHANGE_SLOT_COST = 0;

module.exports = {
  TIERS, tierInfo, tierReqRealm, LEVEL_MAX, expNeed, levelCap, STAT_BASE, levelFactor, purityFactor, bondFactor, tierFactor,
  CONTRACTS, CONTRACT_BREAK_BOND, SLOT_COUNT, VIEN_CAPACITY, EGG_CAPACITY,
  PURITY_STAGES, STAGE_NAMES, STAGE_TALENT, purityStage, REFINE, INHERIT,
  suppression, rating, statsOf, BOND_MAX, PLAY, BOND_PER_PVP_WIN, BOND_PER_PVP_LOSS, BOND_PER_FEED, bondGain, bondCap,
  COMPANION_EXP_SHARE, expPvp, expBicanh, expBoss, ITEMS, ITEM_ORDER, SHOP_ITEMS, SHOP_DAILY_LIMIT, HANH, HANH_KEY, BASIC_FEED, MAT_FEED,
  SKILL_UNLOCK, SKILL_RANK_MAX, skillRankMult, SKILL_UPGRADE, EVO_LEVEL, EVO, EGG, CAPTURE, captureChance, SOURCE_IDX, EGG_CHANCE, WILD_CHANCE, ITEM_DROP,
  tierWeights, WILD_LEVEL, WILD_PURITY, EGG_PURITY, LEGACY, COMBAT, PASSIVE_CAPS, passiveScale, procChance, LEGACY_MAP, RELEASE, RENAME_MAX, CHANGE_SLOT_COST,
};
