'use strict';
/** Tiên Giới UI Design System v7.0 — cửa ngõ duy nhất. Module mới CHỈ import từ đây, không tự dựng Embed/màu/emoji. */
module.exports = {
  ...require('./theme/colors'),
  rarity: require('./theme/rarity'),
  typography: require('./theme/typography'),
  spacing: require('./theme/spacing'),
  fmt: require('./format'),
  emojis: require('./emojis'),
  createEmbed: require('./components/baseEmbed').createEmbed,
  progressBar: require('./components/progressBar').progressBar,
  statField: require('./components/statField').statField,
  section: require('./components/section').section,
  itemLine: require('./components/itemCard').itemLine,
  badge: require('./components/statusBadge').badge,
  pagerView: require('./components/pagination').pagerView,
  confirmDialog: require('./components/confirmDialog').confirmDialog,
  notify: require('./notifications'),
  templates: {
    character: require('./templates/character'), cultivation: require('./templates/cultivation'), breakthrough: require('./templates/breakthrough'),
    battle: require('./templates/battle'), dungeon: require('./templates/dungeon'), worldEvent: require('./templates/worldEvent'),
  },
  skin: require('./skin'),
};
