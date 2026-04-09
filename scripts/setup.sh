#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# A2Z WorkHub — First-time Setup Script
# ═══════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "═══════════════════════════════════════════════════"
echo "  A2Z WorkHub — Setup"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── Check prerequisites ──────────────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}[x] $1 chưa được cài đặt.${NC}"
    echo "    Cài đặt: $2"
    exit 1
  fi
  echo -e "${GREEN}[✓]${NC} $1 $(command -v "$1")"
}

echo "Kiểm tra prerequisites..."
check_cmd "node"     "https://nodejs.org/"
check_cmd "npm"      "https://nodejs.org/"
check_cmd "supabase" "npm install -g supabase"
echo ""

# ─── Node version check ───────────────────────────────────────────────────
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}[x] Yêu cầu Node.js >= 18 (hiện tại: $(node -v))${NC}"
  exit 1
fi
echo -e "${GREEN}[✓]${NC} Node.js $(node -v)"
echo ""

# ─── Environment file ─────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
  echo -e "${YELLOW}[!] Tạo .env.local từ template...${NC}"
  cp .env.local.example .env.local
  echo -e "${YELLOW}    → Cập nhật .env.local với Supabase credentials của bạn${NC}"
else
  echo -e "${GREEN}[✓]${NC} .env.local đã tồn tại"
fi
echo ""

# ─── Install dependencies ─────────────────────────────────────────────────
echo "Cài đặt dependencies..."
npm install
echo ""

# ─── Start Supabase ───────────────────────────────────────────────────────
echo "Khởi động Supabase local..."
supabase start || true
echo ""

# ─── Reset database (apply migrations + seed) ─────────────────────────────
echo "Áp dụng migrations + seed data..."
supabase db reset
echo ""

# ─── Generate TypeScript types ─────────────────────────────────────────────
echo "Sinh TypeScript types từ database..."
npm run db:types
echo ""

# ─── Done ──────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════"
echo -e "${GREEN}  Setup hoàn tất!${NC}"
echo ""
echo "  Chạy dev server:  npm run dev"
echo "  Mở app:           http://localhost:3000"
echo "  Supabase Studio:  http://localhost:54323"
echo ""
echo "  Test accounts (password: Test@2026!):"
echo "    admin:  hoangquoctuan1395@gmail.com"
echo "═══════════════════════════════════════════════════"
