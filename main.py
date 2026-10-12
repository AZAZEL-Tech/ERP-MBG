import os
from datetime import datetime, date, timedelta
from typing import Optional, List
from decimal import Decimal
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import database

app = FastAPI(title="Dapur MBG - Manajemen Logistik & Keuangan SPPG (MySQL)")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Pastikan folder static ada
os.makedirs(os.path.join(STATIC_DIR, "css"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "js"), exist_ok=True)

# Inisialisasi DB MySQL saat start
database.init_db()

# Mount folder static
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Dapur MBG API running. Frontend index.html ready to be loaded."}

# Pydantic Schemas
class PurchaseCreate(BaseModel):
    date: str
    item_name: str
    category: str
    quantity: float
    unit: str
    unit_price: float
    total_price: Optional[float] = None
    supplier: Optional[str] = ""
    notes: Optional[str] = ""
    auto_record_expense: Optional[bool] = True

class StockOutCreate(BaseModel):
    date: str
    item_name: str
    category: str
    quantity: float
    unit: str
    unit_price: Optional[float] = 0.0
    total_price: Optional[float] = None
    purpose: Optional[str] = "Pengolahan Menu MBG"
    recipient_school: Optional[str] = ""
    chef_or_staff: Optional[str] = ""
    notes: Optional[str] = ""

class InventoryCreate(BaseModel):
    date: str
    item_name: str
    category: str
    remaining_qty: float
    unit: str
    item_condition: Optional[str] = "Baik / Segar"
    storage_location: Optional[str] = "Gudang Dapur"
    notes: Optional[str] = ""

class WasteCreate(BaseModel):
    date: str
    item_name: str
    category: str
    waste_qty: float
    unit: str
    estimated_loss: float
    reason: str
    notes: Optional[str] = ""

class FinanceCreate(BaseModel):
    date: str
    type: str  # 'INCOME' or 'EXPENSE'
    category: str
    amount: float
    description: str
    source_or_recipient: Optional[str] = ""
    ref_number: Optional[str] = ""

class SettingsUpdate(BaseModel):
    kitchen_name: str
    service_area: str
    manager_name: str
    treasurer_name: str
    head_cook: str
    daily_target_portions: str
    budget_per_portion: str
    active_schools: str

def safe_num(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, Decimal):
        return float(val)
    return float(val)

def clean_dict(row: dict) -> dict:
    cleaned = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            cleaned[k] = float(v)
        elif isinstance(v, (datetime, date)):
            cleaned[k] = v.isoformat()
        else:
            cleaned[k] = v
    return cleaned

# Helper functions
def get_date_range(period: str, custom_date: Optional[str] = None):
    today = date.today()
    if custom_date:
        try:
            target_date = datetime.strptime(custom_date, "%Y-%m-%d").date()
        except Exception:
            target_date = today
    else:
        target_date = today

    if period == "today":
        start_date = target_date.isoformat()
        end_date = target_date.isoformat()
    elif period == "this_week":
        # 7 hari terakhir
        start_date = (target_date - timedelta(days=6)).isoformat()
        end_date = target_date.isoformat()
    elif period == "this_month":
        # Awal bulan sampai akhir bulan
        start_date = target_date.replace(day=1).isoformat()
        next_month = target_date.replace(day=28) + timedelta(days=4)
        end_date = (next_month - timedelta(days=next_month.day)).isoformat()
    else:
        start_date = "1970-01-01"
        end_date = "2099-12-31"
    return start_date, end_date

# API ENDPOINTS

@app.get("/api/settings")
def get_settings():
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("SELECT `key`, `value` FROM `settings`")
        rows = cursor.fetchall()
    conn.close()
    settings_dict = {row["key"]: row["value"] for row in rows}
    return settings_dict

@app.post("/api/settings")
def update_settings(payload: SettingsUpdate):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        for key, value in payload.dict().items():
            cursor.execute(
                "INSERT INTO `settings` (`key`, `value`) VALUES (%s, %s) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
                (key, str(value))
            )
    conn.close()
    return {"status": "success", "message": "Pengaturan dapur SPPG berhasil diperbarui"}

