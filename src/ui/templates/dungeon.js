'use strict';
/** Mẫu Bí cảnh (spec §3.7): kết quả khám phá — màu Tử Tinh. */
const { createEmbed } = require('../components/baseEmbed');
const { COLORS } = require('../theme/colors');
const N = require('../notifications');
const { safe } = require('../format');

function result(text, { name } = {}) {
  const t = String(safe(text, ''));
  if (/^(?:❌|🔒)/u.test(t)) return N.error(t.replace(/^(?:❌|🔒)\s*/u, ''));
  if (/^⏳/.test(t)) return N.cooldown(t.replace(/^⏳\s*/, ''));
  return createEmbed({ cat: 'bicanh', status: 'Kết quả khám phá', title: name, color: COLORS.SPECIAL, description: t });
}
module.exports = { result };
