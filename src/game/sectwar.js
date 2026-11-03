'use strict';
/** Tông Môn Chiến + Kho Tông — port 1:1 (dữ liệu, giao chiến, vòng chấm điểm, kết thúc trận) */
const K = require('./constants');
const CD = require('./cooldowns');
const Cu = require('./cultivator');
const D = require('../db');
const { E } = require('./emoji');
const { getSectName } = require('./sectBase');
const BAL = require('./balance');
const { now, int, random, randUniform, fmtNum } = require('../util');

const NODES = {
  trungtam: { name: 'Trung Tâm', emoji: '🏛️', points: 30 }, bac: { name: 'Bắc Thành', emoji: '🟥', points: 15 },
  dong: { name: 'Đông Thành', emoji: '🟦', points: 15 }, nam: { name: 'Nam Thành', emoji: '🟨', points: 15 }, tay: { name: 'Tây Thành', emoji: '🟩', points: 15 },
};
const NODE_ORDER = ['bac', 'tay', 'trungtam', 'dong', 'nam'];
const TICK_SECONDS = 10; const NODE_CAPTURE_SECONDS = 30; const WIN_SCORE = 5000; const KILL_POINTS = 10;
const REWARD_WIN_CONGHIEN = 10000; const REWARD_WIN_LINHTHACH = 5000000; const REWARD_LOSE_CONGHIEN = 5000; const REWARD_LOSE_LINHTHACH = 2000000;
const REWARD_WIN_TITLE = 'Bá Chủ Bát Hoang'; const CRIT_CHANCE = 0.15; const CRIT_MULT = 1.5; const DODGE_CHANCE = 0.10;
const REVIVE_SECONDS = 20; const ATTACK_COOLDOWN_SECONDS = 2; const RUTKHO_DAILY_LIMIT = 5000000; const WARBAR_LENGTH = 10;
const WAR_DURATION = CD.WAR_DURATION_SECONDS; const REWARD_WIN_BUFF_SECONDS = CD.REWARD_WIN_BUFF_SECONDS;

const warbar = (pct) => { const f = Math.max(0, Math.min(WARBAR_LENGTH, Math.round(WARBAR_LENGTH * pct / 100))); return E.warbar_fill.repeat(f) + E.warbar_empty.repeat(WARBAR_LENGTH - f); };
const fmtTimeLeft = (s) => { s = Math.max(0, int(s)); return `${Math.floor(s / 60)}p${String(s % 60).padStart(2, '0')}s`; };
const isEligible = (row) => !!row && row.world_tier === 0 && (row.realm_index < K.HOATHAN_REALM_IDX || (row.realm_index === K.HOATHAN_REALM_IDX && row.stage_index <= K.HOATHAN_VIENMAN_STAGE));
const eligibilityText = () => 'Phàm Giới, tu vi tối đa **Hóa Thần Viên Mãn**';

const getActiveWar = (guildId) => D.get("SELECT * FROM sect_wars WHERE guild_id = ? AND status IN ('registration','launching','active') ORDER BY war_id DESC LIMIT 1", guildId);
const getOtherActiveWarForUser = (userId, excludeGuild) => D.get("SELECT w.* FROM sect_wars w JOIN sect_war_participants p ON p.war_id = w.war_id WHERE p.user_id = ? AND w.status IN ('registration','launching','active') AND w.guild_id != ? ORDER BY w.war_id DESC LIMIT 1", userId, excludeGuild);

