'use strict';
/**
 * v22.4.3 — Thần Giới CHƯA xây xong: tự hạ mọi người đang ở bậc thế giới > mức đang mở (mặc định Tiên Giới = 2) xuống Tiên Giới.
 *  - Chỉ đổi `world_tier` (và gỡ danh hiệu có chữ "Thần Giới"). Cảnh giới, tu vi, vật phẩm, công pháp… giữ nguyên 100%.
 *  - Sao lưu nhất quán (VACUUM INTO) trước khi sửa; danh sách người bị hạ lưu trong bot_flags `v2243_thangioi_demoted` để khôi phục khi Thần Giới mở.
 *  - Chạy mỗi lần khởi động (idempotent: không còn ai ở Thần Giới thì không làm gì, không sao lưu).
 *  - Admin mở lại Thần Giới: `bot_settings thangioi = on` (xem R.maxWorldTier). Ngoài ra Cu.getCultivator cũng tự hạ người lọt qua giữa 2 lần khởi động.
 */
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const D = require('../db'); const R = require('./realm');

const FLAG = 'v2243_thangioi_demoted';
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
function backup(n) {
  const errs = [];
  for (const dir of [path.join(path.dirname(D.DB_PATH), 'db_backups'), path.join(os.tmpdir(), 'tiengioi_db_backups')]) {
    try {
      fs.mkdirSync(dir, { recursive: true }); const dest = path.join(dir, `tutien_PRE_V22_4_3_${stamp()}.db`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      D.db().exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
      if (!fs.existsSync(dest) || fs.statSync(dest).size < 1) throw new Error('file sao lưu rỗng');
      return { path: dest, errs };
    } catch (e) { errs.push(`${dir}: ${e.message}`); }
  }
  return { path: null, errs, n };
}
function run() {
  const mx = R.maxWorldTier();
  const rows = D.all('SELECT user_id, world_tier, title FROM cultivators WHERE world_tier > ?', mx);
  if (!rows.length) return { moved: 0, backup: null };
  const bk = backup(rows.length);
  if (!bk.path) return { moved: 0, aborted: true, error: `⚠️ Không sao lưu được (${bk.errs.join(' | ')}) — chưa hạ ${rows.length} người khỏi Thần Giới (getCultivator vẫn tự hạ khi họ thao tác).` };
  D.transaction(() => {
    for (const r of rows) {
      const t = String(r.title || '').includes('Thần Giới') ? '' : r.title;
      D.run('UPDATE cultivators SET world_tier = ?, title = ? WHERE user_id = ?', mx, t, r.user_id);
    }
    let old = []; try { const f = D.get('SELECT value FROM bot_flags WHERE key = ?', FLAG); if (f) old = JSON.parse(f.value); } catch (_) { old = []; }
    const list = old.concat(rows.map((r) => ({ id: String(r.user_id), tier: r.world_tier, title: r.title || '', at: Math.floor(Date.now() / 1000) })));
    D.run('INSERT INTO bot_flags (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', FLAG, JSON.stringify(list).slice(0, 900000));
    try { D.run('DELETE FROM server_ascend_rank WHERE world_tier > ?', mx); } catch (_) { /* bảng có thể chưa có */ }
  });
  return { moved: rows.length, backup: bk.path, ids: rows.map((r) => String(r.user_id)) };
}
module.exports = { run, FLAG };
