// V21.6.3 — tự ack đúng loại (deferUpdate cho nút/menu/modal-từ-tin-nhắn, deferReply cho slash/modal độc lập). Mất ~12 giây (handler giả chậm 2s).
'use strict';
const { wrapInteraction } = require('../src/ui/skin');
const mk = (type) => {
  const calls = [];
  const i = {
    createdTimestamp: Date.now(), deferred: false, replied: false, calls,
    isMessageComponent: () => type === 'button', isModalSubmit: () => type === 'modal' || type === 'modalMsg',
    isFromMessage: () => type === 'modalMsg', isChatInputCommand: () => type === 'slash',
    async deferUpdate() { calls.push('deferUpdate'); i.deferred = true; },
    async deferReply() { calls.push('deferReply'); i.deferred = true; },
    async editReply() { calls.push('editReply'); i.replied = true; },
    async followUp() { calls.push('followUp'); i.replied = true; },
    async reply() { calls.push('reply'); i.replied = true; },
    async update() { calls.push('update'); i.replied = true; },
    async showModal() { calls.push('showModal'); },
  };
  return i;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = [];
  for (const [type, finish] of [['button', 'update'], ['button', 'reply'], ['modalMsg', 'update'], ['modal', 'reply'], ['slash', 'reply'], ['button', 'fast']]) {
    const i = wrapInteraction(mk(type));
    if (finish !== 'fast') await sleep(2000);        // handler chậm 2s > watchdog 1,8s
    await i[finish === 'fast' ? 'update' : finish]({ content: 'x' });
    out.push(`${type.padEnd(9)} finish=${finish.padEnd(6)} -> ${i.calls.join(' > ')}`);
  }
  console.log(out.join('\n'));
  const want = ['deferUpdate > editReply', 'deferUpdate > followUp', 'deferUpdate > editReply', 'deferReply > editReply', 'deferReply > editReply', 'update'];
  const got = out.map((l) => l.split('-> ')[1]);
  const bad = want.filter((w, k) => w !== got[k]);
  if (bad.length) { console.error('FAIL', { want, got }); process.exit(1); }
  console.log('PASS ack2163 (6/6)');
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
