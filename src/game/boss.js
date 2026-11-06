'use strict';
/**
 * Boss Thế Giới v7 — làm lại hoàn toàn.
 *  • Admin triệu hồi (/trieuhoiboss), KHÔNG tự xuất hiện. Mỗi server tối đa 1 boss đang sống.
 *  • HP tự co giãn theo sức mạnh người chơi trong DB (top 10 Công Kích) × hệ số cấp độ; admin có thể đặt HP tay.
 *  • Đánh theo hành động: Tấn Công / Thần Thông (tốn Linh Lực, có bạo kích) / Điều Tức (hồi sức). Hồi chiêu theo từng người.
 *  • Boss phản đòn trừ Sinh Mệnh người đánh (không bao giờ chết hẳn: tối thiểu còn 1).
 *  • Hết hạn mà chưa gục → "trốn thoát", vẫn chia 50% thưởng theo sát thương.
 *  • Mọi thay đổi HP/thưởng nằm trong 1 transaction → không bao giờ chia thưởng hai lần.
 */
const K = require('./constants');
const R = require('./realm');
const Cu = require('./cultivator');
const CP = require('./congphap');
const T = require('./talent');
const TO = require('./talentOps');
const D = require('../db');
const { getSectExpBuffMult } = require('./sectBase');
const { now, int, random, randUniform, randInt, clamp } = require('../util');

const ACTION_CD = Number(process.env.BOSS_ACTION_COOLDOWN || 8);      // giây giữa 2 hành động của 1 người
const DEFAULT_MINUTES = Number(process.env.BOSS_DEFAULT_MINUTES || 30);
const SKILL_COST = 25;                                                  // Linh Lực (%) cho Thần Thông
const MIN_HP_PCT_TO_FIGHT = 0.10;                                       // dưới 10% Sinh Mệnh phải điều tức

const BOSS_TIERS = [
  { name: 'Hắc Phong Lang Vương', realm: 'Kết Đan' }, { name: 'Xích Viêm Hổ Vương', realm: 'Nguyên Anh' },
  { name: 'Huyền Quy Cổ Thú', realm: 'Hóa Thần' }, { name: 'Cửu U Ma Xà', realm: 'Luyện Hư' },
  { name: 'Thôn Thiên Mãng', realm: 'Hợp Thể' }, { name: 'Hỗn Độn Hung Thú', realm: 'Đại Thừa' },
  { name: 'Thiên Cổ Chân Long', realm: 'Độ Kiếp' }, { name: 'Hư Không Cự Thú', realm: 'Chân Tiên' },
  { name: 'Thái Cổ Ma Thần', realm: 'Kim Tiên' },
];
const MAX_CAPDO = BOSS_TIERS.length;

const getBossById = (id) => D.get('SELECT * FROM wb7_boss WHERE boss_id = ?', id);
const getAliveBoss = (guildId) => D.get("SELECT * FROM wb7_boss WHERE guild_id = ? AND status = 'alive' ORDER BY boss_id DESC LIMIT 1", String(guildId));

/** HP gợi ý: ~150 đòn đánh thường của "top 10 mạnh nhất" × 1.8^(cấp-1). */
function suggestedHp(capdo) {
  const rows = D.all('SELECT * FROM cultivators ORDER BY atk DESC LIMIT 10');
  const avg = rows.length ? rows.reduce((s, r) => s + Cu.effectiveAtk(r), 0) / rows.length : 100;
  return Math.max(20000, int(avg * 150 * (1.8 ** (capdo - 1))));
}