@app.get("/api/stats")
def get_stats(period: str = "today", custom_date: Optional[str] = None):
    start_date, end_date = get_date_range(period, custom_date)
    conn = database.get_connection()
    with conn.cursor() as cursor:
        # 1. Total Keuangan Kumulatif untuk Saldo Kas Riil
        cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM `finances` WHERE `type` = 'INCOME'")
        row = cursor.fetchone()
        all_time_income = safe_num(row["total"] if row else 0)

        cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM `finances` WHERE `type` = 'EXPENSE'")
        row = cursor.fetchone()
        all_time_expense = safe_num(row["total"] if row else 0)

        current_cash_balance = all_time_income - all_time_expense

        # 2. Keuangan pada periode terpilih (untuk Untung/Rugi / Surplus-Defisit)
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total FROM `finances` 
            WHERE `type` = 'INCOME' AND `date` BETWEEN %s AND %s
        """, (start_date, end_date))
        row = cursor.fetchone()
        period_income = safe_num(row["total"] if row else 0)

        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total FROM `finances` 
            WHERE `type` = 'EXPENSE' AND `date` BETWEEN %s AND %s
        """, (start_date, end_date))
        row = cursor.fetchone()
        period_expense = safe_num(row["total"] if row else 0)

        # Surplus (Untung efisiensi) atau Defisit (Rugi) periode
        period_profit_loss = period_income - period_expense

        # Pengeluaran Terinci per Kategori
        cursor.execute("""
            SELECT category, COALESCE(SUM(amount), 0) as total 
            FROM `finances` 
            WHERE `type` = 'EXPENSE' AND `date` BETWEEN %s AND %s
            GROUP BY category
        """, (start_date, end_date))
        expense_by_category = {r["category"]: safe_num(r["total"]) for r in cursor.fetchall()}

        # 3. Pembelian Bahan Pangan pada periode
        cursor.execute("""
            SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(total_price), 0) as total_spent,
                COALESCE(SUM(quantity), 0) as total_qty
            FROM `purchases` 
            WHERE `date` BETWEEN %s AND %s
        """, (start_date, end_date))
        p_row = cursor.fetchone()
        purchases_stat = {
            "count": p_row["total_transactions"] if p_row else 0,
            "total_spent": safe_num(p_row["total_spent"] if p_row else 0),
            "total_qty": safe_num(p_row["total_qty"] if p_row else 0)
        }

        # Pembelian Bahan per Kategori
        cursor.execute("""
            SELECT category, COALESCE(SUM(total_price), 0) as total_amount, COALESCE(SUM(quantity), 0) as total_qty
            FROM `purchases` 
            WHERE `date` BETWEEN %s AND %s
            GROUP BY category
            ORDER BY total_amount DESC
        """, (start_date, end_date))
        purchases_by_category = [
            {"category": r["category"], "total_amount": safe_num(r["total_amount"]), "total_qty": safe_num(r["total_qty"])}
            for r in cursor.fetchall()
        ]

        # 3b. Pengeluaran Bahan Pangan (Barang Keluar / Pemakaian Dapur) pada periode
        cursor.execute("""
            SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(total_price), 0) as total_value,
                COALESCE(SUM(quantity), 0) as total_qty
            FROM `stock_out` 
            WHERE `date` BETWEEN %s AND %s
        """, (start_date, end_date))
        so_row = cursor.fetchone()
        stock_out_stat = {
            "count": so_row["total_transactions"] if so_row else 0,
            "total_value": safe_num(so_row["total_value"] if so_row else 0),
            "total_qty": safe_num(so_row["total_qty"] if so_row else 0)
        }

        # Pengeluaran Bahan per Kategori
        cursor.execute("""
            SELECT category, COALESCE(SUM(total_price), 0) as total_amount, COALESCE(SUM(quantity), 0) as total_qty
            FROM `stock_out` 
            WHERE `date` BETWEEN %s AND %s
            GROUP BY category
            ORDER BY total_amount DESC
        """, (start_date, end_date))
        stock_out_by_category = [
            {"category": r["category"], "total_amount": safe_num(r["total_amount"]), "total_qty": safe_num(r["total_qty"])}
            for r in cursor.fetchall()
        ]

        # 4. Stok Sisa Bahan Pangan
        cursor.execute("""
            SELECT COUNT(*) as item_count, COALESCE(SUM(remaining_qty), 0) as total_remaining_qty
            FROM `inventory`
        """)
        inv_row = cursor.fetchone()
        inventory_stat = {
            "item_count": inv_row["item_count"] if inv_row else 0,
            "total_remaining_qty": safe_num(inv_row["total_remaining_qty"] if inv_row else 0)
        }

        # 5. Bahan Dibuang (Food Waste) pada periode
        cursor.execute("""
            SELECT 
                COUNT(*) as waste_count,
                COALESCE(SUM(waste_qty), 0) as total_waste_qty,
                COALESCE(SUM(estimated_loss), 0) as total_estimated_loss
            FROM `food_waste` 
            WHERE `date` BETWEEN %s AND %s
        """, (start_date, end_date))
        w_row = cursor.fetchone()
        waste_stat = {
            "waste_count": w_row["waste_count"] if w_row else 0,
            "total_waste_qty": safe_num(w_row["total_waste_qty"] if w_row else 0),
            "total_loss": safe_num(w_row["total_estimated_loss"] if w_row else 0)
        }

        # Alasan Bahan Dibuang
        cursor.execute("""
            SELECT reason, COALESCE(SUM(estimated_loss), 0) as total_loss, COUNT(*) as count
            FROM `food_waste`
            WHERE `date` BETWEEN %s AND %s
            GROUP BY reason
            ORDER BY total_loss DESC
        """, (start_date, end_date))
        waste_by_reason = [
            {"reason": r["reason"], "total_loss": safe_num(r["total_loss"]), "count": r["count"]}
            for r in cursor.fetchall()
        ]

        # 6. Settings untuk kalkulasi Porsi MBG
        cursor.execute("SELECT `key`, `value` FROM `settings`")
        settings = {row["key"]: row["value"] for row in cursor.fetchall()}
        daily_portions = float(settings.get("daily_target_portions", 1200))
        budget_per_portion = float(settings.get("budget_per_portion", 15000))

        if period == "today":
            days_factor = 1
        elif period == "this_week":
            days_factor = 7
        elif period == "this_month":
            days_factor = 30
        else:
            days_factor = 30

        total_target_portions = daily_portions * days_factor
        expected_budget = total_target_portions * budget_per_portion
        actual_food_cost_per_portion = (purchases_stat["total_spent"] / total_target_portions) if total_target_portions > 0 else 0

    conn.close()

    return {
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "cash_flow": {
            "all_time_income": all_time_income,
            "all_time_expense": all_time_expense,
            "current_balance": current_cash_balance,
            "period_income": period_income,
            "period_expense": period_expense,
            "period_profit_loss": period_profit_loss,
            "status": "SURPLUS (UNTUNG)" if period_profit_loss >= 0 else "DEFISIT (OVERBUDGET/RUGI)",
            "expense_by_category": expense_by_category
        },
        "purchases": purchases_stat,
        "purchases_by_category": purchases_by_category,
        "stock_out": stock_out_stat,
        "stock_out_by_category": stock_out_by_category,
        "inventory": inventory_stat,
        "waste": waste_stat,
        "waste_by_reason": waste_by_reason,
        "nutrition_metrics": {
            "target_portions": total_target_portions,
            "budget_per_portion": budget_per_portion,
            "expected_budget": expected_budget,
            "actual_food_cost_per_portion": round(actual_food_cost_per_portion, 2),
            "cost_efficiency": round(((budget_per_portion - actual_food_cost_per_portion) / budget_per_portion * 100), 1) if budget_per_portion > 0 else 0
        }
    }

