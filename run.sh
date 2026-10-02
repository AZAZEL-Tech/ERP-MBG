#!/usr/bin/env bash
# Script peluncur server aplikasi Dapur MBG
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================================"
echo "    DAPUR MBG - Satuan Pelayanan Pemenuhan Gizi (SPPG)"
echo "    Sistem Manajemen Logistik Pangan & Keuangan MBG"
echo "========================================================"

PORT=8008
echo "Menjalankan server pada http://localhost:$PORT..."
exec python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT --reload
