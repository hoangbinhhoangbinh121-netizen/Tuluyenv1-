'use strict';
/** Hộp xác nhận chuẩn cho thao tác quan trọng (spec §5): nút Xác Nhận (xanh) + Hủy (đỏ). */
const { View, EPHEMERAL } = require('../kit');
const { E } = require('../emojis');
const { createEmbed } = require('./baseEmbed');

/**
 * @param interaction  tương tác hiện tại (chưa trả lời)
 * @param o { ownerId, title, description, danger, confirmLabel, onConfirm(i), onCancel(i) }
 */
async function confirmDialog(interaction, { ownerId, title = 'Xác nhận thao tác', description, danger = true, confirmLabel = 'Xác Nhận', onConfirm, onCancel }) {
  const v = new View({ ownerId: ownerId ?? interaction.user.id, timeout: 120 });
  v.button({ key: 'ok', label: confirmLabel, emoji: E.xacnhan, style: danger ? 'red' : 'green' }, async (i) => { v.stop(); return onConfirm(i); });
  v.button({ key: 'no', label: 'Hủy', emoji: E.tuchoi, style: 'secondary' }, async (i) => {
    v.stop();
    if (onCancel) return onCancel(i);
    return i.update({ embeds: [createEmbed({ cat: 'hethong', header: 'ĐÃ HỦY', description: 'Thao tác đã được hủy.', color: 0x8B9BB4 })], components: [] });
  });
  v.onTimeout = () => { try { interaction.editReply({ components: [] }).catch(() => {}); } catch (_) { /* bỏ qua */ } };
  const emb = createEmbed({ cat: 'hethong', header: 'XÁC NHẬN', title, description: `${description}\n\n${danger ? `${E.sk_canhbao} Không thể hoàn tác sau khi xác nhận.` : ''}`.trim(), color: danger ? 0xE36C75 : 0xD6B56D });
  return interaction.reply({ embeds: [emb], components: v.components(), flags: EPHEMERAL });
}
module.exports = { confirmDialog };