# PURCHASES CRUD
@app.get("/api/purchases")
def get_purchases(
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None
):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        query = "SELECT * FROM `purchases` WHERE 1=1"
        params = []

        if category and category != "ALL":
            query += " AND `category` = %s"
            params.append(category)
        if start_date:
            query += " AND `date` >= %s"
            params.append(start_date)
        if end_date:
            query += " AND `date` <= %s"
            params.append(end_date)
        if search:
            query += " AND (`item_name` LIKE %s OR `supplier` LIKE %s OR `notes` LIKE %s)"
            s = f"%{search}%"
            params.extend([s, s, s])

        query += " ORDER BY `date` DESC, `id` DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
    conn.close()

    return [clean_dict(r) for r in rows]

@app.post("/api/purchases")
def create_purchase(payload: PurchaseCreate):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        total_price = payload.total_price if payload.total_price is not None else (payload.quantity * payload.unit_price)

        cursor.execute("""
            INSERT INTO `purchases` (`date`, `item_name`, `category`, `quantity`, `unit`, `unit_price`, `total_price`, `supplier`, `notes`)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            payload.date,
            payload.item_name,
            payload.category,
            payload.quantity,
            payload.unit,
            payload.unit_price,
            total_price,
            payload.supplier or "",
            payload.notes or ""
        ))
        purchase_id = cursor.lastrowid

        # Uang dari pembelian barang langsung otomatis 100% masuk ke dalam kas dan laba rugi
        desc = f"Belanja Bahan: {payload.item_name} ({payload.quantity} {payload.unit})"
        if payload.supplier:
            desc += f" dari {payload.supplier}"
        cursor.execute("""
            INSERT INTO `finances` (`date`, `type`, `category`, `amount`, `description`, `source_or_recipient`, `ref_number`)
            VALUES (%s, 'EXPENSE', 'Belanja Bahan Pangan', %s, %s, %s, %s)
        """, (
            payload.date,
            total_price,
            desc,
            payload.supplier or "Pasar/Supplier",
            f"BELANJA-#{purchase_id}"
        ))

        # Update stok sisa jika item_name sudah ada di inventory atau tambahkan
        cursor.execute("SELECT id, remaining_qty FROM `inventory` WHERE `item_name` = %s", (payload.item_name,))
        inv_item = cursor.fetchone()
        if inv_item:
            cursor.execute("UPDATE `inventory` SET `remaining_qty` = `remaining_qty` + %s, `updated_at` = CURRENT_TIMESTAMP WHERE `id` = %s", (payload.quantity, inv_item["id"]))
        else:
            cursor.execute("""
                INSERT INTO `inventory` (`date`, `item_name`, `category`, `remaining_qty`, `unit`, `item_condition`, `storage_location`, `notes`)
                VALUES (%s, %s, %s, %s, %s, 'Baik / Segar', 'Gudang Dapur', 'Masuk dari pembelian')
            """, (payload.date, payload.item_name, payload.category, payload.quantity, payload.unit))

    conn.close()

    return {"status": "success", "id": purchase_id, "message": "Pembelian bahan pangan berhasil dicatat dan uang belanja otomatis masuk ke kas & laba rugi"}

@app.delete("/api/purchases/{purchase_id}")
def delete_purchase(purchase_id: int):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("DELETE FROM `purchases` WHERE `id` = %s", (purchase_id,))
        cursor.execute("DELETE FROM `finances` WHERE `ref_number` = %s", (f"BELANJA-#{purchase_id}",))
    conn.close()
    return {"status": "success", "message": "Catatan pembelian dihapus"}

# STOCK OUT (BARANG KELUAR / PEMAKAIAN BAHAN) CRUD
@app.get("/api/stock-out")
def get_stock_out(
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None
):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        query = "SELECT * FROM `stock_out` WHERE 1=1"
        params = []

        if category and category != "ALL":
            query += " AND `category` = %s"
            params.append(category)
        if start_date:
            query += " AND `date` >= %s"
            params.append(start_date)
        if end_date:
            query += " AND `date` <= %s"
            params.append(end_date)
        if search:
            query += " AND (`item_name` LIKE %s OR `purpose` LIKE %s OR `recipient_school` LIKE %s OR `notes` LIKE %s)"
            s = f"%{search}%"
            params.extend([s, s, s, s])

        query += " ORDER BY `date` DESC, `id` DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
    conn.close()

    return [clean_dict(r) for r in rows]

@app.post("/api/stock-out")
def create_stock_out(payload: StockOutCreate):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        # Jika unit price belum terisi, coba ambil harga beli terbaru untuk bahan tersebut
        unit_price = payload.unit_price or 0.0
        if unit_price <= 0:
            cursor.execute("SELECT unit_price FROM purchases WHERE item_name = %s ORDER BY date DESC, id DESC LIMIT 1", (payload.item_name,))
            p_price_row = cursor.fetchone()
            if p_price_row:
                unit_price = safe_num(p_price_row["unit_price"])

        # Setiap barang yang keluar ditotalkan secara otomatis: quantity * unit_price
        total_price = payload.total_price if payload.total_price is not None else (payload.quantity * unit_price)

        cursor.execute("""
            INSERT INTO `stock_out` (`date`, `item_name`, `category`, `quantity`, `unit`, `unit_price`, `total_price`, `purpose`, `recipient_school`, `chef_or_staff`, `notes`)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            payload.date,
            payload.item_name,
            payload.category,
            payload.quantity,
            payload.unit,
            unit_price,
            total_price,
            payload.purpose or "Pengolahan Menu MBG",
            payload.recipient_school or "",
            payload.chef_or_staff or "",
            payload.notes or ""
        ))
        so_id = cursor.lastrowid

        # Otomatis kurangkan stok sisa di inventory jika item tersebut ada
        cursor.execute("SELECT id, remaining_qty FROM `inventory` WHERE `item_name` = %s", (payload.item_name,))
        inv_item = cursor.fetchone()
        if inv_item:
            new_qty = max(0.0, safe_num(inv_item["remaining_qty"]) - payload.quantity)
            cursor.execute("UPDATE `inventory` SET `remaining_qty` = %s, `updated_at` = CURRENT_TIMESTAMP WHERE `id` = %s", (new_qty, inv_item["id"]))

    conn.close()
    return {"status": "success", "id": so_id, "message": "Pengeluaran barang berhasil dicatat dan total nilai otomatis dihitung"}

