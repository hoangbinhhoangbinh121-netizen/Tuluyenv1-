#!/usr/bin/env bash
# Cập nhật bot từ file zip mới, GIỮ NGUYÊN token (.env), database (data/), logs/, node_modules/.
# Dùng (chạy trong thư mục bot):   bash scripts/redeploy.sh duong/dan/tien-gioi-bot-v7.zip
#   hoặc:                          npm run redeploy -- duong/dan/tien-gioi-bot-v7.zip
# Biến tuỳ chọn: PM2_NAME=ten-process (mặc định tự dò)  ·  NO_RESTART=1 (chỉ giải nén + cài gói)
set -euo pipefail
ZIP="${1:-}"; [ -f "$ZIP" ] || { echo "Cách dùng: bash scripts/redeploy.sh <file.zip>"; exit 1; }
ZIP="$(cd "$(dirname "$ZIP")" && pwd)/$(basename "$ZIP")"
cd "$(dirname "${BASH_SOURCE[0]}")/.."
APP="$(pwd)"; TS="$(date +%Y%m%d_%H%M%S)"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "🛡️  Sao lưu .env + data → .redeploy_backup/$TS"
mkdir -p ".redeploy_backup/$TS"
[ -f .env ] && cp -a .env ".redeploy_backup/$TS/"
[ -d data ] && cp -a data ".redeploy_backup/$TS/"

echo "📦 Giải nén $ZIP"
if command -v unzip >/dev/null 2>&1; then unzip -q -o "$ZIP" -d "$TMP"; else python3 -m zipfile -e "$ZIP" "$TMP"; fi
# zip có thể bọc 1 thư mục ngoài → tự nhận
if [ ! -f "$TMP/package.json" ]; then n=$(ls -d "$TMP"/*/ 2>/dev/null | head -1); [ -f "${n}package.json" ] && TMP2="$n" || { echo "❌ Zip không có package.json"; exit 1; }; else TMP2="$TMP/"; fi

echo "📂 Chép mã nguồn mới (giữ .env, data, logs, node_modules)"
tar -C "$TMP2" -cf - --exclude=./.env --exclude=./data --exclude=./logs --exclude=./node_modules --exclude=./.redeploy_backup . | tar -C "$APP" -xf -

echo "⬇️  Cài gói phụ thuộc"
npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3 || echo "⚠️ npm install lỗi — kiểm tra mạng rồi chạy lại 'npm install'"

if [ "${NO_RESTART:-0}" = "1" ]; then echo "✅ Xong (chưa khởi động lại)."; exit 0; fi
if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q '"name"'; then
  NAME="${PM2_NAME:-$(pm2 jlist | python3 -c "import sys,json;[print(p['name']) for p in json.load(sys.stdin) if p.get('pm2_env',{}).get('pm_cwd')=='$APP']" | head -1)}"
  if [ -n "$NAME" ]; then pm2 restart "$NAME" --update-env && echo "✅ Đã khởi động lại PM2: $NAME"; exit 0; fi
fi
echo "✅ Đã cập nhật. Hãy khởi động lại bot (npm start / panel host). Token & DB cũ giữ nguyên."
