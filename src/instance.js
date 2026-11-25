'use strict';
/** v21.6.3: danh tính của TIẾN TRÌNH bot đang chạy — để phát hiện 2 bản bot cùng token chạy song song (mỗi bản trả lời ngẫu nhiên, menu của bản này "hết hạn" ở bản kia). */
const crypto = require('node:crypto'); const os = require('node:os');
const VERSION = require('../package.json').version;
const ID = crypto.randomBytes(2).toString('hex');
const BOOT_AT = Math.trunc((Date.now() - process.uptime() * 1000) / 1000);
const info = () => ({ id: ID, version: VERSION, pid: process.pid, host: os.hostname(), bootAt: BOOT_AT, node: process.version, rssMb: Math.round(process.memoryUsage().rss / 1048576) });
module.exports = { ID, VERSION, BOOT_AT, info };