@app.delete("/api/stock-out/{so_id}")
def delete_stock_out(so_id: int):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("DELETE FROM `stock_out` WHERE `id` = %s", (so_id,))
    conn.close()
    return {"status": "success", "message": "Catatan pengeluaran barang dihapus"}

# REKAP MUTASI KELUAR MASUK BARANG
@app.get("/api/stock-mutations")
def get_stock_mutations(
    period: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None
):
    if not start_date or not end_date:
        start_date, end_date = get_date_range(period)

    conn = database.get_connection()
    with conn.cursor() as cursor:
        # Ambil daftar semua nama item unik dari purchases, stock_out, inventory
        cursor.execute("""
            SELECT DISTINCT item_name, category, unit FROM (
                SELECT item_name, category, unit FROM purchases
                UNION
                SELECT item_name, category, unit FROM stock_out
                UNION
                SELECT item_name, category, unit FROM inventory
            ) as all_items
            ORDER BY category ASC, item_name ASC
        """)
        all_items = cursor.fetchall()

        # Agregasi Pembelian (Stok Masuk)
        cursor.execute("""
            SELECT item_name, COALESCE(SUM(quantity), 0) as total_qty, COALESCE(SUM(total_price), 0) as total_spent, COALESCE(AVG(unit_price), 0) as avg_price
            FROM purchases
            WHERE `date` BETWEEN %s AND %s
            GROUP BY item_name
        """, (start_date, end_date))
        purchases_map = {r["item_name"]: r for r in cursor.fetchall()}

        # Agregasi Barang Keluar (Pengeluaran Bahan)
        cursor.execute("""
            SELECT item_name, COALESCE(SUM(quantity), 0) as total_qty, COALESCE(SUM(total_price), 0) as total_value
            FROM stock_out
            WHERE `date` BETWEEN %s AND %s
            GROUP BY item_name
        """, (start_date, end_date))
        stock_out_map = {r["item_name"]: r for r in cursor.fetchall()}

        # Agregasi Bahan Dibuang (Waste)
        cursor.execute("""
            SELECT item_name, COALESCE(SUM(waste_qty), 0) as total_qty, COALESCE(SUM(estimated_loss), 0) as total_loss
            FROM food_waste
            WHERE `date` BETWEEN %s AND %s
            GROUP BY item_name
        """, (start_date, end_date))
        waste_map = {r["item_name"]: r for r in cursor.fetchall()}

        # Stok Sisa Fisik di Inventory
        cursor.execute("SELECT item_name, remaining_qty, item_condition FROM inventory")
        inv_map = {r["item_name"]: r for r in cursor.fetchall()}

        mutations = []
        grand_in_qty = 0.0
        grand_in_value = 0.0
        grand_out_qty = 0.0
        grand_out_value = 0.0
        grand_waste_qty = 0.0
        grand_waste_loss = 0.0
        grand_remaining_qty = 0.0
        grand_remaining_value = 0.0

        for item in all_items:
            name = item["item_name"]
            if search and search.lower() not in name.lower() and search.lower() not in item["category"].lower():
                continue

            p_info = purchases_map.get(name, {})
            so_info = stock_out_map.get(name, {})
            w_info = waste_map.get(name, {})
            i_info = inv_map.get(name, {})

            in_qty = safe_num(p_info.get("total_qty", 0))
            in_val = safe_num(p_info.get("total_spent", 0))
            avg_price = safe_num(p_info.get("avg_price", 0))

            out_qty = safe_num(so_info.get("total_qty", 0))
            out_val = safe_num(so_info.get("total_value", 0))

            w_qty = safe_num(w_info.get("total_qty", 0))
            w_loss = safe_num(w_info.get("total_loss", 0))

            # Hitung sisa stok
            if i_info and i_info.get("remaining_qty") is not None:
                rem_qty = safe_num(i_info.get("remaining_qty"))
            else:
                rem_qty = max(0.0, in_qty - out_qty - w_qty)

            rem_val = rem_qty * avg_price if avg_price > 0 else (in_val / in_qty * rem_qty if in_qty > 0 else 0)

            if rem_qty <= 0:
                status = "Habis"
                status_color = "danger"
            elif rem_qty < (in_qty * 0.2 if in_qty > 0 else 5):
                status = "Perlu Ditambah"
                status_color = "warning"
            else:
                status = "Stok Aman"
                status_color = "success"

            grand_in_qty += in_qty
            grand_in_value += in_val
            grand_out_qty += out_qty
            grand_out_value += out_val
            grand_waste_qty += w_qty
            grand_waste_loss += w_loss
            grand_remaining_qty += rem_qty
            grand_remaining_value += rem_val

            mutations.append({
                "item_name": name,
                "category": item["category"],
                "unit": item["unit"],
                "in_qty": in_qty,
                "in_value": in_val,
                "out_qty": out_qty,
                "out_value": out_val,
                "waste_qty": w_qty,
                "waste_loss": w_loss,
                "remaining_qty": rem_qty,
                "remaining_value": rem_val,
                "status": status,
                "status_color": status_color
            })

    conn.close()

    return {
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "items": mutations,
        "totals": {
            "total_items": len(mutations),
            "grand_in_qty": grand_in_qty,
            "grand_in_value": grand_in_value,
            "grand_out_qty": grand_out_qty,
            "grand_out_value": grand_out_value,
            "grand_waste_qty": grand_waste_qty,
            "grand_waste_loss": grand_waste_loss,
            "grand_remaining_qty": grand_remaining_qty,
            "grand_remaining_value": grand_remaining_value
        }
    }

