'use strict';
/**
 * Đảm bảo bảng TuTienStore tồn tại. Định nghĩa bảng nằm ở src/db/schema_store.js và được D.migrate() tạo sẵn.
 * ensure() chỉ là lớp bảo hiểm: nhớ cờ THEO THẾ HỆ KẾT NỐI DB (đổi/đóng/mở lại DB → cờ tự mất hiệu lực),
 * để sau /restore_db hay khi file DB bị thay, bảng vẫn được tạo lại thay vì báo "no such table: store_wallet".
 */
const D = require('../db');

let readyGen = -1;
function ensure() {
  if (readyGen === D.generation()) return;
  D.migrate();
  readyGen = D.generation();
}
module.exports = { ensure };
