'use strict';
/** Các vòng lặp nền (random công pháp/đan dược, event, tông môn chiến...) — sẽ gắn dần khi port xong từng module. */
const fs = require('node:fs');
const path = require('node:path');
const D = require('./db');

const AUTO_BACKUP_HOURS = Number(process.env.AUTO_BACKUP_HOURS || 6);   // 0 = tắt

function startBackground(client) {
  // Một Ngày Đại Phú: kiểm tra mở/khoá event + cập nhật giá theo chu kỳ.
  const DP = require('./game/daiphu');
  const MT = require('./game/maintenance');   // v14.2: bảo trì toàn bot → các vòng nền làm đổi dữ liệu game tạm dừng
  const guard = (name, fn) => () => { if (MT.isOn()) return; try { fn(); } catch (e) { console.error(`⚠️ ${name} lỗi:`, e.message); } };
  setInterval(guard('daiphu_state', DP.stateTick), DP.STATE_CHECK * 1000).unref();
  setInterval(guard('daiphu_market', DP.marketTick), DP.MARKET_CYCLE * 1000).unref();
  // Bế Quan Treo: v14.2 không còn giới hạn giờ (TREO_MAX_HOURS = 0 → sweepExpired là no-op); giữ vòng quét phòng khi admin bật lại giới hạn.
  const TQ = require('./game/treoquan');
  setInterval(guard('treo_sweep', () => TQ.sweepExpired()), 60 * 1000).unref();
  guard('treo_sweep', () => TQ.sweepExpired())();
  // Vòng chấm điểm Tông Môn Chiến — mỗi 10 giây cho mọi trận đang active.
  const W = require('./game/sectwar'); const SV = require('./ui/sectWarViews');
  setInterval(async () => {
    if (MT.isOn()) return;
    try { for (const f of W.runTick()) await SV.announceFinished(client, f); }
    catch (e) { console.error('⚠️ sect_war_tick lỗi:', e.message); }
  }, W.TICK_SECONDS * 1000).unref();
  // Boss Thế Giới v7: hết hạn → trốn thoát + làm mới bảng đếm lùi.
  const BV = require('./ui/bossViews');
  setInterval(() => { if (MT.isOn()) return; BV.tick(client).catch((e) => console.error('⚠️ boss_tick lỗi:', e.message)); }, 15000).unref();
  // Xoay vòng tên/mô tả Công Pháp + Đan Dược mỗi 5 phút (Gemini, có fallback local).
  const CP = require('./game/congphap'); const Dan = require('./game/dan'); const CDn = require('./game/cooldowns');
  const loop = (name, fn, sec) => {
    const tick = async () => { if (MT.isOn()) return; try { await fn(); } catch (e) { console.error(`⚠️ ${name} lỗi:`, e.message); } };
    tick(); setInterval(tick, sec * 1000).unref();
  };
  loop('congphap_rotate', CP.refreshRotatingCongphap, CDn.CONGPHAP_ROTATE_SECONDS);
  loop('danduoc_rotate', Dan.refreshRotatingDanduoc, CDn.DANDUOC_ROTATE_SECONDS);

  if (AUTO_BACKUP_HOURS > 0) {
    const { makeBackup, listBackups } = require('./commands/admin');
    const run = () => {
      try {
        const G = require('./db/diskguard');
        G.pruneBackups();                       // dọn bản cũ TRƯỚC khi tạo bản mới
        if (!G.canBackup()) { console.warn(`⚠️ Bỏ qua auto-backup vì ổ đĩa sắp đầy — ${G.report().text}`); return; }
        const dir = path.join(path.dirname(D.DB_PATH), 'db_backups'); fs.mkdirSync(dir, { recursive: true });
        const n = new Date(); const p = (x) => String(x).padStart(2, '0');
        makeBackup(path.join(dir, `tutien_auto_${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}_${p(n.getHours())}${p(n.getMinutes())}.db`));
        G.pruneBackups();
      } catch (e) { console.error('⚠️ Auto-backup lỗi:', e.message); }
    };
    setInterval(run, AUTO_BACKUP_HOURS * 3600 * 1000).unref();
    setTimeout(run, 60 * 1000).unref();   // có ngay 1 bản mới nhất sau khi bot khởi động (bản cũ tự bị xoá)
    console.log(`💾 Tự sao lưu DB mỗi ${AUTO_BACKUP_HOURS}h — luôn chỉ giữ bản MỚI NHẤT, bản cũ tự động xoá.`);
  }
}
module.exports = { startBackground };