# INVENTORY LEFTOVERS CRUD
@app.get("/api/inventory")
def get_inventory(condition: Optional[str] = None, search: Optional[str] = None):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        query = "SELECT * FROM `inventory` WHERE 1=1"
        params = []

        if condition and condition != "ALL":
            query += " AND `item_condition` = %s"
            params.append(condition)
        if search:
            query += " AND (`item_name` LIKE %s OR `storage_location` LIKE %s OR `notes` LIKE %s)"
            s = f"%{search}%"
            params.extend([s, s, s])

        query += " ORDER BY `updated_at` DESC, `id` DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
    conn.close()

    return [clean_dict(r) for r in rows]

@app.post("/api/inventory")
def create_inventory(payload: InventoryCreate):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT `id` FROM `inventory` WHERE `item_name` = %s AND `storage_location` = %s", 
            (payload.item_name, payload.storage_location or "Gudang Dapur")
        )
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE `inventory` 
                SET `remaining_qty` = %s, `unit` = %s, `item_condition` = %s, `notes` = %s, `date` = %s, `updated_at` = CURRENT_TIMESTAMP
                WHERE `id` = %s
            """, (
                payload.remaining_qty,
                payload.unit,
                payload.item_condition,
                payload.notes,
                payload.date,
                existing["id"]
            ))
            inv_id = existing["id"]
        else:
            cursor.execute("""
                INSERT INTO `inventory` (`date`, `item_name`, `category`, `remaining_qty`, `unit`, `item_condition`, `storage_location`, `notes`)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                payload.date,
                payload.item_name,
                payload.category,
                payload.remaining_qty,
                payload.unit,
                payload.item_condition,
                payload.storage_location,
                payload.notes
            ))
            inv_id = cursor.lastrowid
    conn.close()
    return {"status": "success", "id": inv_id, "message": "Catatan stok sisa berhasil diperbarui"}

