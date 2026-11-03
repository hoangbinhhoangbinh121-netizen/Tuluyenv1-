'use strict';
/** Cửa ngõ duy nhất để lấy emoji: không module nào được tự dán emoji riêng. */
const em = require('../../game/emoji');
module.exports = {
  E: em.E, BAR: em.BAR, realmEmoji: em.realmEmoji, toComponentEmoji: em.toComponentEmoji, skinEmojiText: em.skinEmojiText,
  fallback: require('./fallback'),
  rarity: (id) => em.E[require('../theme/rarity').get(id).emoji],
};
