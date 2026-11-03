'use strict';
const { View } = require('../kit');

const paginate = (items, perPage = 8) => {
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length ? pages : [[]];
};

/**
 * View chuyển trang. render(pageIndex) → { embeds:[...] }.  Trả { view, payload() } — payload() cho tin nhắn đầu tiên.
 * Chỉ chủ nhân bấm được; hết hạn thì menu báo rõ (xem kit.routeComponent).
 */
function pagerView({ ownerId, total, render, timeout = 600, start = 0 }) {
  let page = Math.max(0, Math.min(start, total - 1));
  const v = new View({ ownerId, timeout });
  const payload = () => {
    v.find('pos').builder.setLabel(`${page + 1}/${total}`);
    return { ...render(page), components: v.components() };
  };
  const go = (fn) => (i) => { page = fn(page); return i.update(payload()); };
  const off = total <= 1;
  v.button({ key: 'first', label: '«', style: 'secondary', disabled: off }, go(() => 0));
  v.button({ key: 'prev', label: 'Trước', style: 'secondary', disabled: off }, go((p) => (p - 1 + total) % total));
  v.button({ key: 'pos', label: `${page + 1}/${total}`, style: 'secondary', disabled: true });
  v.button({ key: 'next', label: 'Sau', style: 'secondary', disabled: off }, go((p) => (p + 1) % total));
  return { view: v, payload };
}
module.exports = { paginate, pagerView };
