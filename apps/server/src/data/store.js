import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { config } from "../config.js";

const STORE_FILE = path.join(config.dataDir, "store.json");
const DB_FILE = path.join(config.dataDir, "dy-monitor.db");
const SHORT_VIDEO_RANKING = "\u77ed\u89c6\u9891\u699c";
const DEFAULT_ADMIN_NAME = "\u7cfb\u7edf\u7ba1\u7406\u5458";
const DEFAULT_OPERATOR_NAME = "\u8fd0\u8425A";

let db;

function nowIso() {
  return new Date().toISOString();
}

function ensureDirectory() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function createSeedData() {
  const adminId = nanoid();
  const operatorId = nanoid();

  return {
    users: [
      {
        id: adminId,
        username: "admin",
        displayName: DEFAULT_ADMIN_NAME,
        passwordHash: bcrypt.hashSync("Admin123456", 10),
        role: "admin",
        createdAt: nowIso()
      },
      {
        id: operatorId,
        username: "operator-a",
        displayName: DEFAULT_OPERATOR_NAME,
        passwordHash: bcrypt.hashSync("Operator123", 10),
        role: "operator",
        createdAt: nowIso()
      }
    ],
    categories: [],
    captureBatches: [],
    records: [],
    settings: {
      rankingTabs: [SHORT_VIDEO_RANKING],
      pageLimit: 10
    }
  };
}

function normalizeStore(store) {
  const normalized = store && typeof store === "object" ? store : {};
  const users = Array.isArray(normalized.users) ? normalized.users : [];

  for (const user of users) {
    if (user.role === "admin" && (!user.displayName || /\?{2,}/.test(user.displayName))) {
      user.displayName = DEFAULT_ADMIN_NAME;
    }
    if (user.role === "operator" && (!user.displayName || /\?{2,}/.test(user.displayName))) {
      user.displayName = DEFAULT_OPERATOR_NAME;
    }
  }

  return {
    users,
    categories: Array.isArray(normalized.categories) ? normalized.categories : [],
    captureBatches: Array.isArray(normalized.captureBatches) ? normalized.captureBatches : [],
    records: Array.isArray(normalized.records) ? normalized.records : [],
    settings: {
      ...(normalized.settings || {}),
      rankingTabs: [SHORT_VIDEO_RANKING],
      pageLimit: Number(normalized.settings?.pageLimit || 10)
    }
  };
}

function openDb() {
  ensureDirectory();
  if (!db) {
    db = new DatabaseSync(DB_FILE);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT,
        created_at TEXT,
        owner_user_ids TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS capture_batches (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        category_name TEXT,
        ranking_type TEXT,
        captured_at TEXT,
        capture_hour TEXT,
        record_count INTEGER,
        trigger_mode TEXT,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        category_id TEXT,
        category_name TEXT,
        ranking_type TEXT,
        capture_hour TEXT,
        captured_at TEXT,
        rank INTEGER,
        product_id TEXT,
        product_name TEXT,
        shop_name TEXT,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_batches_category_captured ON capture_batches(category_id, captured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_records_batch_rank ON records(batch_id, rank);
      CREATE INDEX IF NOT EXISTS idx_records_category_hour ON records(category_id, capture_hour);
      CREATE INDEX IF NOT EXISTS idx_records_product ON records(category_id, product_id, product_name, shop_name);
    `);
    migrateFromJsonIfNeeded();
  }
  return db;
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getExistingStoreCount(database) {
  const users = database.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  const batches = database.prepare("SELECT COUNT(*) AS count FROM capture_batches").get().count;
  const records = database.prepare("SELECT COUNT(*) AS count FROM records").get().count;
  return Number(users || 0) + Number(batches || 0) + Number(records || 0);
}

function migrateFromJsonIfNeeded() {
  if (getExistingStoreCount(db) > 0) {
    return;
  }

  let source = createSeedData();
  if (fs.existsSync(STORE_FILE)) {
    source = parseJson(fs.readFileSync(STORE_FILE, "utf8"), source);
  }
  writeStore(normalizeStore(source));
}

function readRows(tableName, orderBy = "") {
  const database = openDb();
  const rows = database.prepare(`SELECT data FROM ${tableName} ${orderBy}`).all();
  return rows.map((row) => parseJson(row.data, {}));
}

export function readStore() {
  const database = openDb();
  const settingsRow = database.prepare("SELECT value FROM kv_store WHERE key = 'settings'").get();
  const store = normalizeStore({
    users: readRows("users", "ORDER BY created_at ASC"),
    categories: readRows("categories", "ORDER BY name ASC"),
    captureBatches: readRows("capture_batches", "ORDER BY captured_at ASC"),
    records: readRows("records", "ORDER BY captured_at ASC, rank ASC"),
    settings: parseJson(settingsRow?.value, { rankingTabs: [SHORT_VIDEO_RANKING], pageLimit: 10 })
  });

  if (!store.users.length) {
    writeStore(createSeedData());
    return readStore();
  }

  return store;
}

function runInTransaction(callback) {
  const database = openDb();
  database.exec("BEGIN IMMEDIATE");
  try {
    callback(database);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function writeStore(store) {
  ensureDirectory();
  const normalized = normalizeStore(store);

  runInTransaction((database) => {
    database.exec("DELETE FROM records; DELETE FROM capture_batches; DELETE FROM categories; DELETE FROM users;");

    const insertUser = database.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, role, created_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertCategory = database.prepare(`
      INSERT INTO categories (id, name, code, created_at, owner_user_ids, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertBatch = database.prepare(`
      INSERT INTO capture_batches (
        id, category_id, category_name, ranking_type, captured_at, capture_hour, record_count, trigger_mode, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRecord = database.prepare(`
      INSERT INTO records (
        id, batch_id, category_id, category_name, ranking_type, capture_hour, captured_at,
        rank, product_id, product_name, shop_name, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const upsertSetting = database.prepare(`
      INSERT INTO kv_store (key, value) VALUES ('settings', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    for (const user of normalized.users) {
      insertUser.run(
        user.id,
        user.username,
        user.displayName,
        user.passwordHash,
        user.role,
        user.createdAt || nowIso(),
        JSON.stringify(user)
      );
    }

    for (const category of normalized.categories) {
      insertCategory.run(
        category.id,
        category.name,
        category.code || "",
        category.createdAt || "",
        JSON.stringify(category.ownerUserIds || []),
        JSON.stringify(category)
      );
    }

    for (const batch of normalized.captureBatches) {
      insertBatch.run(
        batch.id,
        batch.categoryId || "",
        batch.categoryName || "",
        batch.rankingType || "",
        batch.capturedAt || "",
        batch.captureHour || "",
        Number(batch.recordCount || 0),
        batch.triggerMode || "",
        JSON.stringify(batch)
      );
    }

    for (const record of normalized.records) {
      insertRecord.run(
        record.id,
        record.batchId || "",
        record.categoryId || "",
        record.categoryName || "",
        record.rankingType || "",
        record.captureHour || "",
        record.capturedAt || "",
        Number(record.rank || 0),
        record.productId || "",
        record.productName || "",
        record.shopName || "",
        JSON.stringify(record)
      );
    }

    upsertSetting.run(JSON.stringify(normalized.settings));
  });
}

export function updateStore(updater) {
  const current = readStore();
  const next = updater(current);
  writeStore(next);
  return normalizeStore(next);
}

export const storePaths = {
  json: STORE_FILE,
  sqlite: DB_FILE
};