function createWar(guildId, channelId, status = 'registration') {
  return D.transaction(() => {
    const id = D.run('INSERT INTO sect_wars (guild_id, channel_id, status, started_at, ends_at) VALUES (?, ?, ?, ?, 0)', guildId, channelId, status, now()).lastInsertRowid;
    for (const key of Object.keys(NODES)) D.run('INSERT INTO sect_war_nodes (war_id, node_key, owner_sect_id, capture_sect_id, capture_progress) VALUES (?, ?, NULL, NULL, 0)', id, key);
    return id;
  });
}
const activateWar = (warId) => { const t = now(); D.run("UPDATE sect_wars SET status = 'active', started_at = ?, ends_at = ? WHERE war_id = ?", t, t + WAR_DURATION, warId); };
function joinWar(warId, userId, sectId) {
  const row = Cu.getCultivator(userId); const maxHp = row ? Math.max(1, Cu.effectiveMaxHp(row)) : 1;
  D.run('INSERT INTO sect_war_participants (war_id, user_id, sect_id, node_key, last_seen, hp, max_hp) VALUES (?, ?, ?, NULL, ?, ?, ?) ON CONFLICT(war_id, user_id) DO UPDATE SET sect_id = excluded.sect_id, last_seen = excluded.last_seen', warId, userId, sectId, now(), maxHp, maxHp);
}
const getParticipant = (warId, userId) => D.get('SELECT * FROM sect_war_participants WHERE war_id = ? AND user_id = ?', warId, userId);
const isDown = (part) => !!part && !!part.revive_at && part.revive_at > now();
function moveToNode(warId, userId, sectId, nodeKey) {
  const part = getParticipant(warId, userId);
  if (isDown(part)) return 'down';
  const row = Cu.getCultivator(userId); const maxHp = row ? Math.max(1, Cu.effectiveMaxHp(row)) : 1;
  const justRevived = !!part && !!part.revive_at && part.revive_at <= now() && !part.hp;
  const curHp = (!part || justRevived) ? maxHp : (part.hp || maxHp);
  D.run(`INSERT INTO sect_war_participants (war_id, user_id, sect_id, node_key, last_seen, hp, max_hp, revive_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(war_id, user_id) DO UPDATE SET sect_id = excluded.sect_id, node_key = excluded.node_key, last_seen = excluded.last_seen, max_hp = excluded.max_hp, hp = excluded.hp, revive_at = 0`,
  warId, userId, sectId, nodeKey, now(), Math.min(curHp, maxHp), maxHp);
  return 'ok';
}
const getWarNodes = (warId) => Object.fromEntries(D.all('SELECT * FROM sect_war_nodes WHERE war_id = ?', warId).map((r) => [r.node_key, r]));
const getWarScores = (warId) => Object.fromEntries(D.all('SELECT sect_id, points FROM sect_war_scores WHERE war_id = ?', warId).map((r) => [String(r.sect_id), r.points]));
const addScore = (warId, sectId, amount) => D.run('INSERT INTO sect_war_scores (war_id, sect_id, points) VALUES (?, ?, ?) ON CONFLICT(war_id, sect_id) DO UPDATE SET points = points + excluded.points', warId, sectId, amount);

// ---- chống spam nút (trong bộ nhớ) ----
const lastAction = new Map();
function checkActionCooldown(userId) {
  const t = now(); const remain = ATTACK_COOLDOWN_SECONDS - (t - (lastAction.get(String(userId)) || 0));
  if (remain > 0) return remain;
  lastAction.set(String(userId), t); return 0;
}

function getAttackableEnemies(warId, attackerId) {
  const part = getParticipant(warId, attackerId);
  if (isDown(part)) return { error: `☠️ Bạn đang trọng thương, còn **${int(Math.max(0, part.revive_at - now()))}s** nữa mới hồi sinh được.` };
  if (!part || !part.node_key) return { error: '❌ Bạn chưa tiến quân vào cứ điểm nào — bấm nút tiến quân trước.' };
  const enemies = D.all('SELECT * FROM sect_war_participants WHERE war_id = ? AND node_key = ? AND sect_id != ? AND user_id != ? AND (revive_at IS NULL OR revive_at <= ?)', warId, part.node_key, part.sect_id, attackerId, now());
  if (!enemies.length) return { error: `⚔️ Không có địch nào của tông môn khác tại **${NODES[part.node_key].name}** để giao chiến.` };
  return { nodeKey: part.node_key, enemies };
}

function doAttack(warId, attackerId, targetId) {
  const part = getParticipant(warId, attackerId);
  if (isDown(part)) return `☠️ Bạn đang trọng thương, còn **${int(Math.max(0, part.revive_at - now()))}s** nữa mới hồi sinh được.`;
  if (!part || !part.node_key) return '❌ Bạn chưa tiến quân vào cứ điểm nào — bấm nút tiến quân trước.';
  const nodeKey = part.node_key; const t = now();
  const target = D.get('SELECT * FROM sect_war_participants WHERE war_id = ? AND user_id = ? AND node_key = ? AND sect_id != ? AND (revive_at IS NULL OR revive_at <= ?)', warId, targetId, nodeKey, part.sect_id, t);
  if (!target) return '❌ Mục tiêu không còn ở cứ điểm này nữa (đã di chuyển/bị hạ) — hãy chọn lại.';
  const atkRow = Cu.getCultivator(attackerId); const defRow = Cu.getCultivator(target.user_id);
  if (random() < DODGE_CHANCE) return `🌀 <@${target.user_id}> đã né tránh đòn tấn công của <@${attackerId}> tại **${NODES[nodeKey].name}**!`;
  const isCrit = random() < CRIT_CHANCE;
  const maxHp = target.max_hp || Math.max(1, defRow ? Cu.effectiveMaxHp(defRow) : 1);
  // v12.3: cùng mô hình % sinh mệnh với PvP (chênh cảnh giới/chỉ số quyết định có kiểm soát, không còn atk - def tuyệt đối)
  const frac = (atkRow && defRow) ? BAL.warHitFrac(atkRow, defRow, Cu) : 0.1;
  let damage = int(maxHp * frac * randUniform(0.6, 1.4));
  if (isCrit) damage = int(damage * CRIT_MULT);
  damage = Math.max(1, damage);
  const hp = (target.hp ? target.hp : maxHp) - damage;
  const critTxt = isCrit ? ' 💥 **Bạo Kích!**' : '';
  if (hp <= 0) {
    D.transaction(() => {
      D.run('UPDATE sect_war_participants SET kills = kills + 1 WHERE war_id = ? AND user_id = ?', warId, attackerId);
      D.run('UPDATE sect_war_participants SET hp = 0, node_key = NULL, revive_at = ? WHERE war_id = ? AND user_id = ?', t + REVIVE_SECONDS, warId, target.user_id);
      addScore(warId, part.sect_id, KILL_POINTS);
    });
    return `☠️ <@${attackerId}> đã **HẠ GỤC** <@${target.user_id}> tại **${NODES[nodeKey].name}**!${critTxt} (-${damage} HP, +${KILL_POINTS} điểm cho tông môn). Đối phương trọng thương **${REVIVE_SECONDS}s**.`;
  }
  D.run('UPDATE sect_war_participants SET hp = ?, assists = assists + 1 WHERE war_id = ? AND user_id = ?', hp, warId, target.user_id);
  return `⚔️ <@${attackerId}> gây **${damage}** sát thương lên <@${target.user_id}> tại **${NODES[nodeKey].name}**.${critTxt} (HP còn lại: ${Math.max(0, hp)}/${maxHp})`;
}

