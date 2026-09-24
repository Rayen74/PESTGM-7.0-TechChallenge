"""
Database engine supporting Neon PostgreSQL with automatic SQLite local fallback
when DATABASE_URL is not yet provided.
Ensures seamless transition while maintaining zero-downtime execution.
"""

import os
import json
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from typing import Generator, Any, Dict

# Try loading from .env if python-dotenv is installed
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

DATABASE_URL = (os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL") or "").strip()

# Check whether psycopg2 is available and postgres URL is provided
USE_POSTGRES = False
pg_pool = None

if DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://"):
    try:
        import psycopg2
        from psycopg2 import pool
        from psycopg2.extras import RealDictCursor
        USE_POSTGRES = True
        # Initialize connection pool for Neon
        pg_pool = psycopg2.pool.SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=DATABASE_URL
        )
    except Exception as e:
        print(f"[Database] Notice: PostgreSQL configuration detected but pool initialization failed ({e}). Falling back to SQLite.")
        USE_POSTGRES = False

from src import config
SQLITE_DB_PATH = config.DATA_PROCESSED_DIR / "battery_module.db"


class DictRowCursor:
    """Wrapper around sqlite3 cursor or psycopg2 cursor providing dict-like row access."""
    pass


@contextmanager
def get_db():
    """
    Context manager yielding a database connection.
    Automatically handles commit/rollback and returns connection to pool if using Postgres.
    """
    if USE_POSTGRES and pg_pool:
        conn = pg_pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            pg_pool.putconn(conn)
    else:
        conn = sqlite3.connect(str(SQLITE_DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def query_all(conn, sql: str, params: tuple = ()) -> list:
    """Executes a query and returns rows as a list of standard Python dicts."""
    if USE_POSTGRES:
        from psycopg2.extras import RealDictCursor
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]
    else:
        # SQLite uses ? instead of %s
        sql_sqlite = sql.replace("%s", "?")
        cur = conn.cursor()
        cur.execute(sql_sqlite, params)
        return [dict(row) for row in cur.fetchall()]


def query_one(conn, sql: str, params: tuple = ()) -> Dict[str, Any] | None:
    """Executes a query and returns a single row as a dict, or None."""
    if USE_POSTGRES:
        from psycopg2.extras import RealDictCursor
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None
    else:
        sql_sqlite = sql.replace("%s", "?")
        cur = conn.cursor()
        cur.execute(sql_sqlite, params)
        row = cur.fetchone()
        return dict(row) if row else None


def execute_insert_returning_id(conn, sql: str, params: tuple = (), id_column: str = "id") -> int:
    """
    Executes an INSERT statement and returns the newly generated ID.
    Handles Postgres RETURNING id as well as SQLite cursor.lastrowid.
    """
    if USE_POSTGRES:
        if "RETURNING" not in sql.upper():
            sql = f"{sql.rstrip(';')} RETURNING {id_column};"
        with conn.cursor() as cur:
            cur.execute(sql, params)
            res = cur.fetchone()
            return res[0] if res else 0
    else:
        # Remove RETURNING if present for SQLite
        sql_clean = sql
        if "RETURNING" in sql_clean.upper():
            parts = sql_clean.upper().split("RETURNING")
            sql_clean = parts[0]
        sql_sqlite = sql_clean.replace("%s", "?")
        cur = conn.cursor()
        cur.execute(sql_sqlite, params)
        return cur.lastrowid


def execute_write(conn, sql: str, params: tuple = ()):
    """Executes an UPDATE, DELETE, or INSERT statement without returning an ID."""
    if USE_POSTGRES:
        with conn.cursor() as cur:
            cur.execute(sql, params)
    else:
        sql_sqlite = sql.replace("%s", "?")
        cur = conn.cursor()
        cur.execute(sql_sqlite, params)


def init_db():
    """Initializes tables and seeds default user accounts and battery catalog."""
    from api.auth import hash_password

    with get_db() as conn:
        if USE_POSTGRES:
            with conn.cursor() as cursor:
                # 1. Users table (Neon Postgres)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT CHECK(role IN ('CITIZEN', 'ADMIN')) NOT NULL DEFAULT 'CITIZEN',
                    steg_contract_no TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """)

                # 2. PV Profiles table
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS pv_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    pv_capacity_kwp REAL NOT NULL,
                    governorate TEXT NOT NULL,
                    inverter_brand TEXT NOT NULL,
                    inverter_model TEXT NOT NULL,
                    inverter_type TEXT CHECK(inverter_type IN ('HYBRID', 'STRING')) NOT NULL,
                    inverter_rated_power_kw REAL NOT NULL,
                    battery_bus_type TEXT CHECK(battery_bus_type IN ('LV_48V', 'HV')) NOT NULL,
                    consumption_archetype TEXT NOT NULL,
                    annual_consumption_kwh REAL DEFAULT 4500,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """)

                # 3. Battery Catalog table
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS battery_catalog (
                    id SERIAL PRIMARY KEY,
                    brand TEXT NOT NULL,
                    model TEXT NOT NULL,
                    chemistry TEXT NOT NULL,
                    nominal_capacity_kwh REAL NOT NULL,
                    usable_capacity_kwh REAL NOT NULL,
                    nominal_voltage_v REAL NOT NULL,
                    voltage_type TEXT CHECK(voltage_type IN ('LV_48V', 'HV')) NOT NULL,
                    max_charge_kw REAL NOT NULL,
                    max_discharge_kw REAL NOT NULL,
                    round_trip_eff REAL NOT NULL,
                    dod_pct REAL NOT NULL,
                    coupling_type TEXT NOT NULL,
                    compatible_inverters JSONB NOT NULL DEFAULT '[]',
                    datasheet_url TEXT,
                    steg_certified BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """)

                # 4. Battery Requests table (Many requests per citizen)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS battery_requests (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    battery_id INTEGER NOT NULL REFERENCES battery_catalog(id),
                    profile_snapshot JSONB NOT NULL,
                    simulation_results JSONB NOT NULL,
                    appliances JSONB DEFAULT '[]',
                    status TEXT CHECK(status IN ('SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED')) DEFAULT 'SUBMITTED',
                    admin_notes TEXT,
                    document_ref TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """)
                # Migration helper: ensure appliances column exists if table was already created
                try:
                    cursor.execute("ALTER TABLE battery_requests ADD COLUMN IF NOT EXISTS appliances JSONB DEFAULT '[]';")
                except Exception:
                    pass


                # 5. Installation Tracking table
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS installation_tracking (
                    id SERIAL PRIMARY KEY,
                    request_id INTEGER UNIQUE NOT NULL REFERENCES battery_requests(id) ON DELETE CASCADE,
                    stage TEXT CHECK(stage IN ('APPROVED', 'INSTALLATION_SCHEDULED', 'INSTALLING', 'COMMISSIONING', 'ACTIVE')) DEFAULT 'APPROVED',
                    installer_name TEXT,
                    scheduled_date TEXT,
                    commissioning_date TEXT,
                    steg_meter_ref TEXT,
                    notes TEXT,
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """)

                cursor.execute("CREATE INDEX IF NOT EXISTS idx_battery_requests_user_id ON battery_requests(user_id);")

                # Seed test users if empty
                cursor.execute("SELECT COUNT(*) FROM users;")
                if cursor.fetchone()[0] == 0:
                    admin_pw = hash_password("admin123")
                    citizen_pw = hash_password("citizen123")
                    cursor.execute("""
                    INSERT INTO users (email, password_hash, full_name, role, steg_contract_no)
                    VALUES 
                        (%s, %s, %s, %s, %s),
                        (%s, %s, %s, %s, %s);
                    """, (
                        'admin@example.com', admin_pw, 'Ingénieur Contrôleur STEG', 'ADMIN', 'STEG-HQ-001',
                        'citizen@example.com', citizen_pw, 'Mohamed Ben Salem', 'CITIZEN', 'POL-784920-TUN'
                    ))

                # Seed battery catalog if empty
                cursor.execute("SELECT COUNT(*) FROM battery_catalog;")
                if cursor.fetchone()[0] == 0:
                    _seed_battery_catalog_postgres(cursor)

        else:
            # SQLite initialization
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT CHECK(role IN ('CITIZEN', 'ADMIN')) NOT NULL DEFAULT 'CITIZEN',
                steg_contract_no TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS pv_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                pv_capacity_kwp REAL NOT NULL,
                governorate TEXT NOT NULL,
                inverter_brand TEXT NOT NULL,
                inverter_model TEXT NOT NULL,
                inverter_type TEXT CHECK(inverter_type IN ('HYBRID', 'STRING')) NOT NULL,
                inverter_rated_power_kw REAL NOT NULL,
                battery_bus_type TEXT CHECK(battery_bus_type IN ('LV_48V', 'HV')) NOT NULL,
                consumption_archetype TEXT NOT NULL,
                annual_consumption_kwh REAL DEFAULT 4500,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS battery_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                model TEXT NOT NULL,
                chemistry TEXT NOT NULL,
                nominal_capacity_kwh REAL NOT NULL,
                usable_capacity_kwh REAL NOT NULL,
                nominal_voltage_v REAL NOT NULL,
                voltage_type TEXT CHECK(voltage_type IN ('LV_48V', 'HV')) NOT NULL,
                max_charge_kw REAL NOT NULL,
                max_discharge_kw REAL NOT NULL,
                round_trip_eff REAL NOT NULL,
                dod_pct REAL NOT NULL,
                coupling_type TEXT NOT NULL,
                compatible_inverters TEXT NOT NULL,
                datasheet_url TEXT,
                steg_certified INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS battery_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                battery_id INTEGER NOT NULL,
                profile_snapshot TEXT NOT NULL,
                simulation_results TEXT NOT NULL,
                appliances TEXT DEFAULT '[]',
                status TEXT CHECK(status IN ('SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED')) DEFAULT 'SUBMITTED',
                admin_notes TEXT,
                document_ref TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (battery_id) REFERENCES battery_catalog(id)
            );
            """)

            try:
                cursor.execute("ALTER TABLE battery_requests ADD COLUMN appliances TEXT DEFAULT '[]';")
            except Exception:
                pass


            cursor.execute("""
            CREATE TABLE IF NOT EXISTS installation_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER UNIQUE NOT NULL,
                stage TEXT CHECK(stage IN ('APPROVED', 'INSTALLATION_SCHEDULED', 'INSTALLING', 'COMMISSIONING', 'ACTIVE')) DEFAULT 'APPROVED',
                installer_name TEXT,
                scheduled_date TEXT,
                commissioning_date TEXT,
                steg_meter_ref TEXT,
                notes TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES battery_requests(id) ON DELETE CASCADE
            );
            """)

            # Seed default test users if empty
            cursor.execute("SELECT COUNT(*) as cnt FROM users;")
            if cursor.fetchone()["cnt"] == 0:
                admin_pw = hash_password("admin123")
                citizen_pw = hash_password("citizen123")
                cursor.execute("""
                INSERT INTO users (email, password_hash, full_name, role, steg_contract_no)
                VALUES 
                    ('admin@example.com', ?, 'Ingénieur Contrôleur STEG', 'ADMIN', 'STEG-HQ-001'),
                    ('citizen@example.com', ?, 'Mohamed Ben Salem', 'CITIZEN', 'POL-784920-TUN');
                """, (admin_pw, citizen_pw))

            cursor.execute("SELECT COUNT(*) as cnt FROM battery_catalog;")
            if cursor.fetchone()["cnt"] == 0:
                _seed_battery_catalog_sqlite(cursor)


