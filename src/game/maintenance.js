'use strict';
/**
 * CHẾ ĐỘ BẢO TRÌ TOÀN BOT (v14.2). Admin bật bằng /baotri → MỌI lệnh slash/tiền tố, nút bấm, menu, modal của người chơi đều bị chặn
 * và trả về thông báo bảo trì; các vòng nền làm thay đổi game (Boss, Tông Môn Chiến, Đại Phú, xoay Công Pháp/Đan Dược, quét treo quan)
 * tạm dừng. Trạng thái lưu trong bot_settings nên còn nguyên sau khi bot khởi động lại (bot khởi động lại vẫn đang bảo trì cho tới khi admin /baotri tắt).
 * Ngoại lệ: lệnh `/baotri` (để tắt) và các lệnh admin ẩn bắt đầu bằng "!" (restore_db, tongmonchien_*...). Auto-backup vẫn chạy.
 * Treo quan dựa theo mốc thời gian nên thời gian bảo trì VẪN được tính cho người đang treo (công bằng, không ai thiệt).
 */
const ST = require('./settings');
const { now } = require('../util');

const get = () => {
  const on = ST.get('maint_on', '0') === '1';
  return {
    on, reason: ST.get('maint_reason', ''), since: Number(ST.get('maint_since', '0')) || 0,
    eta: Number(ST.get('maint_eta', '0')) || 0, by: ST.get('maint_by', ''),
  };
};
/** Đường nóng — chỉ đọc cache của settings. */
const isOn = () => ST.get('maint_on', '0') === '1';

function enable({ by = '', reason = '', minutes = 0 } = {}) {
  ST.set('maint_on', '1'); ST.set('maint_reason', String(reason || '').slice(0, 300));
  ST.set('maint_since', Math.floor(now())); ST.set('maint_by', String(by || ''));
  ST.set('maint_eta', minutes > 0 ? Math.floor(now()) + Math.floor(minutes) * 60 : 0);
  return get();
}
function disable() {
  const before = get();
  ST.set('maint_on', '0'); ST.set('maint_reason', ''); ST.set('maint_eta', 0);
  return before;
}

/** Nội dung thông báo cho người chơi (Embed) — dùng chung cho slash / tiền tố / nút bấm. */
function notice() {
  const { EmbedBuilder } = require('discord.js');
  const s = get();
  const lines = ['🛠️ **Bot đang được bảo trì.** Mọi tính năng tạm dừng — tu vi, vật phẩm và tiến độ của bạn vẫn được giữ nguyên.'];
  if (s.reason) lines.push(`📝 Lý do: ${s.reason}`);
  if (s.eta > now()) lines.push(`⏳ Dự kiến mở lại: <t:${s.eta}:R> (<t:${s.eta}:t>)`);
  else lines.push('⏳ Sẽ mở lại sớm, mong đạo hữu thông cảm.');
  return new EmbedBuilder().setTitle('🛠️ BẢO TRÌ').setColor(0xF1C40F).setDescription(lines.join('\n'));
}

module.exports = { get, isOn, enable, disable, notice };