// ---- vòng lặp nền ----
function tickWar(war) {
  const warId = war.war_id;
  for (const node of D.all('SELECT * FROM sect_war_nodes WHERE war_id = ?', warId)) {
    const key = node.node_key;
    const sectIds = D.all('SELECT DISTINCT sect_id FROM sect_war_participants WHERE war_id = ? AND node_key = ?', warId, key).map((r) => r.sect_id);
    if (sectIds.length === 1) {
      const occ = sectIds[0];
      if (String(occ) === String(node.owner_sect_id)) { /* đã sở hữu */ }
      else if (String(occ) === String(node.capture_sect_id)) {
        const np = node.capture_progress + TICK_SECONDS;
        if (np >= NODE_CAPTURE_SECONDS) D.run('UPDATE sect_war_nodes SET owner_sect_id = ?, capture_sect_id = NULL, capture_progress = 0 WHERE war_id = ? AND node_key = ?', occ, warId, key);
        else D.run('UPDATE sect_war_nodes SET capture_progress = ? WHERE war_id = ? AND node_key = ?', np, warId, key);
      } else D.run('UPDATE sect_war_nodes SET capture_sect_id = ?, capture_progress = ? WHERE war_id = ? AND node_key = ?', occ, TICK_SECONDS, warId, key);
    }
    const owner = D.get('SELECT owner_sect_id FROM sect_war_nodes WHERE war_id = ? AND node_key = ?', warId, key).owner_sect_id;
    if (owner) addScore(warId, owner, NODES[key].points);
  }
}
function finishWar(warId, winnerSectId) {
  D.run("UPDATE sect_wars SET status = 'finished', winner_sect_id = ? WHERE war_id = ?", winnerSectId, warId);
  const parts = D.all('SELECT * FROM sect_war_participants WHERE war_id = ?', warId);
  const bySect = new Map();
  for (const p of parts) { const k = String(p.sect_id); if (!bySect.has(k)) bySect.set(k, []); bySect.get(k).push(p.user_id); }
  let mvp = null;
  const tops = parts.filter((p) => p.kills > 0);
  if (tops.length) { const best = tops.reduce((a, b) => (b.kills > a.kills ? b : a)); mvp = [best.user_id, best.kills]; }
  const t = int(now());
  for (const [sectId, uids] of bySect) {
    const won = winnerSectId !== null && winnerSectId !== undefined && String(sectId) === String(winnerSectId);
    const lt = won ? REWARD_WIN_LINHTHACH : REWARD_LOSE_LINHTHACH; const ch = won ? REWARD_WIN_CONGHIEN : REWARD_LOSE_CONGHIEN;
    D.run('UPDATE sects SET treasury = treasury + ? WHERE sect_id = ?', lt, sectId);
    if (won) D.run('UPDATE sects SET title = ?, exp_buff_until = ? WHERE sect_id = ?', REWARD_WIN_TITLE, t + REWARD_WIN_BUFF_SECONDS, sectId);
    const share = Math.floor(ch / Math.max(1, uids.length));
    for (const uid of uids) D.run('UPDATE cultivators SET sect_contribution = sect_contribution + ? WHERE user_id = ?', share, uid);
  }
  return mvp;
}
/** Chạy 1 nhịp cho mọi trận active; trả về danh sách thông báo kết thúc để bot gửi vào kênh. */
function runTick() {
  const finished = [];
  for (const war of D.all("SELECT * FROM sect_wars WHERE status = 'active'")) {
    D.transaction(() => tickWar(war));
    const scores = getWarScores(war.war_id);
    let winner = null;
    for (const [sid, pts] of Object.entries(scores)) if (pts >= WIN_SCORE) { winner = sid; break; }
    const timedOut = now() >= war.ends_at; const has = Object.keys(scores).length > 0;
    if (winner === null && timedOut && has) winner = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    if (winner !== null || (timedOut && !has)) {
      const mvp = D.transaction(() => finishWar(war.war_id, winner));
      finished.push({ war, winner, mvp });
    }
  }
  return finished;
}