@app.delete("/api/inventory/{inv_id}")
def delete_inventory(inv_id: int):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("DELETE FROM `inventory` WHERE `id` = %s", (inv_id,))
    conn.close()
    return {"status": "success", "message": "Stok bahan dihapus"}

# FOOD WASTE CRUD
@app.get("/api/waste")
def get_waste(reason: Optional[str] = None, search: Optional[str] = None):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        query = "SELECT * FROM `food_waste` WHERE 1=1"
        params = []

        if reason and reason != "ALL":
            query += " AND `reason` = %s"
            params.append(reason)
        if search:
            query += " AND (`item_name` LIKE %s OR `notes` LIKE %s)"
            s = f"%{search}%"
            params.extend([s, s])

        query += " ORDER BY `date` DESC, `id` DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
    conn.close()

    return [clean_dict(r) for r in rows]

@app.post("/api/waste")
def create_waste(payload: WasteCreate):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO `food_waste` (`date`, `item_name`, `category`, `waste_qty`, `unit`, `estimated_loss`, `reason`, `notes`)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            payload.date,
            payload.item_name,
            payload.category,
            payload.waste_qty,
            payload.unit,
            payload.estimated_loss,
            payload.reason,
            payload.notes or ""
        ))
        waste_id = cursor.lastrowid
    conn.close()

    return {"status": "success", "id": waste_id, "message": "Bahan terbuang / rusak berhasil dicatat"}

