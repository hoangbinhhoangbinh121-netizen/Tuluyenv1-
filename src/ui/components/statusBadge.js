'use strict';
const { E } = require('../emojis');
const KINDS = { ok: 'xacnhan', fail: 'tuchoi', warn: 'sk_canhbao', info: 'thongtin', time: 'sk_thoigian', lock: 'sk_camkhoa', fight: 'kiem', boss: 'bosstg' };
/** "<icon> Văn bản" — nhãn trạng thái chuẩn. */
const badge = (kind, text) => `${E[KINDS[kind] || KINDS.info]} ${text}`;
module.exports = { badge, KINDS };