// ---- Kho Tông ----
function khotongInfo(sectId) {
  const sect = D.get('SELECT * FROM sects WHERE sect_id = ?', sectId);
  if (!sect) return null;
  const weekAgo = now() - 7 * 86400;
  const income = D.get(`SELECT COALESCE(SUM(w.reward), 0) AS total FROM (SELECT sw.war_id, (CASE WHEN sw.winner_sect_id = ? THEN ${REWARD_WIN_LINHTHACH} ELSE ${REWARD_LOSE_LINHTHACH} END) AS reward FROM sect_wars sw JOIN sect_war_participants swp ON swp.war_id = sw.war_id AND swp.sect_id = ? WHERE sw.status = 'finished' AND sw.started_at >= ? GROUP BY sw.war_id) w`, sectId, sectId, weekAgo);
  return { sect, income: income ? income.total : 0 };
}
function doRutkho(userId, amount) {
  const row = Cu.getCultivator(userId);
  if (!row || !row.sect_id) return '❌ Bạn chưa gia nhập tông môn nào.';
  if (!(amount > 0)) return '❌ Số lượng không hợp lệ.';
  const today = new Date(); const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return D.transaction(() => {
    const sect = D.get('SELECT * FROM sects WHERE sect_id = ?', row.sect_id);
    if (!sect) return '❌ Không tìm thấy tông môn.';
    if (String(sect.leader_id) !== String(userId)) return '❌ Chỉ Tông Chủ mới được rút Kho Tông.';
    if (sect.treasury < amount) return `❌ Kho Tông không đủ Linh Thạch (hiện có ${fmtNum(sect.treasury)}).`;
    const used = sect.rutkho_day === day ? sect.rutkho_today : 0;
    if (used + amount > RUTKHO_DAILY_LIMIT) return `❌ Vượt giới hạn rút mỗi ngày (${fmtNum(RUTKHO_DAILY_LIMIT)}). Hôm nay còn rút được tối đa ${fmtNum(Math.max(0, RUTKHO_DAILY_LIMIT - used))}.`;
    D.run('UPDATE sects SET treasury = MAX(0, treasury - ?), rutkho_day = ?, rutkho_today = ? WHERE sect_id = ?', amount, day, used + amount, row.sect_id);
    D.run('UPDATE cultivators SET linh_thach = linh_thach + ? WHERE user_id = ?', amount, userId);
    return `💰 Tông Chủ đã rút **${fmtNum(amount)}** Linh Thạch từ Kho Tông vào túi riêng.`;
  });
}
function doNopkho(userId, amount) {
  const row = Cu.getCultivator(userId);
  if (!row || !row.sect_id) return '❌ Bạn chưa gia nhập tông môn nào.';
  if (!(amount > 0) || row.linh_thach < amount) return '❌ Số Linh Thạch không hợp lệ hoặc không đủ.';
  return D.transaction(() => {
    const cur = D.get('SELECT linh_thach FROM cultivators WHERE user_id = ?', userId);
    if (!cur || (cur.linh_thach || 0) < amount) return '❌ Số Linh Thạch không hợp lệ hoặc không đủ.';
    D.run('UPDATE cultivators SET linh_thach = linh_thach - ? WHERE user_id = ? AND linh_thach >= ?', amount, userId, amount);
    D.run('UPDATE sects SET treasury = treasury + ? WHERE sect_id = ?', amount, row.sect_id);
    return `🏛️ Đã đóng góp **${fmtNum(amount)}** Linh Thạch vào Kho Tông.`;
  });
}

module.exports = {
  NODES, NODE_ORDER, TICK_SECONDS, NODE_CAPTURE_SECONDS, WIN_SCORE, REWARD_WIN_TITLE, REWARD_WIN_LINHTHACH, RUTKHO_DAILY_LIMIT, REVIVE_SECONDS,
  warbar, fmtTimeLeft, isEligible, eligibilityText, getActiveWar, getOtherActiveWarForUser, createWar, activateWar, joinWar, getParticipant, isDown, moveToNode,
  getWarNodes, getWarScores, checkActionCooldown, getAttackableEnemies, doAttack, runTick, khotongInfo, doRutkho, doNopkho,
};