@app.delete("/api/waste/{waste_id}")
def delete_waste(waste_id: int):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("DELETE FROM `food_waste` WHERE `id` = %s", (waste_id,))
    conn.close()
    return {"status": "success", "message": "Catatan limbah makanan dihapus"}

# FINANCES CRUD
@app.get("/api/finances")
def get_finances(
    flow_type: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None
):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        query = "SELECT * FROM `finances` WHERE 1=1"
        params = []

        if flow_type and flow_type != "ALL":
            query += " AND `type` = %s"
            params.append(flow_type)
        if category and category != "ALL":
            query += " AND `category` = %s"
            params.append(category)
        if start_date:
            query += " AND `date` >= %s"
            params.append(start_date)
        if end_date:
            query += " AND `date` <= %s"
            params.append(end_date)
        if search:
            query += " AND (`description` LIKE %s OR `source_or_recipient` LIKE %s OR `ref_number` LIKE %s)"
            s = f"%{search}%"
            params.extend([s, s, s])

        query += " ORDER BY `date` DESC, `id` DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
    conn.close()

    return [clean_dict(r) for r in rows]

@app.post("/api/finances")
def create_finance(payload: FinanceCreate):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO `finances` (`date`, `type`, `category`, `amount`, `description`, `source_or_recipient`, `ref_number`)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            payload.date,
            payload.type.upper(),
            payload.category,
            payload.amount,
            payload.description,
            payload.source_or_recipient or "",
            payload.ref_number or ""
        ))
        finance_id = cursor.lastrowid
    conn.close()

    return {"status": "success", "id": finance_id, "message": "Transaksi keuangan berhasil dicatat"}

@app.delete("/api/finances/{fin_id}")
def delete_finance(fin_id: int):
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("DELETE FROM `finances` WHERE `id` = %s", (fin_id,))
    conn.close()
    return {"status": "success", "message": "Catatan keuangan dihapus"}

