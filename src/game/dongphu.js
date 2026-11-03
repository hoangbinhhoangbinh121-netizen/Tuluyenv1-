'use strict';
const K = require('./constants');
const CD = require('./cooldowns');
const Cu = require('./cultivator');
const F = require('./format');
const { E } = require('./emoji');
const { geminiGenerate } = require('./ai');
const { now, randInt, choice, fmtNum } = require('../util');
const { Delta } = Cu;

const randomFlavor = () => `Một ${choice(K.DONGPHU_DIA_HINH)}, bên trong có ${choice(K.DONGPHU_DAC_SAN)}, linh khí bàng bạc quanh năm.`;
const upgradeCost = (level) => 1000 * (level + 1) ** 2;

async function doTaodongphu(userId) {
  const row = Cu.getCultivator(userId);
  if (row.dongphu_level > 0) return { ok: false, msg: `❌ Bạn đã có động phủ **${row.dongphu_ten}** rồi, không cần tạo lại.` };
  const prompt = "Hãy đặt 1 cái tên (dạng '4-6 chữ Hán Việt') và viết 1 câu mô tả ngắn (dưới 35 từ, tiếng Việt, văn phong tiên hiệp) cho một động phủ tu tiên ngẫu nhiên, độc nhất vô nhị. Trả lời đúng định dạng:\nTên: ...\nMô tả: ...";
  const fbName = `${choice(['Vân', 'Huyền', 'Thanh', 'Bích', 'U'])}${choice(['Vũ', 'Nguyệt', 'Sơn', 'Hà', 'Yên'])} Động`;
  const generated = await geminiGenerate(prompt, `Tên: ${fbName}\nMô tả: ${randomFlavor()}`);
  let ten = fbName; let mota = randomFlavor();
  for (const raw of generated.split('\n')) {
    const line = raw.trim(); const low = line.toLowerCase();
    if (low.startsWith('tên:')) ten = line.split(/:(.*)/s)[1].trim() || ten;
    else if (low.startsWith('mô tả:')) mota = line.split(/:(.*)/s)[1].trim() || mota;
  }
  Cu.updateCultivator(userId, { dongphu_ten: ten, dongphu_mota: mota, dongphu_level: 1, last_dongphu: 0 });
  return { ok: true, msg: `${E.dongphu} Bạn đã khai phá thành công **${ten}**!\n> ${mota}`, ten, mota };
}

function doThuhoach(userId) {
  const row = Cu.getCultivator(userId);
  if (row.dongphu_level <= 0) return '❌ Bạn chưa có động phủ. Hãy tạo một động phủ riêng trước.';
  const t = now(); const remain = CD.COOLDOWN_DONGPHU - (t - row.last_dongphu);
  if (remain > 0) return `⏳ Còn ${F.fmtTime(remain)} nữa động phủ mới sinh ra linh khí mới.`;
  const lv = row.dongphu_level; const lt = randInt(200, 400) * lv; const tv = randInt(5, 12) * lv;
  Cu.updateCultivator(userId, { linh_thach: row.linh_thach + lt, tu_vi: row.tu_vi + tv, last_dongphu: t });
  return `${E.dongphu} Thu hoạch linh khí tại **${row.dongphu_ten}**, nhận **${fmtNum(lt)}** ${E.linhthach} Linh Thạch và **${tv}** ✨ tu vi.`;
}

function doNangcap(userId) {
  const row = Cu.getCultivator(userId);
  if (row.dongphu_level <= 0) return '❌ Bạn chưa có động phủ. Hãy tạo một động phủ riêng trước.';
  const cost = upgradeCost(row.dongphu_level);
  if (row.linh_thach < cost) return `❌ Không đủ Linh Thạch để nâng cấp (cần ${fmtNum(cost)}, hiện có ${fmtNum(row.linh_thach)}).`;
  if (!Cu.updateCultivator(userId, { linh_thach: new Delta(-cost), dongphu_level: row.dongphu_level + 1 }, { linh_thach: cost })) return Cu.MSG_BALANCE_CHANGED;
  return `${E.dongphu} Động phủ **${row.dongphu_ten}** đã nâng lên cấp **${row.dongphu_level + 1}** (-${fmtNum(cost)} ${E.linhthach} Linh Thạch)!` + F.balanceLine(Cu.getCultivator(userId), 'linh_thach');
}

const CATEGORY_NAME = '🏞️ ĐỘNG PHỦ TU TIÊN';
const slug = (raw) => {
  let n = raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^0-9a-zà-ỹ-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  return n ? n.slice(0, 90) : 'dong-phu';
};
/** Tạo (hoặc lấy lại) kênh riêng tư cho động phủ — null nếu thiếu quyền/không ở trong server. */
async function getOrCreateChannel(guild, member, ten) {
  const { ChannelType, PermissionFlagsBits } = require('discord.js');
  if (!guild) return null;
  const row = Cu.getCultivator(member.id);
  if (row && row.dongphu_channel_id) {
    const ex = guild.channels.cache.get(String(row.dongphu_channel_id));
    if (ex) return ex;
  }
  try {
    let cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME);
    if (!cat) cat = await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory });
    const perms = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];
    if (guild.members.me) perms.push({ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
    const name = member.displayName || member.username;
    const ch = await guild.channels.create({
      name: `dong-phu-${slug(name)}`, type: ChannelType.GuildText, parent: cat.id, permissionOverwrites: perms,
      topic: `🏞️ ${ten} — động phủ riêng tư của ${name}, chỉ mình bạn nhìn thấy.`, reason: `Khai phá động phủ cho ${member.id}`,
    });
    Cu.updateCultivator(member.id, { dongphu_channel_id: ch.id });
    try { await ch.send(`${E.dongphu} Chào mừng <@${member.id}> đến với **${ten}**!\nĐây là kênh riêng tư của bạn, chỉ bạn mới thấy — dùng \`/dongphu\` ngay tại đây để thu hoạch linh khí và nâng cấp động phủ.`); } catch (_) { /* bỏ qua */ }
    return ch;
  } catch (_) { return null; }
}
module.exports = { upgradeCost, randomFlavor, doTaodongphu, doThuhoach, doNangcap, getOrCreateChannel };
