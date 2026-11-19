'use strict';
/**
 * V20.0 — HỌC CÔNG THỨC THẤT TRUYỀN. Công thức đánh dấu `rare` (đan Thiên Địa/Tiên cấp trở lên, trận pháp mới) chỉ chế được sau khi HỌC bằng cuộn
 * (Đan Phương/Trận Đồ Thất Truyền, rơi từ Mỏ Đặc Biệt…). Học 1 lần, vĩnh viễn; cuộn bị tiêu hao. Không ảnh hưởng công thức V17/V19.
 */
const D = require('../db');
const Inv = require('./invsvc');
const Cat = require('./catalog17');
const V = require('../data/v20_data');
const { I, C } = Cat;
const { now } = require('../util');

const uid = (u) => String(u);
let SCROLL_MAP = null;
const scrollMap = () => {
  if (SCROLL_MAP) return SCROLL_MAP; SCROLL_MAP = {};
  for (const r of C.RECIPES) if (r.rare) SCROLL_MAP[V.ID.scroll(r.out.item)] = r.id;
  return SCROLL_MAP;
};
const isScroll = (itemId) => !!scrollMap()[itemId];
const learned = (user, rid) => !!D.get('SELECT 1 AS x FROM v20_learned WHERE user_id = ? AND recipe_id = ?', uid(user), rid);
const needLearn = (rid) => { const r = C.RBY[rid]; return !!(r && r.rare); };
/** Học công thức từ cuộn. Nếu đã học thì KHÔNG tiêu cuộn. */
function learn(user, scrollId) {
  const rid = scrollMap()[scrollId]; if (!rid) return { ok: false, msg: 'Đây không phải cuộn công thức.' };
  return D.transaction(() => {
    const r = C.RBY[rid];
    if (learned(user, rid)) return { ok: false, msg: `Bạn đã học **${r.name}** rồi — cuộn được giữ lại.` };
    if (!Inv.take(user, scrollId, 1, { why: `học ${rid}` })) return { ok: false, msg: `Bạn không có ${I.BY_ID[scrollId].name}.` };
    D.run('INSERT OR IGNORE INTO v20_learned (user_id, recipe_id, at) VALUES (?,?,?)', uid(user), rid, now());
    return { ok: true, rid, msg: `📜 Đã **học vĩnh viễn** công thức **${r.name}** (${C.PROFS[r.prof].name}). Cần cấp nghề ${C.LEVELS[r.lv - 1].name} để chế.` };
  });
}
/** Cuộn công thức mà người chơi đang có trong kho. */
const scrollsOwned = (user) => Object.keys(scrollMap()).filter((id) => Inv.qtyAny(user, id) > 0).map((id) => ({ id, rid: scrollMap()[id], n: Inv.qtyAny(user, id), done: learned(user, scrollMap()[id]) }));
module.exports = { isScroll, learned, needLearn, learn, scrollsOwned, scrollMap };