# REKAPITULASI LAPORAN (HARIAN, MINGGUAN, BULANAN)
@app.get("/api/reports/recap")
def get_report_recap(period: str = "today", custom_date: Optional[str] = None):
    start_date, end_date = get_date_range(period, custom_date)
    conn = database.get_connection()
    with conn.cursor() as cursor:
        # Settings
        cursor.execute("SELECT `key`, `value` FROM `settings`")
        settings = {row["key"]: row["value"] for row in cursor.fetchall()}

        # Keuangan Transaksi
        cursor.execute("""
            SELECT * FROM `finances` 
            WHERE `date` BETWEEN %s AND %s 
            ORDER BY `date` ASC, `id` ASC
        """, (start_date, end_date))
        finances = [clean_dict(r) for r in cursor.fetchall()]

        # Pembelian Bahan
        cursor.execute("""
            SELECT * FROM `purchases` 
            WHERE `date` BETWEEN %s AND %s 
            ORDER BY `date` ASC, `id` ASC
        """, (start_date, end_date))
        purchases = [clean_dict(r) for r in cursor.fetchall()]

        # Pengeluaran Bahan (Barang Keluar)
        cursor.execute("""
            SELECT * FROM `stock_out` 
            WHERE `date` BETWEEN %s AND %s 
            ORDER BY `date` ASC, `id` ASC
        """, (start_date, end_date))
        stock_out = [clean_dict(r) for r in cursor.fetchall()]

        # Sisa Bahan
        cursor.execute("SELECT * FROM `inventory` ORDER BY `updated_at` DESC")
        inventory = [clean_dict(r) for r in cursor.fetchall()]

        # Bahan Dibuang
        cursor.execute("""
            SELECT * FROM `food_waste` 
            WHERE `date` BETWEEN %s AND %s 
            ORDER BY `date` ASC, `id` ASC
        """, (start_date, end_date))
        waste = [clean_dict(r) for r in cursor.fetchall()]

        # Hitung Rekap
        total_income = sum(float(f["amount"]) for f in finances if f["type"] == "INCOME")
        total_expense = sum(float(f["amount"]) for f in finances if f["type"] == "EXPENSE")
        profit_loss = total_income - total_expense
        total_waste_loss = sum(float(w["estimated_loss"]) for w in waste)
        total_waste_qty = sum(float(w["waste_qty"]) for w in waste)

        total_purchases_spent = sum(float(p["total_price"]) for p in purchases)
        total_purchases_qty = sum(float(p["quantity"]) for p in purchases)
        total_stock_out_spent = sum(float(so["total_price"]) for so in stock_out)
        total_stock_out_qty = sum(float(so["quantity"]) for so in stock_out)

        # Saldo kas total berjalan
        cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM `finances` WHERE `type` = 'INCOME'")
        row = cursor.fetchone()
        all_income = safe_num(row["total"] if row else 0)

        cursor.execute("SELECT COALESCE(SUM(amount), 0) as total FROM `finances` WHERE `type` = 'EXPENSE'")
        row = cursor.fetchone()
        all_expense = safe_num(row["total"] if row else 0)

        cumulative_cash_balance = all_income - all_expense

    conn.close()

    # Hitung rekap mutasi keluar-masuk barang
    mutations_data = get_stock_mutations(period=period, start_date=start_date, end_date=end_date)

    period_labels = {
        "today": f"Harian ({start_date})",
        "this_week": f"Mingguan ({start_date} s/d {end_date})",
        "this_month": f"Bulanan ({start_date[:7]})",
        "all": "Semua Periode"
    }

    return {
        "period": period,
        "period_label": period_labels.get(period, f"{start_date} s/d {end_date}"),
        "start_date": start_date,
        "end_date": end_date,
        "generated_at": datetime.now().strftime("%d %B %Y %H:%M WIB"),
        "settings": settings,
        "summary": {
            "total_income": total_income,
            "total_expense": total_expense,
            "period_profit_loss": profit_loss,
            "is_profit": profit_loss >= 0,
            "cumulative_balance": cumulative_cash_balance,
            "total_purchases_spent": total_purchases_spent,
            "total_purchases_qty": total_purchases_qty,
            "purchase_item_count": len(purchases),
            "total_stock_out_spent": total_stock_out_spent,
            "total_stock_out_qty": total_stock_out_qty,
            "stock_out_item_count": len(stock_out),
            "total_waste_loss": total_waste_loss,
            "total_waste_qty": total_waste_qty,
            "waste_item_count": len(waste),
            "inventory_item_count": len(inventory)
        },
        "finances": finances,
        "purchases": purchases,
        "stock_out": stock_out,
        "mutations": mutations_data,
        "inventory": inventory,
        "waste": waste
    }

@app.post("/api/reset-demo")
def reset_demo():
    conn = database.get_connection()
    with conn.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS `stock_out`")
        cursor.execute("DROP TABLE IF EXISTS `purchases`")
        cursor.execute("DROP TABLE IF EXISTS `inventory`")
        cursor.execute("DROP TABLE IF EXISTS `food_waste`")
        cursor.execute("DROP TABLE IF EXISTS `finances`")
        cursor.execute("DROP TABLE IF EXISTS `settings`")
    conn.close()

    database.init_db()
    return {"status": "success", "message": "Data Dapur MBG di MySQL berhasil direset ke data sampel"}
