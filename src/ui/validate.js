'use strict';
/**
 * v21.4 — Kiểm tra payload Discord TRƯỚC khi gửi (giới hạn thật của Discord API), để lỗi kiểu "custom_id trùng" không còn lọt lên Discord rồi
 * làm cả tin nhắn bị từ chối (50035) — nguyên nhân thật của lỗi "Bí Cảnh không lập được đội" (nút Rời Đội & Hủy Phòng trùng custom_id).
 *   • Runtime: skin.normalizePayload gọi validatePayload → ghi log lỗi rõ ràng (không chặn gửi).
 *   • Test: đặt TG_STRICT_UI=1 → ném lỗi ngay, nên MỌI test hiện có đều thành test kiểm tra component.
 */
const json = (x) => (x && typeof x.toJSON === 'function' ? x.toJSON() : x);
const L = { rows: 5, perRow: 5, label: 80, customId: 100, options: 25, placeholder: 150, embeds: 10, fields: 25, title: 256, desc: 4096, fname: 256, fvalue: 1024, footer: 2048, author: 256, embedTotal: 6000, content: 2000 };

function validateComponents(components) {
  const out = []; if (!components) return out;
  if (!Array.isArray(components)) return ['components không phải mảng'];
  if (components.length > L.rows) out.push(`quá ${L.rows} hàng (${components.length})`);
  const seen = new Map();
  components.forEach((r0, ri) => {
    const r = json(r0); const cs = (r && r.components) || [];
    if (!cs.length) out.push(`hàng ${ri} rỗng`);
    const selects = cs.filter((c) => { const j = json(c); return j.type !== 2; });
    if (selects.length && cs.length > 1) out.push(`hàng ${ri}: select phải đứng một mình`);
    if (cs.length > L.perRow) out.push(`hàng ${ri}: quá ${L.perRow} thành phần (${cs.length})`);
    cs.forEach((c0, ci) => {
      const c = json(c0);
      if (c.type === 2 && c.style === 5) { if (!c.url) out.push(`hàng ${ri} nút ${ci}: nút link thiếu url`); return; }
      const id = c.custom_id;
      if (typeof id !== 'string' || !id.length) out.push(`hàng ${ri} thành phần ${ci}: thiếu custom_id`);
      else {
        if (id.length > L.customId) out.push(`custom_id dài ${id.length} > ${L.customId}: ${id.slice(0, 40)}…`);
        if (seen.has(id)) out.push(`custom_id TRÙNG: "${id}" (hàng ${seen.get(id)} và hàng ${ri})`); else seen.set(id, ri);
      }
      if (c.type === 2) {
        if (!(c.label && String(c.label).length) && !c.emoji) out.push(`nút "${id}" không có nhãn lẫn emoji`);
        if (c.label && String(c.label).length > L.label) out.push(`nút "${id}" nhãn dài > ${L.label}`);
      } else {
        const op = c.options || [];
        if (!op.length || op.length > L.options) out.push(`select "${id}" có ${op.length} lựa chọn (1–${L.options})`);
        if (c.placeholder && c.placeholder.length > L.placeholder) out.push(`select "${id}" placeholder quá dài`);
        const vals = new Set(); for (const o of op) { if (vals.has(o.value)) out.push(`select "${id}" trùng giá trị "${o.value}"`); vals.add(o.value); }
      }
    });
  });
  return out;
}

function validateEmbeds(embeds) {
  const out = []; if (!embeds) return out;
  if (!Array.isArray(embeds)) return ['embeds không phải mảng'];
  if (embeds.length > L.embeds) out.push(`quá ${L.embeds} embed`);
  let sum = 0;
  embeds.forEach((e0, k) => {
    const e = json(e0) || {}; let n = 0; const f = e.fields || [];
    if (f.length > L.fields) out.push(`embed ${k}: ${f.length} field > ${L.fields}`);
    const add = (s, max, what) => { const t = String(s || ''); n += t.length; if (t.length > max) out.push(`embed ${k}: ${what} dài ${t.length} > ${max}`); };
    add(e.title, L.title, 'title'); add(e.description, L.desc, 'description'); add(e.footer && e.footer.text, L.footer, 'footer'); add(e.author && e.author.name, L.author, 'author');
    f.forEach((x, i) => { add(x.name, L.fname, `field ${i}.name`); add(x.value, L.fvalue, `field ${i}.value`); if (!String(x.name || '').length || !String(x.value || '').length) out.push(`embed ${k}: field ${i} rỗng`); });
    if (n > L.embedTotal) out.push(`embed ${k}: tổng ${n} ký tự > ${L.embedTotal}`);
    sum += n;
  });
  if (sum > L.embedTotal) out.push(`tổng các embed ${sum} ký tự > ${L.embedTotal}`);
  return out;
}

function validatePayload(p) {
  if (!p || typeof p !== 'object') return [];
  const out = [...validateComponents(p.components), ...validateEmbeds(p.embeds)];
  if (typeof p.content === 'string' && p.content.length > L.content) out.push(`content dài ${p.content.length} > ${L.content}`);
  return out;
}

/** Gọi trong đường gửi: strict (TG_STRICT_UI=1) → ném lỗi; thường → log. */
function check(p, where = '') {
  let probs; try { probs = validatePayload(p); } catch (e) { return; }
  if (!probs.length) return;
  const msg = `UI không hợp lệ${where ? ` [${where}]` : ''}: ${probs.slice(0, 6).join(' · ')}`;
  if (process.env.TG_STRICT_UI === '1') throw new Error(msg);
  console.error(`⚠️ ${msg}`);
}
module.exports = { validateComponents, validateEmbeds, validatePayload, check, LIMITS: L };