def _get_catalog_seed_data():
    return [
        (
            "Huawei", "LUNA2000-5-S0", "LiFePO4 (LFP)", 5.0, 5.0, 360.0, "HV", 2.5, 2.5, 0.95, 100.0,
            "DC_HIGH_VOLTAGE", ["Huawei SUN2000", "Huawei SUN2000-L1", "Huawei SUN2000-M1"],
            "https://solar.huawei.com/download?p=%2F-%2Fmedia%2FSolar%2Fattachment%2Fpdf%2Feu%2Fdatasheet%2FLUNA2000-5-10-15-S0.pdf", 1
        ),
        (
            "Huawei", "LUNA2000-10-S0", "LiFePO4 (LFP)", 10.0, 10.0, 600.0, "HV", 5.0, 5.0, 0.95, 100.0,
            "DC_HIGH_VOLTAGE", ["Huawei SUN2000", "Huawei SUN2000-L1", "Huawei SUN2000-M1"],
            "https://solar.huawei.com/download?p=%2F-%2Fmedia%2FSolar%2Fattachment%2Fpdf%2Feu%2Fdatasheet%2FLUNA2000-5-10-15-S0.pdf", 1
        ),
        (
            "BYD", "Battery-Box Premium HVS 5.1", "LiFePO4 (LFP)", 5.12, 5.12, 204.0, "HV", 5.0, 5.0, 0.96, 100.0,
            "DC_HIGH_VOLTAGE", ["GoodWe EH", "GoodWe ET", "Fronius Primo Gen24", "Solis Hybrid RHI", "Kostal"],
            "https://www.bydbatterybox.com", 1
        ),
        (
            "BYD", "Battery-Box Premium HVS 10.2", "LiFePO4 (LFP)", 10.24, 10.24, 409.0, "HV", 9.0, 9.0, 0.96, 100.0,
            "DC_HIGH_VOLTAGE", ["GoodWe EH", "GoodWe ET", "Fronius Primo Gen24", "Solis Hybrid RHI"],
            "https://www.bydbatterybox.com", 1
        ),
        (
            "Pylontech", "US5000", "LiFePO4 (LFP)", 4.8, 4.56, 48.0, "LV_48V", 2.4, 2.4, 0.95, 95.0,
            "DC_LOW_VOLTAGE_48V", ["Growatt SPH", "Victron MultiPlus", "Solis 48V", "GoodWe ES", "Deye 48V"],
            "https://en.pylontech.com.cn", 1
        ),
        (
            "Pylontech", "US3000C", "LiFePO4 (LFP)", 3.55, 3.37, 48.0, "LV_48V", 1.8, 1.8, 0.95, 95.0,
            "DC_LOW_VOLTAGE_48V", ["Growatt SPH", "Victron MultiPlus", "Solis 48V", "GoodWe ES", "Deye 48V"],
            "https://en.pylontech.com.cn", 1
        ),
        (
            "Dyness", "Powerbox F-4.8", "LiFePO4 (LFP)", 4.8, 4.32, 48.0, "LV_48V", 2.4, 2.4, 0.93, 90.0,
            "DC_LOW_VOLTAGE_48V", ["Growatt SPH", "Deye 48V", "Solis 48V", "SMA Sunny Island", "Victron"],
            "https://www.dyness.com", 1
        ),
        (
            "Growatt", "ARK 2.5L-A1 (5.12 kWh)", "LiFePO4 (LFP)", 5.12, 4.60, 51.2, "LV_48V", 2.5, 2.5, 0.94, 90.0,
            "DC_LOW_VOLTAGE_48V", ["Growatt SPH", "Growatt SPF", "Victron"],
            "https://www.ginverter.com", 1
        )
    ]


def _seed_battery_catalog_sqlite(cursor):
    raw_data = _get_catalog_seed_data()
    formatted = [
        (b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], json.dumps(b[12]), b[13], b[14])
        for b in raw_data
    ]
    cursor.executemany("""
    INSERT INTO battery_catalog (
        brand, model, chemistry, nominal_capacity_kwh, usable_capacity_kwh, nominal_voltage_v,
        voltage_type, max_charge_kw, max_discharge_kw, round_trip_eff, dod_pct, coupling_type,
        compatible_inverters, datasheet_url, steg_certified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, formatted)


def _seed_battery_catalog_postgres(cursor):
    import json
    raw_data = _get_catalog_seed_data()
    for b in raw_data:
        cursor.execute("""
        INSERT INTO battery_catalog (
            brand, model, chemistry, nominal_capacity_kwh, usable_capacity_kwh, nominal_voltage_v,
            voltage_type, max_charge_kw, max_discharge_kw, round_trip_eff, dod_pct, coupling_type,
            compatible_inverters, datasheet_url, steg_certified
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11],
            json.dumps(b[12]), b[13], bool(b[14])
        ))


# Initialize database schema automatically
init_db()
