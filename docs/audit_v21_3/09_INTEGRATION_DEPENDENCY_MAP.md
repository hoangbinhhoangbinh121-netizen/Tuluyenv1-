# 09 — Bản đồ phụ thuộc (sinh tự động từ `require()` thật, V21.4)

Tổng 182 file JS trong src/ + index.js. Module KHÔNG ai require: src/ui/index.js.

| Module | Được gọi bởi (số) | Gọi tới (số) | Callers |
|---|---|---|---|
| `game/cultivator.js` | 82 | 8 | commands/admin.js, commands/adminTuChat.js, commands/adminXem.js, commands/basic.js, commands/chiendau.js, commands/dan.js, commands/framework.js, commands/kho.js, commands/phithang.js, commands/pvp.js, commands/sect.js, commands/sectwar.js, commands/social.js, commands/talent.js, game/actionsBasic. |
| `game/stat21.js` | 2 | 6 | game/combat21.js, game/inspect.js |
| `game/combat21.js` | 4 | 13 | commands/pvp.js, game/pvp.js, game/pvpCore.js, ui/pvpViews.js |
| `game/pvpCore.js` | 3 | 18 | commands/pvp.js, game/combat21.js, game/pvp.js |
| `game/pvp.js` | 3 | 10 | bot.js, commands/pvp.js, ui/pvpViews.js |
| `game/petCombat.js` | 3 | 5 | game/combat21.js, game/pvp.js, game/pvpCore.js |
| `game/fx17.js` | 19 | 5 | game/actionsBasic.js, game/ascension.js, game/balance.js, game/boss.js, game/chungdao19.js, game/cultivator.js, game/dan17.js, game/dotpha.js, game/drops17.js, game/gear17.js, game/gear20.js, game/inspect.js, game/pvpCore.js, game/sectwar.js, game/stat21.js, game/talent.js, game/tran17.js, game/tran |
| `game/cpfx.js` | 10 | 4 | game/bicanh19.js, game/boss.js, game/congphap.js, game/congphapV16.js, game/cultivator.js, game/inspect.js, game/pvpCore.js, game/stat21.js, game/talent.js, ui/congphapViews.js |
| `game/talent.js` | 20 | 4 | commands/adminTuChat.js, commands/guideTalent.js, game/actionsBasic.js, game/adminTalent.js, game/ascension.js, game/balance.js, game/bicanh.js, game/bicanh19.js, game/boss.js, game/chungdao19.js, game/combat21.js, game/cpfx.js, game/cultivator.js, game/dan.js, game/dotpha.js, game/inspect.js, game/ |
| `game/invsvc.js` | 35 | 5 | commands/social.js, game/admin17.js, game/benmenh19.js, game/bicanh19.js, game/chungdao19.js, game/chungdaoGuide.js, game/congphapV16.js, game/craft17.js, game/dan17.js, game/dihoa20.js, game/donhang20.js, game/drops17.js, game/event19.js, game/field17.js, game/field20.js, game/gear17.js, game/gear2 |
| `game/economy.js` | 2 | 5 | commands/dan.js, ui/shopViews.js |
| `game/boss.js` | 4 | 17 | commands/chiendau.js, ui/bossViews.js, ui/chienDau.js, ui/event19Views.js |
| `game/bicanh19.js` | 4 | 21 | bot.js, game/chungdaoGuide.js, ui/bicanh19Views.js, ui/event19Views.js |
| `game/chungdao19.js` | 4 | 15 | commands/tiengioi19.js, game/chungdaoGuide.js, game/dotpha.js, ui/chungdaoViews.js |
| `game/sectwar.js` | 5 | 11 | background.js, bot.js, commands/hiddenAdmin.js, commands/sectwar.js, ui/sectWarViews.js |
| `game/shop21.js` | 3 | 11 | commands/shop21.js, ui/quantriViews.js, ui/shop21Views.js |
| `ui/kit.js` | 29 | 4 | bot.js, commands/admin.js, commands/adminXem.js, commands/basic.js, commands/dan.js, commands/guide.js, commands/guideTalent.js, game/pvp.js, ui/bicanh19Views.js, ui/bossViews.js, ui/chienDau.js, ui/chungdaoViews.js, ui/components/confirmDialog.js, ui/components/pagination.js, ui/congphapViews.js, u |
| `ui/validate.js` | 2 | 0 | ui/kit.js, ui/skin.js |
| `ui/skin.js` | 3 | 7 | bot.js, commands/framework.js, ui/index.js |
| `ui/pvpViews.js` | 2 | 9 | commands/pvp.js, ui/menus.js |
| `ui/bicanh19Views.js` | 1 | 8 | commands/tiengioi19.js |

## Luồng dữ liệu chính (đọc từ mã)
- **Chỉ số**: `cultivator.effective*` ← (`cpfx`, `fx17`, `fx19`, `talent`) · `stat21.snapshot` đối chiếu · mọi chế độ (`pvpCore/combat21`, `boss`, `bicanh19`, `chungdao19`, `sectwar`, `dotpha`) đọc qua `Cu.effective*`.
- **PvP**: `commands/pvp` → `pvp.js` (khiêu chiến/View) → `combat21` (vòng) → `pvpCore.roundAction` (công thức) ↔ `petCombat`/`cpfx` (hiệu ứng thật) → `pvpCore.settleBattle/settlePvpAtomic` (DB, 1 transaction) → `v213_battles`.
- **UI**: tin nhắn → `skin.normalizePayload` → `validate.check`; nút → `kit.routeComponent` → (static handler | View.handler).
- **Kinh tế**: Linh Thạch → `Cu.updateCultivator` (≈33 file) + SQL trực tiếp ở trade/sectwar/ascension; vật phẩm → `invsvc` → `inv_items`; Nguyên Bảo → `shop21` → `v21_*`.
- **Linh Thú chiến đấu**: chỉ `pvp.js`/`pvpCore.js`/`combat21.js` gọi `petCombat` (Boss/Bí Cảnh/Chứng Đạo/Tông Chiến KHÔNG dùng) → ảnh hưởng khi thiết kế tích hợp chủng tộc ở V21.5.