function summon({ guildId, channelId, by, capdo = 1, hp = null, minutes = DEFAULT_MINUTES }) {
  guildId = String(guildId);
  if (getAliveBoss(guildId)) return { ok: false, error: 'Đang có một Boss Thế Giới chưa bị trấn áp trong server này.' };
  capdo = clamp(int(capdo) || 1, 1, MAX_CAPDO);
  minutes = clamp(int(minutes) || DEFAULT_MINUTES, 5, 720);
  const maxHp = hp && hp > 0 ? int(hp) : suggestedHp(capdo);
  const t = now(); const tier = BOSS_TIERS[capdo - 1];
  const r = D.run(
    'INSERT INTO wb7_boss (guild_id, channel_id, name, tier, realm_name, hp, max_hp, status, spawned_at, expires_at, summoned_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    guildId, channelId ? String(channelId) : null, tier.name, capdo, tier.realm, maxHp, maxHp, 'alive', t, t + minutes * 60, by ? String(by) : null);
  return { ok: true, boss: getBossById(r.lastInsertRowid) };
}
const setMessage = (bossId, channelId, messageId) => D.run('UPDATE wb7_boss SET channel_id = ?, message_id = ? WHERE boss_id = ?', String(channelId), String(messageId), bossId);

const ranking = (bossId, limit = 10) => D.all('SELECT user_id, damage, hits FROM wb7_damage WHERE boss_id = ? ORDER BY damage DESC LIMIT ?', bossId, limit);
const totals = (bossId) => D.get('SELECT COALESCE(SUM(damage),0) AS dmg, COUNT(*) AS n FROM wb7_damage WHERE boss_id = ?', bossId);
const myStat = (bossId, userId) => D.get('SELECT damage, hits, last_hit FROM wb7_damage WHERE boss_id = ? AND user_id = ?', bossId, String(userId));

/**
 * Một hành động của người chơi. action: 'atk' | 'skill' | 'rest'
 * Trả { ok, error?, cooldown?, ... } — UI dựng Embed từ đây.
 */
function attack(guildId, userId, action = 'atk') {
  userId = String(userId);
  const row0 = Cu.getCultivator(userId);
  if (!row0) return { ok: false, code: 'E001', error: 'Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.' };
  return D.transaction(() => {
    const boss = getAliveBoss(guildId);
    if (!boss) return { ok: false, code: 'E009', error: 'Hiện không có Boss Thế Giới nào — chờ admin triệu hồi.' };
    if (boss.expires_at <= now()) return { ok: false, code: 'E007', error: 'Boss đã hết thời hạn và sắp biến mất.', expired: true, bossId: boss.boss_id };
    const mine = myStat(boss.boss_id, userId);
    const t = now();
    const remain = mine ? ACTION_CD - (t - (mine.last_hit || 0)) : 0;
    if (remain > 0) return { ok: false, code: 'E005', cooldown: remain, error: `Còn **${Math.ceil(remain)} giây** nữa mới ra chiêu tiếp được.`, boss };

    const row = row0;
    const maxHp = Cu.effectiveMaxHp(row);
    let curHp = Cu.syncHpRegen(userId, row);
    const mp0 = row.linh_luc;
    const turn = (D.get('SELECT COALESCE(SUM(hits),0) AS n FROM wb7_damage WHERE boss_id = ?', boss.boss_id).n || 0) + 1;

    if (action === 'rest') {
      const heal = int(maxHp * 0.06); const mpGain = 10;
      curHp = Math.min(maxHp, curHp + heal);
      const mp = Math.min(100, mp0 + mpGain);
      Cu.updateCultivator(userId, { cur_hp: curHp, linh_luc: mp, last_hp_regen: now() });
      D.run('INSERT INTO wb7_damage (boss_id, user_id, damage, hits, last_hit) VALUES (?,?,0,0,?) ON CONFLICT(boss_id, user_id) DO UPDATE SET last_hit = excluded.last_hit', boss.boss_id, userId, t);
      return { ok: true, action, boss, turn, heal, mpGain, hp: curHp, maxHp, mp, dmg: 0, counter: 0, bossHp: boss.hp, finished: false };
    }

    if (curHp < maxHp * MIN_HP_PCT_TO_FIGHT) return { ok: false, code: 'E009', error: `Sinh Mệnh quá thấp (${int(curHp)}/${maxHp}) — hãy **Điều Tức** hoặc chờ hồi phục trước khi giao chiến.`, boss };
    let mp = mp0; let crit = false; let mult = 1;
    if (action === 'skill') {
      if (mp < SKILL_COST) return { ok: false, code: 'E009', error: `Không đủ Linh Lực để thi triển Thần Thông (cần ${SKILL_COST}%, hiện có ${mp}%).`, boss };
      mp -= SKILL_COST; mult = 2; crit = random() < 0.15; if (crit) mult *= 1.5;
    }
    const dmg = Math.max(1, int((Cu.effectiveAtk(row) * randUniform(0.8, 1.3) + row.realm_index * 5) * mult * T.bossElemMult(row, boss.tier)));   // v13.6: tương khắc hành linh căn ↔ nguyên tố Boss (±5%)
    const hpBefore = boss.hp;
    const dealt = Math.min(dmg, hpBefore);
    D.run('UPDATE wb7_boss SET hp = hp - ? WHERE boss_id = ? AND status = ?', dealt, boss.boss_id, 'alive');
    D.run('INSERT INTO wb7_damage (boss_id, user_id, damage, hits, last_hit) VALUES (?,?,?,1,?) ON CONFLICT(boss_id, user_id) DO UPDATE SET damage = damage + excluded.damage, hits = hits + 1, last_hit = excluded.last_hit', boss.boss_id, userId, dealt, t);
    const bossHp = hpBefore - dealt;
    const killed = bossHp <= 0;

    // Phản đòn (không có khi vừa kết liễu)
    let counter = 0;
    if (!killed) {
      counter = int(maxHp * randUniform(0.04, 0.09) * (1 + 0.15 * (boss.tier - 1)));
      curHp = Math.max(1, curHp - counter);
    }
    Cu.updateCultivator(userId, { cur_hp: curHp, linh_luc: mp, last_hp_regen: now(), ...TO.progFields(row, { lc: 1 }) });
    return { ok: true, action, boss, turn, dmg: dealt, crit, counter, hp: curHp, maxHp, mp, bossHp: Math.max(0, bossHp), finished: killed, killerId: killed ? userId : null };
  });
}

/** Chốt boss: chia thưởng + đóng sổ. reason: 'killed' | 'escaped' | 'cancelled'. */
function finish(bossId, reason, killerId = null) {
  return D.transaction(() => {
    const boss = getBossById(bossId);
    if (!boss || boss.status !== 'alive') return null;
    D.run('UPDATE wb7_boss SET status = ?, ended_at = ?, killer_id = ?, hp = CASE WHEN ? = \'killed\' THEN 0 ELSE hp END WHERE boss_id = ?', reason, now(), killerId, reason, bossId);
    const list = D.all('SELECT user_id, damage, hits FROM wb7_damage WHERE boss_id = ? ORDER BY damage DESC', bossId);
    const total = list.reduce((s, c) => s + c.damage, 0);
    const out = { boss: getBossById(bossId), reason, total, contributors: [], drops: [] };
    if (reason === 'cancelled' || !list.length) return out;
    const factor = reason === 'killed' ? 1 : 0.5;
    const tierMult = 1 + (boss.tier - 1) * 0.125;
    for (const [idx, c] of list.entries()) {
      const crow = Cu.getCultivator(c.user_id);
      if (!crow) continue;
      const share = total > 0 ? c.damage / total : 0;
      const weight = (0.35 + 0.65 * Math.min(1, share * 5)) * factor;
      const required = R.tuViRequiredBase(crow.realm_index, crow.stage_index, crow.world_tier); // mốc GỐC: thưởng giữ nguyên khi tăng exp đột phá
      let tuVi = int(required * 0.5 * tierMult * weight * getSectExpBuffMult(crow));
      const thach = int(required * 0.2 * tierMult * weight);
      if (idx === 0 && reason === 'killed') tuVi = int(tuVi * 1.1); // MVP sát thương cao nhất
      Cu.updateCultivator(c.user_id, { tu_vi: crow.tu_vi + tuVi, linh_thach: crow.linh_thach + thach });
      out.contributors.push({ user_id: c.user_id, damage: c.damage, hits: c.hits, share, tuVi, linhThach: thach, rank: idx + 1 });
      // v13.6: Thiên Bảo / Truyền Thừa rơi cho người có đóng góp từ 2% sát thương trở lên khi Boss bị hạ
      if (reason === 'killed' && share >= 0.02) {
        const dr = TO.rollDropItems(c.user_id, 'boss', TO.lootMultOf(crow));
        if (dr.text) out.drops.push({ user_id: c.user_id, kind: 'talent', text: `nhận ${dr.text} từ xác Boss!` });
        TO.addProg(c.user_id, { lc: 5, tc: 2 });
      }
    }
    // Phần thưởng đặc biệt cho người kết liễu (giữ nguyên luật cũ: công pháp độc quyền 0,5% + thưởng đặc biệt 10%)
    if (reason === 'killed' && killerId) {
      const killer = Cu.getCultivator(killerId);
      if (killer) {
        const owned = Cu.ownedCongphapTiers(killer);
        if (!owned.has(K.BOSS_CONGPHAP_DROP_TIER) && random() < K.BOSS_CONGPHAP_DROP_CHANCE) {
          owned.add(K.BOSS_CONGPHAP_DROP_TIER);
          Cu.updateCultivator(killerId, { cong_phap_owned: [...owned].sort((a, b) => a - b).join(',') });
          out.drops.push({ user_id: killerId, kind: 'congphap', text: `cảm ngộ **[Tầng ${K.BOSS_CONGPHAP_DROP_TIER}] ${CP.currentName(K.BOSS_CONGPHAP_DROP_TIER)}** — công pháp độc quyền của Boss Thế Giới!` });
        }
        if (random() < K.BOSS_SPECIAL_DROP_CHANCE) {
          const chain = K.CONGPHAP_SPECIAL_CHAIN;
          const k2 = Cu.getCultivator(killerId);
          const ve = () => Cu.updateCultivator(killerId, { ve_bicanh_dac_biet: (k2.ve_bicanh_dac_biet || 0) + 1 });
          const cur = int(k2.cong_phap_special_tier || 0);
          if (random() < 0.5 && cur < chain.length) {
            Cu.updateCultivator(killerId, { cong_phap_special_tier: cur + 1 });
            out.drops.push({ user_id: killerId, kind: 'special', text: `${cur === 0 ? 'LĨNH NGỘ' : 'ĐỘT PHÁ LÊN'} **${chain[cur].name}** (${cur + 1}/${chain.length}) — chiêu 「${chain[cur].move}」.` });
          } else { ve(); out.drops.push({ user_id: killerId, kind: 've', text: 'nhận **1 Vé Bí Cảnh Đặc Biệt**.' }); }
        }
      }
    }
    return out;
  });
}

/** Các boss đã quá hạn (để vòng nền cho "trốn thoát"). */
const dueBosses = () => D.all("SELECT boss_id FROM wb7_boss WHERE status = 'alive' AND expires_at <= ?", now());
const aliveBosses = () => D.all("SELECT * FROM wb7_boss WHERE status = 'alive'");

module.exports = {
  BOSS_TIERS, MAX_CAPDO, ACTION_CD, SKILL_COST, DEFAULT_MINUTES,
  getBossById, getAliveBoss, suggestedHp, summon, setMessage, ranking, totals, myStat, attack, finish, dueBosses, aliveBosses,
};
