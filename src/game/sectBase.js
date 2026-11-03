'use strict';
const D = require('../db');
const K = require('./constants');
const { now } = require('../util');

function getSectExpBuffMult(row) {
  if (!row || !row.sect_id) return 1.0;
  const sect = D.get('SELECT exp_buff_until FROM sects WHERE sect_id = ?', row.sect_id);
  if (sect && sect.exp_buff_until && sect.exp_buff_until > now()) return K.SECT_WAR_EXP_BUFF_MULT;
  return 1.0;
}
function getSectName(sectId) {
  if (!sectId) return 'Chưa gia nhập';
  const r = D.get('SELECT name FROM sects WHERE sect_id = ?', sectId);
  return r ? r.name : 'Chưa gia nhập';
}
function effectiveSectRole(userId, row) {
  if (!row || !row.sect_id) return 'detu';
  const sect = D.get('SELECT leader_id FROM sects WHERE sect_id = ?', row.sect_id);
  if (sect && String(sect.leader_id) === String(userId)) return 'tongchu';
  return K.SECT_ROLES[row.sect_role] ? row.sect_role : 'detu';
}
module.exports = { getSectExpBuffMult, getSectName, effectiveSectRole };
