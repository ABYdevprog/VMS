import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';
import * as schema from './schema';

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  codename TEXT NOT NULL,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  model_id TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
  thinking_level TEXT NOT NULL DEFAULT 'high',
  daily_budget_usd REAL NOT NULL DEFAULT 1.5,
  playbook_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'idle',
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_playbooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  winning_patterns_json TEXT NOT NULL DEFAULT '[]',
  avoid_patterns_json TEXT NOT NULL DEFAULT '[]',
  kaizen_reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS autonomy_policies (
  gate_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'REQUIRE_APPROVAL',
  daily_cap INTEGER NOT NULL DEFAULT 25,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_type TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  metrics_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_run_id INTEGER,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  execution_mode TEXT NOT NULL DEFAULT 'antigravity_native',
  model_used TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  output_summary TEXT NOT NULL,
  artifact_path TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  target_sectors_json TEXT NOT NULL DEFAULT '[]',
  starter_price_try INTEGER NOT NULL,
  pro_price_try INTEGER NOT NULL,
  enterprise_setup_try INTEGER NOT NULL,
  features_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'live',
  mrr_try INTEGER NOT NULL DEFAULT 0,
  active_customers INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sector TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  instagram_handle TEXT NOT NULL,
  pain_point TEXT NOT NULL,
  lead_score INTEGER NOT NULL,
  stage TEXT NOT NULL DEFAULT 'DISCOVERED',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_demos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  product_slug TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT NOT NULL,
  subheadline TEXT NOT NULL,
  sector TEXT NOT NULL,
  city TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  assistant_name TEXT NOT NULL,
  welcome_message TEXT NOT NULL,
  services_json TEXT NOT NULL DEFAULT '[]',
  faq_json TEXT NOT NULL DEFAULT '[]',
  views_count INTEGER NOT NULL DEFAULT 0,
  chats_count INTEGER NOT NULL DEFAULT 0,
  appointments_booked_count INTEGER NOT NULL DEFAULT 0,
  checkout_clicks_count INTEGER NOT NULL DEFAULT 0,
  last_interacted_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  demo_slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  variant TEXT NOT NULL,
  hook_style TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS approval_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  gate_key TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING',
  decided_by TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS content_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  sector TEXT NOT NULL,
  target_keyword TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  social_hook TEXT NOT NULL,
  views_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PUBLISHED',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  lead_id INTEGER,
  business_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  plan_tier TEXT NOT NULL,
  amount_try INTEGER NOT NULL,
  payment_provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'TRIAL_ACTIVE',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kaizen_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_run_id INTEGER,
  evaluated_date TEXT NOT NULL,
  winning_variant TEXT NOT NULL,
  top_sector TEXT NOT NULL,
  conversion_rate_pct REAL NOT NULL,
  insights_summary TEXT NOT NULL,
  upgraded_agents_json TEXT NOT NULL DEFAULT '[]',
  new_build_spec_path TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

declare global {
  // eslint-disable-next-line no-var
  var __vmsDbInstance: BetterSQLite3Database<typeof schema> | undefined;
  // eslint-disable-next-line no-var
  var __vmsDbPath: string | undefined;
}

export function resolveDbPath(): string {
  if (process.env.VMS_DB_PATH) {
    return path.resolve(process.env.VMS_DB_PATH);
  }
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'vms.db');
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  const targetPath = resolveDbPath();
  if (global.__vmsDbInstance && global.__vmsDbPath === targetPath) {
    return global.__vmsDbInstance;
  }

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(targetPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.exec(BOOTSTRAP_SQL);

  const instance = drizzle(sqlite, { schema });
  global.__vmsDbInstance = instance;
  global.__vmsDbPath = targetPath;
  return instance;
}

export function resetDbConnectionForTests(): void {
  global.__vmsDbInstance = undefined;
  global.__vmsDbPath = undefined;
}
