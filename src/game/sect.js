'use strict';
/** Tông Môn: lập / gia nhập / rời / đổi tên / bổ nhiệm / cống hiến — port 1:1 */
const K = require('./constants');
const Cu = require('./cultivator');
const D = require('../db');
const { E } = require('./emoji');
const { fmtNum } = require('../util');

const ROLES = K.SECT_ROLES;
const ROLE_ORDER = ['tongchu', 'pho_tongchu', 'truong_lao', 'tinh_anh', 'detu'];
const NOT_STARTED = '❌ Bạn chưa bắt đầu tu tiên, dùng `/batdau` trước.';
const isUnique = (e) => /UNIQUE/i.test(String(e && e.message));

function createSect(userId, name) {
  const row = Cu.getCultivator(userId);
  if (!row) return NOT_STARTED;
  if (row.sect_id) return '❌ Bạn đã có tông môn rồi, phải rời đi trước khi lập tông môn mới.';
  name = String(name || '').trim();
  if (!name || name.length > 50) return '❌ Tên tông môn không hợp lệ (tối đa 50 ký tự).';
  let sectId;
  try { sectId = D.run('INSERT INTO sects (name, leader_id) VALUES (?, ?)', name, userId).lastInsertRowid; }
  catch (e) { if (isUnique(e)) return `❌ Tông môn **${name}** đã tồn tại, hãy chọn tên khác.`; throw e; }
  Cu.updateCultivator(userId, { sect_id: sectId, sect_role: 'tongchu' });
  return `${E.tongmon} Đã lập tông môn **${name}**, bạn là Tông Chủ!`;
}

function joinSect(userId, name) {
  const row = Cu.getCultivator(userId);
  if (!row) return NOT_STARTED;
  if (row.sect_id) return '❌ Bạn đã có tông môn, hãy rời đi trước.';
  const sect = D.get('SELECT sect_id FROM sects WHERE name = ?', name);
  if (!sect) return `❌ Không tìm thấy tông môn **${name}**.`;
  Cu.updateCultivator(userId, { sect_id: sect.sect_id, sect_role: 'detu' });
  return `${E.tongmon} Đã gia nhập tông môn **${name}**.`;
}

function leaveSect(userId) {
  const row = Cu.getCultivator(userId);
  if (!row) return NOT_STARTED;
  if (!row.sect_id) return '❌ Bạn chưa gia nhập tông môn nào.';
  const sect = D.get('SELECT * FROM sects WHERE sect_id = ?', row.sect_id);
  const others = sect ? D.get('SELECT COUNT(*) c FROM cultivators WHERE sect_id = ? AND user_id != ?', row.sect_id, userId).c : 0;
  const isLeader = sect && String(sect.leader_id) === String(userId);
  if (isLeader && others > 0) return '❌ Bạn là Tông Chủ và tông môn còn thành viên khác — hãy nhường ngôi cho người khác trước (`/bonhiemtongmon` chọn chức vụ `tongchu`) rồi mới rời được.';
  if (isLeader && others === 0) D.run('DELETE FROM sects WHERE sect_id = ?', row.sect_id);
  Cu.updateCultivator(userId, { sect_id: null, sect_contribution: 0, sect_role: 'detu' });
  return `${E.tongmon} Đã rời khỏi tông môn.`;
}

function renameSect(userId, newName) {
  const row = Cu.getCultivator(userId);
  if (!row) return NOT_STARTED;
  if (!row.sect_id) return '❌ Bạn chưa gia nhập tông môn nào.';
  newName = String(newName || '').trim();
  if (!newName || newName.length > 50) return '❌ Tên tông môn không hợp lệ (tối đa 50 ký tự).';
  const sect = D.get('SELECT * FROM sects WHERE sect_id = ?', row.sect_id);
  if (!sect || String(sect.leader_id) !== String(userId)) return '❌ Chỉ Tông Chủ mới có thể đổi tên tông môn.';
  try { D.run('UPDATE sects SET name = ? WHERE sect_id = ?', newName, row.sect_id); }
  catch (e) { if (isUnique(e)) return `❌ Tên **${newName}** đã được tông môn khác sử dụng.`; throw e; }
  return `${E.tongmon} Đã đổi tên tông môn từ **${sect.name}** thành **${newName}**.`;
}

function setSectRole(actorId, targetId, roleKey) {
  const actor = Cu.getCultivator(actorId);
  if (!actor) return NOT_STARTED;
  if (!actor.sect_id) return '❌ Bạn chưa gia nhập tông môn nào.';
  if (!ROLES[roleKey]) return '❌ Chức vụ không hợp lệ. Dùng: pho_tongchu / truong_lao / tinh_anh / detu / tongchu.';
  const sect = D.get('SELECT * FROM sects WHERE sect_id = ?', actor.sect_id);
  if (!sect || String(sect.leader_id) !== String(actorId)) return '❌ Chỉ Tông Chủ mới có thể bổ nhiệm chức vụ.';
  const target = D.get('SELECT * FROM cultivators WHERE user_id = ? AND sect_id = ?', targetId, actor.sect_id);
  if (!target) return '❌ Người này không phải thành viên tông môn của bạn.';
  if (String(targetId) === String(actorId)) return '❌ Không thể tự bổ nhiệm cho chính mình.';
  if (roleKey === 'tongchu') {
    D.transaction(() => {
      D.run('UPDATE sects SET leader_id = ? WHERE sect_id = ?', targetId, actor.sect_id);
      D.run("UPDATE cultivators SET sect_role = 'pho_tongchu' WHERE user_id = ? AND sect_id = ?", actorId, actor.sect_id);
      D.run("UPDATE cultivators SET sect_role = 'tongchu' WHERE user_id = ? AND sect_id = ?", targetId, actor.sect_id);
    });
    return `👑 Đã nhường ngôi Tông Chủ cho <@${targetId}>.`;
  }
  D.run('UPDATE cultivators SET sect_role = ? WHERE user_id = ? AND sect_id = ?', roleKey, targetId, actor.sect_id);
  return `${ROLES[roleKey].emoji} Đã bổ nhiệm <@${targetId}> làm **${ROLES[roleKey].label}**.`;
}

function donateSect(userId, amount) {
  const row = Cu.getCultivator(userId);
  if (!row) return NOT_STARTED;
  if (!row.sect_id) return '❌ Bạn chưa gia nhập tông môn nào.';
  if (!(amount > 0) || row.tu_vi < amount) return '❌ Số tu vi cống hiến không hợp lệ hoặc không đủ.';
  let leveled = '';
  D.transaction(() => {
    Cu.updateCultivator(userId, { tu_vi: row.tu_vi - amount, sect_contribution: row.sect_contribution + amount });
    D.run('UPDATE sects SET exp = exp + ? WHERE sect_id = ?', amount, row.sect_id);
    const s = D.get('SELECT exp, level FROM sects WHERE sect_id = ?', row.sect_id);
    if (s && s.exp >= s.level * 1000) { D.run('UPDATE sects SET level = level + 1 WHERE sect_id = ?', row.sect_id); leveled = ' 🎉 Tông môn đã thăng cấp!'; }
  });
  return `${E.tongmon} Đã cống hiến ${amount} tu vi cho tông môn.${leveled}`;
}

const memberCount = (sectId) => D.get('SELECT COUNT(*) c FROM cultivators WHERE sect_id = ?', sectId).c;
const getSect = (sectId) => D.get('SELECT * FROM sects WHERE sect_id = ?', sectId);
const listMembers = (sectId) => D.all('SELECT user_id, sect_role, sect_contribution FROM cultivators WHERE sect_id = ? ORDER BY sect_contribution DESC', sectId);
const topSects = () => D.all('SELECT s.*, (SELECT COUNT(*) FROM cultivators c WHERE c.sect_id = s.sect_id) AS member_count FROM sects s ORDER BY s.level DESC, s.exp DESC LIMIT 10');

module.exports = { ROLE_ORDER, createSect, joinSect, leaveSect, renameSect, setSectRole, donateSect, memberCount, getSect, listMembers, topSects };
