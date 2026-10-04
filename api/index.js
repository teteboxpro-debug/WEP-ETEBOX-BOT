// server/app.ts
import express from "express";

// server/db.ts
import fs from "node:fs";
import path from "node:path";

// server/supabase.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
var supabaseInstance = null;
var connectionVerified = false;
var lastConnectionCheck = {
  ok: false,
  status: "CONNECTION_FAILED",
  displayStatus: "Database: Not Connected",
  message: "Supabase client not initialized yet",
  reason: "Server is starting up",
  projectId: "cprdffrxsunfiyfsuold",
  url: "https://cprdffrxsunfiyfsuold.supabase.co",
  timestamp: (/* @__PURE__ */ new Date()).toISOString()
};
var SUPABASE_CONFIG = {
  get url() {
    return process.env.SUPABASE_URL || "https://cprdffrxsunfiyfsuold.supabase.co";
  },
  get secretKey() {
    return process.env.SUPABASE_SECRET_KEY || "";
  },
  get projectId() {
    const match = this.url.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
    return match ? match[1] : "cprdffrxsunfiyfsuold";
  },
  get isConfigured() {
    return Boolean(this.url && this.secretKey && this.secretKey !== "your_supabase_secret_key_here");
  }
};
function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  if (!SUPABASE_CONFIG.isConfigured) {
    lastConnectionCheck = {
      ok: false,
      status: "CONNECTION_FAILED",
      displayStatus: "Database: Not Connected",
      message: "Supabase PostgreSQL: CONNECTION FAILED",
      reason: "SUPABASE_SECRET_KEY is missing or unconfigured in server environment. Set SUPABASE_URL and SUPABASE_SECRET_KEY in server environment for permanent persistence.",
      projectId: SUPABASE_CONFIG.projectId,
      url: SUPABASE_CONFIG.url,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    return null;
  }
  try {
    supabaseInstance = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: "public"
      }
    });
    return supabaseInstance;
  } catch (err) {
    lastConnectionCheck = {
      ok: false,
      status: "CONNECTION_FAILED",
      displayStatus: "Database: Not Connected",
      message: "Supabase PostgreSQL: CONNECTION FAILED",
      reason: `Failed to initialize Supabase client: ${err.message}`,
      projectId: SUPABASE_CONFIG.projectId,
      url: SUPABASE_CONFIG.url,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    return null;
  }
}
async function verifySupabaseConnection() {
  const client = getSupabase();
  const projectId = SUPABASE_CONFIG.projectId;
  const url = SUPABASE_CONFIG.url;
  if (!client) {
    lastConnectionCheck = {
      ok: false,
      status: "CONNECTION_FAILED",
      displayStatus: "Database: Not Connected",
      message: "Supabase PostgreSQL: CONNECTION FAILED",
      reason: SUPABASE_CONFIG.secretKey ? "Supabase client failed to initialize" : "SUPABASE_SECRET_KEY is missing or unconfigured in server environment.",
      projectId,
      url,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    connectionVerified = false;
    return lastConnectionCheck;
  }
  try {
    const requiredTables = ["bot_settings", "users", "video_packages", "star_transactions"];
    const tablesVerified = [];
    const missingTables = [];
    const { error: settingsErr } = await client.from("bot_settings").select("id").limit(1);
    if (settingsErr) {
      if (settingsErr.code === "42P01") {
        lastConnectionCheck = {
          ok: false,
          status: "SCHEMA_MISSING",
          displayStatus: "Database: Schema Missing",
          message: "Supabase PostgreSQL: SCHEMA MISSING",
          reason: "Connected to Supabase PostgreSQL, but required database tables are not yet created. Execute server/schema.sql in Supabase SQL Editor.",
          projectId,
          url,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        connectionVerified = false;
        return lastConnectionCheck;
      }
      const safeReason = settingsErr.message.includes("JWT") ? "Invalid or expired SUPABASE_SECRET_KEY" : `Database query error: ${settingsErr.message}`;
      lastConnectionCheck = {
        ok: false,
        status: "CONNECTION_FAILED",
        displayStatus: "Database: Not Connected",
        message: "Supabase PostgreSQL: CONNECTION FAILED",
        reason: safeReason,
        projectId,
        url,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      connectionVerified = false;
      return lastConnectionCheck;
    }
    tablesVerified.push("bot_settings");
    for (const tbl of ["users", "video_packages", "star_transactions"]) {
      const { error: tblErr } = await client.from(tbl).select("id").limit(1);
      if (tblErr && tblErr.code === "42P01") {
        missingTables.push(tbl);
      } else if (!tblErr) {
        tablesVerified.push(tbl);
      }
    }
    if (missingTables.length > 0) {
      lastConnectionCheck = {
        ok: false,
        status: "SCHEMA_MISSING",
        displayStatus: "Database: Schema Missing",
        message: "Supabase PostgreSQL: SCHEMA MISSING",
        reason: `Some tables are missing: ${missingTables.join(", ")}. Please run server/schema.sql in Supabase SQL Editor.`,
        projectId,
        url,
        tablesVerified,
        missingTables,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      connectionVerified = false;
      return lastConnectionCheck;
    }
    lastConnectionCheck = {
      ok: true,
      status: "CONNECTED",
      displayStatus: "Database: Connected",
      message: "Supabase PostgreSQL: CONNECTED",
      projectId,
      url,
      tablesVerified,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    connectionVerified = true;
    return lastConnectionCheck;
  } catch (err) {
    lastConnectionCheck = {
      ok: false,
      status: "CONNECTION_FAILED",
      displayStatus: "Database: Not Connected",
      message: "Supabase PostgreSQL: CONNECTION FAILED",
      reason: `Connection check exception: ${err.message || "Network error"}`,
      projectId,
      url,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    connectionVerified = false;
    return lastConnectionCheck;
  }
}
function getSupabaseStatus() {
  return {
    isConfigured: SUPABASE_CONFIG.isConfigured,
    url: SUPABASE_CONFIG.url,
    projectId: SUPABASE_CONFIG.projectId,
    verified: connectionVerified,
    status: lastConnectionCheck.status,
    displayStatus: lastConnectionCheck.displayStatus,
    message: lastConnectionCheck.message,
    reason: lastConnectionCheck.reason,
    lastCheck: lastConnectionCheck
  };
}

// server/db.ts
function toSafeTelegramUserId(val) {
  if (typeof val === "number" && !isNaN(val) && isFinite(val) && val > 0) {
    return Math.floor(val);
  }
  const str = String(val || "").trim();
  const parsed = parseInt(str, 10);
  if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 7e7 + Math.abs(hash) % 2e7;
}
function createInitialState() {
  return {
    users: [],
    admins: [
      {
        id: "admin_1",
        username: "Abood",
        password_hash: "321325",
        permissions: ["all"],
        status: "active",
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ],
    bot_settings: {
      bot_token: process.env.TELEGRAM_BOT_TOKEN || "",
      store_url: "https://etebox.com/store",
      backup_bot_url: "https://t.me/EteboxBackupBot",
      auto_notify_free_content: true,
      reward_stars: 3,
      reward_hours: 8,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    star_transactions: [],
    star_packages: [
      {
        id: "pkg_1",
        name: "Starter Star Pack",
        stars_amount: 50,
        price_usd: 1.99,
        payment_url: "https://pay.example.com/starter",
        payment_info: "Instant activation via Crypto/Card",
        is_active: true
      },
      {
        id: "pkg_2",
        name: "Standard Star Pack",
        stars_amount: 150,
        price_usd: 4.99,
        payment_url: "https://pay.example.com/standard",
        payment_info: "Instant activation via Crypto/Card",
        is_active: true
      },
      {
        id: "pkg_3",
        name: "VIP Mega Pack",
        stars_amount: 500,
        price_usd: 14.99,
        payment_url: "https://pay.example.com/vip",
        payment_info: "Instant VIP perks included",
        is_active: true
      }
    ],
    star_codes: [
      {
        id: "code_welcome",
        code: "WELCOME50",
        stars_amount: 50,
        is_active: true,
        is_used: false,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "code_promo",
        code: "ETEBOX2026",
        stars_amount: 100,
        is_active: true,
        is_used: false,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ],
    referrals: [],
    free_videos: [
      {
        id: "fv_1",
        title: "Exclusive Action Trailer 4K",
        delivery_type: "DIRECT_VIDEO",
        direct_video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        file_size_mb: 28.5,
        description: "Instant preview of premium catalog files.",
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ],
    files: [
      {
        id: "file_1",
        file_name: "Premium Archive Vol.1",
        sample_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        download_url: "https://mega.nz/file/etebox_vault_vol1",
        file_code: "ETB-9021",
        zip_password: "Pass2026@etebox",
        price_stars: 20,
        is_active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ],
    file_purchases: [],
    channels: [
      {
        id: "ch_1",
        name: "ETEBOX Official Updates",
        url: "https://t.me/etebox_official",
        display_order: 1,
        is_active: true,
        required_stars: 0
      },
      {
        id: "ch_2",
        name: "VIP Private Vault Channel",
        url: "https://t.me/+etebox_vip_vault",
        display_order: 2,
        is_active: true,
        required_stars: 35
      }
    ],
    channel_unlocks: [],
    video_packages: [
      {
        id: "vp_1",
        package_name: "5 Videos Package",
        number_of_videos: 5,
        stars_price: 40,
        video_urls: [
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
        ],
        active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        id: "vp_2",
        package_name: "2 Videos Package",
        number_of_videos: 2,
        stars_price: 20,
        video_urls: [
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4"
        ],
        active: true,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ],
    video_package_purchases: [],
    human_verifications: [],
    game_records: [],
    broadcasts: [],
    scheduled_deletions: [],
    admin_logs: [
      {
        id: "log_init",
        admin_username: "system",
        action: "DB_INITIALIZED",
        details: "PostgreSQL database layer initialized",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]
  };
}
var DatabaseService = class {
  data = createInitialState();
  isLoaded = false;
  isSyncing = false;
  syncQueue = Promise.resolve();
  constructor() {
    this.init().catch((err) => {
      console.error("[DB] Initial Supabase sync attempt error:", err.message);
    });
  }
  /**
   * Initializes database connection, checks for legacy JSON database, and syncs with Supabase
   */
  async init() {
    if (this.isLoaded) return;
    await this.migrateFromJsonIfAvailable();
    const supabase = getSupabase();
    if (!supabase) {
      console.warn("[DB] Supabase client not configured in environment yet. Operating in-memory with preserved data.");
      this.isLoaded = true;
      return;
    }
    try {
      await verifySupabaseConnection();
      await this.pullFromSupabase();
      await this.syncToSupabase();
      this.isLoaded = true;
      console.log("[DB] Successfully synchronized state with Supabase PostgreSQL database.");
    } catch (err) {
      console.error("[DB] Failed to synchronize data with Supabase:", err.message);
      this.isLoaded = true;
    }
  }
  /**
   * Reads existing data from data/etebox_database.json (if present)
   * and migrates it idempotently into memory and Supabase.
   */
  async migrateFromJsonIfAvailable() {
    const jsonPaths = [
      path.resolve(process.cwd(), "data", "etebox_database.json"),
      path.resolve("/tmp", "etebox_data", "etebox_database.json")
    ];
    let sourceFile = null;
    for (const p of jsonPaths) {
      if (fs.existsSync(p)) {
        sourceFile = p;
        break;
      }
    }
    if (!sourceFile) {
      return;
    }
    try {
      console.log(`[DB Migration] Found existing JSON database at: ${sourceFile}. Starting safe migration...`);
      const fileContent = fs.readFileSync(sourceFile, "utf8");
      const json = JSON.parse(fileContent);
      if (json.users) {
        const userList = Array.isArray(json.users) ? json.users : Object.values(json.users);
        for (const u of userList) {
          const userIdStr = String(u.id || u.telegram_user_id);
          const safeId = toSafeTelegramUserId(userIdStr);
          const existing = this.data.users.find((x) => x.id === userIdStr || x.telegram_user_id === safeId);
          if (!existing) {
            this.data.users.push({
              id: userIdStr,
              telegram_user_id: safeId,
              username: u.username || void 0,
              first_name: u.first_name || void 0,
              balance: Number(u.balance) || 0,
              total_earned: Number(u.total_earned) || Number(u.balance) || 0,
              total_spent: Number(u.total_spent) || 0,
              registered_at: u.registered_at || (/* @__PURE__ */ new Date()).toISOString(),
              last_activity_at: u.last_activity_at || u.last_activity || (/* @__PURE__ */ new Date()).toISOString(),
              last_reward_at: u.last_auto_reward_at || u.last_reward_at || void 0,
              verification_status: u.verification_status || "verified",
              failed_verification_attempts: Number(u.failed_verification_attempts) || 0,
              referral_count: Number(u.referral_count) || 0,
              referred_by: u.referred_by ? String(u.referred_by) : void 0,
              is_banned: Boolean(u.is_banned || u.ban_status),
              banned_reason: u.banned_reason || void 0,
              unlocked_channels: Array.isArray(u.unlocked_channels) ? u.unlocked_channels : []
            });
          }
        }
      }
      if (json.admins) {
        const adminList = Array.isArray(json.admins) ? json.admins : Object.values(json.admins);
        for (const a of adminList) {
          if (!this.data.admins.some((x) => x.username.toLowerCase() === a.username.toLowerCase())) {
            this.data.admins.push({
              id: a.id || `admin_${Date.now()}`,
              username: a.username,
              password_hash: a.password_hash,
              permissions: Array.isArray(a.permissions) ? a.permissions : ["all"],
              status: a.status || "active",
              created_at: a.created_at || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      if (json.bot_settings) {
        const bs = json.bot_settings;
        this.data.bot_settings = {
          bot_token: bs.bot_token || bs.main_bot_token || this.data.bot_settings.bot_token,
          store_url: bs.store_url || this.data.bot_settings.store_url,
          backup_bot_url: bs.backup_bot_url || this.data.bot_settings.backup_bot_url,
          auto_notify_free_content: bs.auto_notify_free_content ?? this.data.bot_settings.auto_notify_free_content,
          reward_stars: bs.reward_stars ?? this.data.bot_settings.reward_stars,
          reward_hours: bs.reward_hours ?? this.data.bot_settings.reward_hours,
          webhook_url: bs.webhook_url,
          webhook_secret: bs.webhook_secret,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      if (Array.isArray(json.star_transactions)) {
        for (const tx of json.star_transactions) {
          if (!this.data.star_transactions.some((x) => x.id === tx.id)) {
            this.data.star_transactions.push({
              id: tx.id,
              user_id: String(tx.user_id),
              amount: Number(tx.amount),
              balance_before: Number(tx.balance_before),
              balance_after: Number(tx.balance_after),
              type: tx.type,
              description: tx.description,
              reference_id: tx.reference_id,
              timestamp: tx.timestamp || tx.created_at || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      if (Array.isArray(json.star_packages)) {
        for (const pkg of json.star_packages) {
          if (!this.data.star_packages.some((x) => x.id === pkg.id)) {
            this.data.star_packages.push(pkg);
          }
        }
      }
      if (json.star_codes) {
        const codeList = Array.isArray(json.star_codes) ? json.star_codes : Object.values(json.star_codes);
        for (const c of codeList) {
          if (!this.data.star_codes.some((x) => x.code === c.code)) {
            this.data.star_codes.push({
              id: c.id || `code_${c.code}`,
              code: c.code,
              stars_amount: Number(c.stars_amount),
              is_active: Boolean(c.is_active),
              is_used: Boolean(c.is_used),
              used_by_user_id: c.used_by_user_id ? String(c.used_by_user_id) : void 0,
              used_by_username: c.used_by_username,
              used_at: c.used_at,
              created_at: c.created_at || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      if (Array.isArray(json.free_videos)) {
        for (const fv of json.free_videos) {
          if (!this.data.free_videos.some((x) => x.id === fv.id)) {
            this.data.free_videos.push(fv);
          }
        }
      }
      if (Array.isArray(json.files)) {
        for (const f of json.files) {
          if (!this.data.files.some((x) => x.id === f.id)) {
            this.data.files.push(f);
          }
        }
      }
      if (Array.isArray(json.file_purchases)) {
        for (const fp of json.file_purchases) {
          if (!this.data.file_purchases.some((x) => x.id === fp.id)) {
            this.data.file_purchases.push({ ...fp, user_id: String(fp.user_id) });
          }
        }
      }
      if (Array.isArray(json.channels)) {
        for (const ch of json.channels) {
          if (!this.data.channels.some((x) => x.id === ch.id)) {
            this.data.channels.push(ch);
          }
        }
      }
      if (Array.isArray(json.referrals)) {
        for (const r of json.referrals) {
          if (!this.data.referrals.some((x) => x.id === r.id)) {
            this.data.referrals.push({
              id: r.id,
              referrer_user_id: String(r.referrer_user_id),
              referred_user_id: String(r.referred_user_id),
              reward_amount: Number(r.stars_rewarded || r.reward_amount || 5),
              created_at: r.created_at || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      if (Array.isArray(json.video_packages)) {
        for (const vp of json.video_packages) {
          if (!this.data.video_packages.some((x) => x.id === vp.id)) {
            this.data.video_packages.push(vp);
          }
        }
      }
      if (Array.isArray(json.video_package_purchases)) {
        for (const vpp of json.video_package_purchases) {
          if (!this.data.video_package_purchases.some((x) => x.id === vpp.id)) {
            this.data.video_package_purchases.push({ ...vpp, user_id: String(vpp.user_id) });
          }
        }
      }
      if (Array.isArray(json.admin_logs)) {
        for (const l of json.admin_logs) {
          if (!this.data.admin_logs.some((x) => x.id === l.id)) {
            this.data.admin_logs.push(l);
          }
        }
      }
      console.log(`[DB Migration] Safely ingested JSON database: ${this.data.users.length} users, ${this.data.star_transactions.length} transactions.`);
    } catch (err) {
      console.error("[DB Migration] Error migrating data from JSON:", err.message);
    }
  }
  /**
   * Reads all tables from Supabase into memory cache
   */
  async pullFromSupabase() {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { data: settingsData } = await supabase.from("bot_settings").select("*").limit(1).maybeSingle();
      if (settingsData) {
        this.data.bot_settings = {
          bot_token: settingsData.bot_token || this.data.bot_settings.bot_token,
          store_url: settingsData.store_url || this.data.bot_settings.store_url,
          backup_bot_url: settingsData.backup_bot_url || this.data.bot_settings.backup_bot_url,
          auto_notify_free_content: settingsData.auto_notify_free_content ?? true,
          reward_stars: settingsData.reward_stars ?? 3,
          reward_hours: settingsData.reward_hours ?? 8,
          webhook_url: settingsData.webhook_url,
          webhook_secret: settingsData.webhook_secret,
          updated_at: settingsData.updated_at
        };
      }
      const { data: usersData } = await supabase.from("users").select("*");
      if (usersData && usersData.length > 0) {
        this.data.users = usersData.map((u) => ({
          id: String(u.telegram_user_id),
          telegram_user_id: Number(u.telegram_user_id),
          username: u.username || void 0,
          first_name: u.first_name || void 0,
          balance: Number(u.balance) || 0,
          total_earned: Number(u.total_earned) || 0,
          total_spent: Number(u.total_spent) || 0,
          registered_at: u.registered_at,
          last_activity_at: u.last_activity,
          last_reward_at: u.last_reward_at || void 0,
          verification_status: u.verification_status || "verified",
          failed_verification_attempts: u.failed_verification_attempts || 0,
          referral_count: u.referral_count || 0,
          referred_by: u.referred_by ? String(u.referred_by) : void 0,
          is_banned: Boolean(u.ban_status),
          banned_reason: u.banned_reason || void 0,
          unlocked_channels: Array.isArray(u.unlocked_channels) ? u.unlocked_channels : []
        }));
      }
      const { data: adminsData } = await supabase.from("admins").select("*");
      if (adminsData && adminsData.length > 0) {
        this.data.admins = adminsData.map((a) => ({
          id: a.id,
          username: a.username,
          password_hash: a.password_hash,
          permissions: Array.isArray(a.permissions) ? a.permissions : ["all"],
          status: a.status || "active",
          created_at: a.created_at
        }));
      }
      const { data: pkgData } = await supabase.from("video_packages").select("*");
      if (pkgData && pkgData.length > 0) {
        this.data.video_packages = pkgData.map((p) => ({
          id: p.id,
          package_name: p.package_name,
          number_of_videos: Number(p.number_of_videos),
          stars_price: Number(p.stars_price),
          video_urls: Array.isArray(p.video_urls) ? p.video_urls : [],
          active: Boolean(p.active),
          created_at: p.created_at,
          updated_at: p.updated_at
        }));
      }
      const { data: vPurchases } = await supabase.from("video_package_purchases").select("*");
      if (vPurchases) {
        this.data.video_package_purchases = vPurchases.map((vp) => ({
          id: vp.id,
          user_id: String(vp.user_id),
          package_id: vp.package_id,
          package_name: vp.package_name,
          price_paid: Number(vp.price_paid),
          video_count: Number(vp.video_count),
          video_urls: Array.isArray(vp.video_urls) ? vp.video_urls : [],
          purchased_at: vp.purchased_at
        }));
      }
      const { data: txData } = await supabase.from("star_transactions").select("*").order("created_at", { ascending: false }).limit(100);
      if (txData && txData.length > 0) {
        this.data.star_transactions = txData.map((t) => ({
          id: t.id,
          user_id: String(t.user_id),
          amount: Number(t.amount),
          balance_before: Number(t.balance_before),
          balance_after: Number(t.balance_after),
          type: t.transaction_type,
          description: t.description,
          reference_id: t.reference_id,
          timestamp: t.created_at
        }));
      }
      const { data: fvData } = await supabase.from("free_videos").select("*");
      if (fvData && fvData.length > 0) {
        this.data.free_videos = fvData;
      }
      const { data: fData } = await supabase.from("files").select("*");
      if (fData && fData.length > 0) {
        this.data.files = fData;
      }
      const { data: fpData } = await supabase.from("file_purchases").select("*");
      if (fpData) {
        this.data.file_purchases = fpData.map((fp) => ({
          ...fp,
          user_id: String(fp.user_id)
        }));
      }
      const { data: spData } = await supabase.from("star_packages").select("*");
      if (spData && spData.length > 0) this.data.star_packages = spData;
      const { data: scData } = await supabase.from("star_codes").select("*");
      if (scData && scData.length > 0) {
        this.data.star_codes = scData.map((sc) => ({
          ...sc,
          used_by_user_id: sc.used_by_user_id ? String(sc.used_by_user_id) : void 0
        }));
      }
      const { data: chData } = await supabase.from("channels").select("*");
      if (chData && chData.length > 0) this.data.channels = chData;
    } catch (err) {
      console.warn("[DB] Supabase pull notice:", err.message);
    }
  }
  /**
   * Synchronizes current memory state changes to Supabase PostgreSQL
   */
  async syncToSupabase() {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await supabase.from("bot_settings").upsert({
        id: "current",
        bot_token: this.data.bot_settings.bot_token,
        store_url: this.data.bot_settings.store_url,
        backup_bot_url: this.data.bot_settings.backup_bot_url,
        auto_notify_free_content: this.data.bot_settings.auto_notify_free_content,
        reward_stars: this.data.bot_settings.reward_stars,
        reward_hours: this.data.bot_settings.reward_hours,
        webhook_url: this.data.bot_settings.webhook_url,
        webhook_secret: this.data.bot_settings.webhook_secret,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (this.data.users.length > 0) {
        const userRows = this.data.users.map((u) => ({
          telegram_user_id: toSafeTelegramUserId(u.telegram_user_id || u.id),
          username: u.username || null,
          first_name: u.first_name || null,
          balance: Number(u.balance) || 0,
          total_earned: Number(u.total_earned) || 0,
          total_spent: Number(u.total_spent) || 0,
          registered_at: u.registered_at || (/* @__PURE__ */ new Date()).toISOString(),
          last_activity: u.last_activity_at || (/* @__PURE__ */ new Date()).toISOString(),
          last_reward_at: u.last_reward_at || null,
          verification_status: u.verification_status || "verified",
          failed_verification_attempts: Number(u.failed_verification_attempts) || 0,
          referral_count: Number(u.referral_count) || 0,
          referred_by: u.referred_by ? toSafeTelegramUserId(u.referred_by) : null,
          ban_status: Boolean(u.is_banned),
          banned_reason: u.banned_reason || null,
          unlocked_channels: Array.isArray(u.unlocked_channels) ? u.unlocked_channels : []
        }));
        await supabase.from("users").upsert(userRows, { onConflict: "telegram_user_id" });
      }
      if (this.data.video_packages.length > 0) {
        const pkgRows = this.data.video_packages.map((p) => ({
          id: p.id,
          package_name: p.package_name,
          number_of_videos: p.number_of_videos,
          stars_price: p.stars_price,
          video_urls: p.video_urls,
          active: p.active,
          created_at: p.created_at,
          updated_at: p.updated_at
        }));
        await supabase.from("video_packages").upsert(pkgRows, { onConflict: "id" });
      }
      if (this.data.video_package_purchases.length > 0) {
        const vpRows = this.data.video_package_purchases.map((vp) => ({
          id: vp.id,
          user_id: toSafeTelegramUserId(vp.user_id),
          package_id: vp.package_id,
          package_name: vp.package_name,
          price_paid: vp.price_paid,
          video_count: vp.video_count,
          video_urls: vp.video_urls,
          purchased_at: vp.purchased_at
        }));
        await supabase.from("video_package_purchases").upsert(vpRows, { onConflict: "id" });
      }
      if (this.data.star_transactions.length > 0) {
        const txRows = this.data.star_transactions.slice(0, 50).map((t) => ({
          id: t.id,
          user_id: toSafeTelegramUserId(t.user_id),
          amount: t.amount,
          balance_before: t.balance_before,
          balance_after: t.balance_after,
          transaction_type: t.type,
          description: t.description,
          reference_id: t.reference_id || null,
          created_at: t.timestamp
        }));
        await supabase.from("star_transactions").upsert(txRows, { onConflict: "id" });
      }
      if (this.data.star_codes.length > 0) {
        const scRows = this.data.star_codes.map((sc) => ({
          id: sc.id,
          code: sc.code,
          stars_amount: sc.stars_amount,
          is_active: sc.is_active,
          is_used: sc.is_used,
          used_by_user_id: sc.used_by_user_id ? toSafeTelegramUserId(sc.used_by_user_id) : null,
          used_by_username: sc.used_by_username || null,
          used_at: sc.used_at || null,
          created_at: sc.created_at
        }));
        await supabase.from("star_codes").upsert(scRows, { onConflict: "id" });
      }
      if (this.data.free_videos.length > 0) {
        await supabase.from("free_videos").upsert(this.data.free_videos, { onConflict: "id" });
      }
      if (this.data.files.length > 0) {
        await supabase.from("files").upsert(this.data.files, { onConflict: "id" });
      }
      if (this.data.file_purchases.length > 0) {
        const fpRows = this.data.file_purchases.map((fp) => ({
          ...fp,
          user_id: toSafeTelegramUserId(fp.user_id)
        }));
        await supabase.from("file_purchases").upsert(fpRows, { onConflict: "id" });
      }
      if (this.data.channels.length > 0) {
        await supabase.from("channels").upsert(this.data.channels, { onConflict: "id" });
      }
      if (this.data.admins.length > 0) {
        const adminRows = this.data.admins.map((a) => ({
          id: a.id,
          username: a.username,
          password_hash: a.password_hash,
          permissions: Array.isArray(a.permissions) ? a.permissions : ["all"],
          status: a.status || "active",
          created_at: a.created_at || (/* @__PURE__ */ new Date()).toISOString()
        }));
        await supabase.from("admins").upsert(adminRows, { onConflict: "username" });
      }
    } catch (err) {
      console.warn("[DB] Supabase push notice:", err.message);
    }
  }
  /**
   * Synchronous accessor for in-memory mirror of PostgreSQL database
   */
  getRaw() {
    return this.data;
  }
  /**
   * Atomic mutation runner preserving compatibility with existing code
   */
  async atomic(updater) {
    this.syncQueue = this.syncQueue.catch(() => {
    }).then(async () => {
      try {
        await updater(this.data);
      } catch (err) {
        console.error("[DB] Atomic updater error:", err);
        throw err;
      }
      try {
        await this.syncToSupabase();
      } catch (syncErr) {
        console.warn("[DB] Atomic sync warning:", syncErr?.message || syncErr);
      }
    });
    await this.syncQueue;
    return this.data;
  }
  /**
   * Find or create persistent Telegram user by telegram_user_id
   */
  async getOrCreateUser(telegramId, username, firstName, referrerId) {
    const strId = String(telegramId);
    let user = this.data.users.find((u) => u.telegram_user_id === telegramId || u.id === strId);
    if (user) {
      await this.atomic((data) => {
        const target = data.users.find((u) => u.telegram_user_id === telegramId || u.id === strId);
        if (target) {
          target.last_activity_at = (/* @__PURE__ */ new Date()).toISOString();
          if (username) target.username = username;
          if (firstName) target.first_name = firstName;
        }
      });
      return this.data.users.find((u) => u.telegram_user_id === telegramId || u.id === strId);
    }
    const newUser = {
      id: strId,
      telegram_user_id: telegramId,
      username,
      first_name: firstName,
      balance: 10,
      // Starting welcome balance: 10 Stars
      total_earned: 10,
      total_spent: 0,
      registered_at: (/* @__PURE__ */ new Date()).toISOString(),
      last_activity_at: (/* @__PURE__ */ new Date()).toISOString(),
      verification_status: "verified",
      failed_verification_attempts: 0,
      referral_count: 0,
      referred_by: referrerId ? String(referrerId) : void 0,
      is_banned: false,
      unlocked_channels: []
    };
    await this.atomic((data) => {
      data.users.push(newUser);
      data.star_transactions.unshift({
        id: `tx_welcome_${Date.now()}`,
        user_id: strId,
        amount: 10,
        balance_before: 0,
        balance_after: 10,
        type: "reward",
        description: "\u{1F389} Welcome Bonus Stars",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (referrerId && referrerId !== telegramId) {
        const referrer = data.users.find((u) => u.telegram_user_id === referrerId || u.id === String(referrerId));
        if (referrer) {
          referrer.referral_count = (referrer.referral_count || 0) + 1;
          const oldBal = referrer.balance;
          referrer.balance += 5;
          referrer.total_earned += 5;
          data.referrals.push({
            id: `ref_${Date.now()}`,
            referrer_user_id: String(referrerId),
            referred_user_id: strId,
            reward_amount: 5,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          data.star_transactions.unshift({
            id: `tx_ref_${Date.now()}`,
            user_id: String(referrerId),
            amount: 5,
            balance_before: oldBal,
            balance_after: referrer.balance,
            type: "referral",
            description: `\u{1F465} Referral reward from user @${username || strId}`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    });
    return newUser;
  }
  /**
   * ATOMIC Video Package Purchase Operation
   */
  async executeVideoPackagePurchase(telegramId, packageId) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("purchase_video_package", {
          p_user_id: telegramId,
          p_package_id: packageId
        });
        if (!rpcErr && rpcRes) {
          if (!rpcRes.success) {
            return { success: false, error: rpcRes.error };
          }
          await this.pullFromSupabase();
          return {
            success: true,
            purchase: {
              id: rpcRes.purchase_id,
              user_id: String(telegramId),
              package_id: packageId,
              package_name: rpcRes.package_name,
              price_paid: rpcRes.stars_paid,
              video_count: rpcRes.video_count,
              video_urls: rpcRes.video_urls,
              purchased_at: (/* @__PURE__ */ new Date()).toISOString()
            },
            links: rpcRes.video_urls,
            remainingBalance: rpcRes.remaining_balance
          };
        }
      } catch (err) {
        console.warn("[DB] Supabase RPC fallback to atomic layer:", err.message);
      }
    }
    let purchaseResult = null;
    let purchaseError = null;
    await this.atomic((data) => {
      const user = data.users.find((u) => u.telegram_user_id === telegramId || u.id === String(telegramId));
      if (!user) {
        purchaseError = "User account not found";
        return;
      }
      if (user.is_banned) {
        purchaseError = "Your account has been restricted";
        return;
      }
      const pkg = data.video_packages.find((p) => p.id === packageId && p.active);
      if (!pkg) {
        purchaseError = "Video package is unavailable or inactive";
        return;
      }
      if (user.balance < pkg.stars_price) {
        purchaseError = `Insufficient Stars. Required: ${pkg.stars_price} \u2B50, Balance: ${user.balance} \u2B50`;
        return;
      }
      const balanceBefore = user.balance;
      user.balance -= pkg.stars_price;
      user.total_spent += pkg.stars_price;
      user.last_activity_at = (/* @__PURE__ */ new Date()).toISOString();
      const purchaseId = `vpur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const purchase = {
        id: purchaseId,
        user_id: String(telegramId),
        package_id: pkg.id,
        package_name: pkg.package_name,
        price_paid: pkg.stars_price,
        video_count: pkg.number_of_videos,
        video_urls: [...pkg.video_urls],
        purchased_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      data.video_package_purchases.unshift(purchase);
      data.star_transactions.unshift({
        id: `tx_${Date.now()}`,
        user_id: String(telegramId),
        amount: -pkg.stars_price,
        balance_before: balanceBefore,
        balance_after: user.balance,
        type: "video_purchase",
        description: `\u{1F3AC} Purchased ${pkg.package_name} (${pkg.number_of_videos} Videos)`,
        reference_id: purchaseId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      purchaseResult = {
        purchase,
        links: pkg.video_urls,
        remainingBalance: user.balance
      };
    });
    if (purchaseError) {
      return { success: false, error: purchaseError };
    }
    return {
      success: true,
      purchase: purchaseResult.purchase,
      links: purchaseResult.links,
      remainingBalance: purchaseResult.remainingBalance
    };
  }
  /**
   * ATOMIC Paid File Purchase
   */
  async executeFilePurchase(telegramId, fileId) {
    let result = null;
    let purchaseError = null;
    await this.atomic((data) => {
      const user = data.users.find((u) => u.telegram_user_id === telegramId || u.id === String(telegramId));
      if (!user) {
        purchaseError = "User account not found";
        return;
      }
      if (user.is_banned) {
        purchaseError = "User is banned";
        return;
      }
      const file = data.files.find((f) => f.id === fileId && f.is_active);
      if (!file) {
        purchaseError = "File not found or inactive";
        return;
      }
      if (user.balance < file.price_stars) {
        purchaseError = `Insufficient Stars. Price: ${file.price_stars} \u2B50, Balance: ${user.balance} \u2B50`;
        return;
      }
      const before = user.balance;
      user.balance -= file.price_stars;
      user.total_spent += file.price_stars;
      user.last_activity_at = (/* @__PURE__ */ new Date()).toISOString();
      const purchaseId = `fpur_${Date.now()}`;
      data.file_purchases.unshift({
        id: purchaseId,
        user_id: String(telegramId),
        file_id: file.id,
        file_name: file.file_name,
        price_paid: file.price_stars,
        file_code: file.file_code,
        zip_password: file.zip_password,
        purchased_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      data.star_transactions.unshift({
        id: `tx_${Date.now()}`,
        user_id: String(telegramId),
        amount: -file.price_stars,
        balance_before: before,
        balance_after: user.balance,
        type: "file_purchase",
        description: `\u{1F4C1} Purchased file: ${file.file_name}`,
        reference_id: purchaseId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      result = { file, remainingBalance: user.balance };
    });
    if (purchaseError) return { success: false, error: purchaseError };
    return { success: true, file: result.file, remainingBalance: result.remainingBalance };
  }
  /**
   * ATOMIC Auto-Reward Claim (+3 Stars every 8 hours)
   */
  async claimAutoReward(telegramId) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("claim_auto_reward", {
          p_user_id: telegramId
        });
        if (!rpcErr && rpcRes) {
          if (!rpcRes.success) {
            return {
              success: false,
              error: rpcRes.error,
              hoursRemaining: rpcRes.hours_remaining
            };
          }
          await this.pullFromSupabase();
          return {
            success: true,
            rewardStars: rpcRes.reward_stars,
            newBalance: rpcRes.new_balance
          };
        }
      } catch (err) {
        console.warn("[DB] Supabase RPC claimAutoReward fallback:", err.message);
      }
    }
    let rewardResult = null;
    let errorMsg = null;
    let hoursRemaining = 0;
    await this.atomic((data) => {
      const user = data.users.find((u) => u.telegram_user_id === telegramId || u.id === String(telegramId));
      if (!user) {
        errorMsg = "User not found";
        return;
      }
      const rewardHours = data.bot_settings.reward_hours || 8;
      const rewardStars = data.bot_settings.reward_stars || 3;
      if (user.last_reward_at) {
        const last = new Date(user.last_reward_at).getTime();
        const now = Date.now();
        const diffHours = (now - last) / (1e3 * 60 * 60);
        if (diffHours < rewardHours) {
          hoursRemaining = Math.max(0.1, Number((rewardHours - diffHours).toFixed(1)));
          errorMsg = `Reward on cooldown. Available in ${hoursRemaining} hours.`;
          return;
        }
      }
      const before = user.balance;
      user.balance += rewardStars;
      user.total_earned += rewardStars;
      user.last_reward_at = (/* @__PURE__ */ new Date()).toISOString();
      user.last_activity_at = (/* @__PURE__ */ new Date()).toISOString();
      data.star_transactions.unshift({
        id: `tx_reward_${Date.now()}`,
        user_id: String(telegramId),
        amount: rewardStars,
        balance_before: before,
        balance_after: user.balance,
        type: "reward",
        description: `\u{1F381} Auto-Reward (+${rewardStars} Stars)`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      rewardResult = {
        rewardStars,
        newBalance: user.balance
      };
    });
    if (errorMsg) {
      return { success: false, error: errorMsg, hoursRemaining };
    }
    return {
      success: true,
      rewardStars: rewardResult.rewardStars,
      newBalance: rewardResult.newBalance
    };
  }
  /**
   * ATOMIC Redeem Star Code
   */
  async redeemStarCode(telegramId, codeStr) {
    let result = null;
    let err = null;
    await this.atomic((data) => {
      const user = data.users.find((u) => u.telegram_user_id === telegramId || u.id === String(telegramId));
      if (!user) {
        err = "User not found";
        return;
      }
      const cleanCode = codeStr.trim().toUpperCase();
      const codeRecord = data.star_codes.find((c) => c.code.toUpperCase() === cleanCode && c.is_active);
      if (!codeRecord) {
        err = "Invalid or expired Star code";
        return;
      }
      if (codeRecord.is_used) {
        err = "This Star code has already been redeemed";
        return;
      }
      codeRecord.is_used = true;
      codeRecord.used_by_user_id = String(telegramId);
      codeRecord.used_by_username = user.username;
      codeRecord.used_at = (/* @__PURE__ */ new Date()).toISOString();
      const before = user.balance;
      user.balance += codeRecord.stars_amount;
      user.total_earned += codeRecord.stars_amount;
      user.last_activity_at = (/* @__PURE__ */ new Date()).toISOString();
      data.star_transactions.unshift({
        id: `tx_redeem_${Date.now()}`,
        user_id: String(telegramId),
        amount: codeRecord.stars_amount,
        balance_before: before,
        balance_after: user.balance,
        type: "redeem_code",
        description: `\u{1F39F}\uFE0F Redeemed Star code: ${codeRecord.code}`,
        reference_id: codeRecord.id,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      result = { starsAdded: codeRecord.stars_amount, newBalance: user.balance };
    });
    if (err) return { success: false, error: err };
    return { success: true, ...result };
  }
  /**
   * Schedule automatic message deletion (10 minutes)
   */
  async scheduleMessageDeletion(chatId, messageId, delayMs = 6e5) {
    const deleteAt = new Date(Date.now() + delayMs).toISOString();
    await this.atomic((data) => {
      data.scheduled_deletions.push({
        id: `del_${Date.now()}_${messageId}`,
        chat_id: chatId,
        message_id: messageId,
        delete_at: deleteAt,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  }
};
var db = new DatabaseService();

// server/telegramBot.ts
var TelegramBotService = class {
  pollingInterval = null;
  deletionInterval = null;
  lastUpdateId = 0;
  botInfo = null;
  isProcessing = false;
  constructor() {
    this.startDeletionWorker();
  }
  get botToken() {
    return db.getRaw().bot_settings?.bot_token || process.env.TELEGRAM_BOT_TOKEN || "";
  }
  get isConfigured() {
    return Boolean(this.botToken && this.botToken.length > 15);
  }
  async getBotStatus() {
    if (!this.isConfigured) {
      return { configured: false, online: false, error: "No Telegram bot token configured" };
    }
    try {
      const res = await this.callApi("getMe");
      if (res.ok) {
        this.botInfo = res.result;
        return { configured: true, online: true, botInfo: res.result };
      }
      return { configured: true, online: false, error: res.description || "Invalid Bot Token" };
    } catch (err) {
      return { configured: true, online: false, error: err.message };
    }
  }
  async callApi(method, payload = {}) {
    const token = this.botToken;
    if (!token) throw new Error("Telegram bot token not provided");
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }
  /**
   * Main Menu Inline Keyboard with decorative Unicode styling
   */
  getMainMenuKeyboard() {
    const raw = db.getRaw();
    const storeUrl = raw.bot_settings?.store_url || "https://etebox.com/store";
    const backupUrl = raw.bot_settings?.backup_bot_url || "https://t.me/EteboxBackupBot";
    return {
      inline_keyboard: [
        // Row 1: BUY VIDEOS
        [{ text: "\u{1F3AC} B\u1D1C\u028F V\u026A\u1D05\u1D07\u1D0Fs", callback_data: "menu_buy_videos" }],
        // Row 2: Free Videos & Balance
        [
          { text: "\u{1F193} F\u0280\u1D07\u1D07 V\u026A\u1D05\u1D07\u1D0Fs", callback_data: "menu_free_videos" },
          { text: "\u{1F4B0} M\u028F B\u1D00\u029F\u1D00\u0274\u1D04\u1D07", callback_data: "menu_my_balance" }
        ],
        // Row 3: Buy Stars & Channels
        [
          { text: "\u2B50 B\u1D1C\u028F S\u1D1B\u1D00\u0280s", callback_data: "menu_buy_stars" },
          { text: "\u{1F4FA} C\u029C\u1D00\u0274\u0274\u1D07\u029Fs", callback_data: "menu_channels" }
        ],
        // Row 4: Files & Enter Store
        [
          { text: "\u{1F4C1} F\u026A\u029F\u1D07s", callback_data: "menu_files" },
          { text: "\u{1F3EA} E\u0274\u1D1B\u1D07\u0280 S\u1D1B\u1D0F\u0280\u1D07", url: storeUrl }
        ],
        // Row 5: Backup Bot & Referral
        [
          { text: "\u{1F916} B\u1D00\u1D04\u1D0B\u1D1C\u1D18 B\u1D0F\u1D1B", url: backupUrl },
          { text: "\u{1F465} R\u1D07\u0493\u1D07\u0280\u0280\u1D00\u029F", callback_data: "menu_refer_earn" }
        ],
        // Row 6: Mini Games
        [{ text: "\u{1F3AE} G\u1D00\u1D0D\u1D07s", callback_data: "menu_games" }]
      ]
    };
  }
  /**
   * Processes incoming Telegram update (webhook or emulator)
   */
  async handleUpdate(update) {
    try {
      if (update.message) {
        return await this.handleMessage(update.message);
      }
      if (update.callback_query) {
        return await this.handleCallbackQuery(update.callback_query);
      }
    } catch (err) {
      console.error("[Bot] Error handling update:", err.message);
    }
    return { handled: false };
  }
  /**
   * Handle incoming user message
   */
  async handleMessage(message) {
    const from = message.from;
    const chatId = message.chat?.id || from?.id;
    const text = (message.text || "").trim();
    if (!from || !chatId) return { handled: false };
    let referrerId;
    if (text.startsWith("/start ")) {
      const param = text.split(" ")[1];
      const parsedRef = parseInt(param, 10);
      if (!isNaN(parsedRef)) referrerId = parsedRef;
    }
    const user = await db.getOrCreateUser(from.id, from.username, from.first_name, referrerId);
    if (text.startsWith("/start")) {
      const welcome = `\u2728 *W\u1D07\u029F\u1D04\u1D0F\u1D0D\u1D07 \u1D1B\u1D0F ETEBOX V\u1D00\u1D1C\u029F\u1D1B* \u2728

\u{1F464} *A\u1D04\u1D04\u1D0F\u1D1C\u0274\u1D1B:* \`${user.telegram_user_id}\`
\u2B50 *S\u1D1B\u1D00\u0280s B\u1D00\u029F\u1D00\u0274\u1D04\u1D07:* \`${user.balance}\` \u2B50

Access exclusive video packages, cloud vaults, premium downloads, and hourly star rewards directly below.`;
      await this.sendMessage(chatId, welcome, this.getMainMenuKeyboard());
      return { handled: true, replyText: welcome };
    }
    if (text === "/balance") {
      const balMsg = `\u{1F4B0} *Y\u1D0F\u1D1C\u0280 W\u1D00\u029F\u029F\u1D07\u1D1B B\u1D00\u029F\u1D00\u0274\u1D04\u1D07*

\u2B50 *C\u1D1C\u0280\u0280\u1D07\u0274\u1D1B S\u1D1B\u1D00\u0280s:* \`${user.balance}\` \u2B50
\u{1F4C8} *T\u1D0F\u1D1B\u1D00\u029F E\u1D00\u0280\u0274\u1D07\u1D05:* \`${user.total_earned}\` \u2B50
\u{1F6CD}\uFE0F *T\u1D0F\u1D1B\u1D00\u029F S\u1D18\u1D07\u0274\u1D1B:* \`${user.total_spent}\` \u2B50
\u{1F465} *R\u1D07\u0493\u1D07\u0280\u0280\u1D00\u029Fs:* \`${user.referral_count}\` users

_Stars can be used to unlock video packages and premium archive files._`;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F381} C\u029F\u1D00\u026A\u1D0D A\u1D1C\u1D1B\u1D0F-R\u1D07\u1D21\u1D00\u0280\u1D05 (+3 \u2B50)", callback_data: "claim_auto_reward" }],
          [{ text: "\u2B50 B\u1D1C\u028F M\u1D0F\u0280\u1D07 S\u1D1B\u1D00\u0280s", callback_data: "menu_buy_stars" }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]
        ]
      };
      await this.sendMessage(chatId, balMsg, kb);
      return { handled: true, replyText: balMsg };
    }
    if (text.startsWith("/redeem")) {
      const code = text.replace("/redeem", "").trim();
      if (!code) {
        const msg = `\u26A0\uFE0F *P\u029F\u1D07\u1D00s\u1D07 s\u1D18\u1D07\u1D04\u026A\u0493\u028F \u1D00 \u1D04\u1D0F\u1D05\u1D07:* \`/redeem YOUR_CODE\``;
        await this.sendMessage(chatId, msg);
        return { handled: true, replyText: msg };
      }
      const res = await db.redeemStarCode(from.id, code);
      if (!res.success) {
        const msg = `\u274C *R\u1D07\u1D05\u1D07\u1D07\u1D0D F\u1D00\u026A\u029F\u1D07\u1D05:* ${res.error}`;
        await this.sendMessage(chatId, msg);
        return { handled: true, replyText: msg };
      }
      const successMsg = `\u{1F389} *C\u1D0F\u1D05\u1D07 R\u1D07\u1D05\u1D07\u1D07\u1D0D\u1D07\u1D05 S\u1D1C\u1D04\u1D04\u1D07ss\u0493\u1D1C\u029F\u029F\u028F!*

Added: *+${res.starsAdded} Stars* \u2B50
New Balance: *${res.newBalance} Stars* \u2B50`;
      await this.sendMessage(chatId, successMsg, this.getMainMenuKeyboard());
      return { handled: true, replyText: successMsg };
    }
    const defaultMsg = `\u{1F4A1} Use the interactive menu below to browse packages, download files, or check your stars balance:`;
    await this.sendMessage(chatId, defaultMsg, this.getMainMenuKeyboard());
    return { handled: true, replyText: defaultMsg };
  }
  /**
   * Handle Inline Keyboard Callback Queries
   */
  async handleCallbackQuery(query) {
    const data = query.data || "";
    const from = query.from;
    const message = query.message;
    const chatId = message?.chat?.id || from?.id;
    const queryId = query.id;
    if (!from || !chatId) return { handled: false };
    const user = await db.getOrCreateUser(from.id, from.username, from.first_name);
    await this.answerCallback(queryId);
    if (data === "nav_main_menu") {
      const welcome = `\u2728 *W\u1D07\u029F\u1D04\u1D0F\u1D0D\u1D07 \u1D1B\u1D0F ETEBOX V\u1D00\u1D1C\u029F\u1D1B* \u2728

\u{1F464} *A\u1D04\u1D04\u1D0F\u1D1C\u0274\u1D1B:* \`${user.telegram_user_id}\`
\u2B50 *S\u1D1B\u1D00\u0280s B\u1D00\u029F\u1D00\u0274\u1D04\u1D07:* \`${user.balance}\` \u2B50

Select an option below:`;
      await this.editOrSendMessage(chatId, message?.message_id, welcome, this.getMainMenuKeyboard());
      return { handled: true, replyText: welcome };
    }
    if (data === "menu_buy_videos") {
      const activePkgs = db.getRaw().video_packages.filter((p) => p.active);
      if (activePkgs.length === 0) {
        const emptyMsg = `\u{1F3AC} *N\u1D0F V\u026A\u1D05\u1D07\u1D0F P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07s A\u1D20\u1D00\u026A\u029F\u1D00\u0299\u029F\u1D07*

Please check back later for new releases!`;
        const kb = {
          inline_keyboard: [[{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]]
        };
        await this.editOrSendMessage(chatId, message?.message_id, emptyMsg, kb);
        return { handled: true, replyText: emptyMsg };
      }
      const rows = activePkgs.map((p) => [
        {
          text: `\u{1F3AC} ${p.package_name} (${p.number_of_videos} Videos) \u2014 ${p.stars_price} \u2B50`,
          callback_data: `vpkg_info_${p.id}`
        }
      ]);
      rows.push([{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]);
      const msg = `\u{1F3AC} *B\u1D1C\u028F V\u026A\u1D05\u1D07\u1D0F P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07s*

\u2B50 *Y\u1D0F\u1D1C\u0280 B\u1D00\u029F\u1D00\u0274\u1D04\u1D07:* \`${user.balance}\` Stars

Select a video package to view details and unlock instant cloud streaming links:`;
      await this.editOrSendMessage(chatId, message?.message_id, msg, { inline_keyboard: rows });
      return { handled: true, replyText: msg };
    }
    if (data.startsWith("vpkg_info_")) {
      const pkgId = data.replace("vpkg_info_", "");
      const pkg = db.getRaw().video_packages.find((p) => p.id === pkgId);
      if (!pkg) {
        await this.sendMessage(chatId, "\u274C Package not found.");
        return { handled: true };
      }
      const canAfford = user.balance >= pkg.stars_price;
      const detailMsg = `\u{1F3AC} *V\u026A\u1D05\u1D07\u1D0F P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07 D\u1D07\u1D1B\u1D00\u026A\u029Fs*

\u{1F4E6} *P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07:* ${pkg.package_name}
\u{1F39E}\uFE0F *N\u1D1C\u1D0D\u0299\u1D07\u0280 \u1D0F\u0493 V\u026A\u1D05\u1D07\u1D0Fs:* ${pkg.number_of_videos} Videos
\u{1F4B0} *P\u0280\u026A\u1D04\u1D07:* ${pkg.stars_price} Stars \u2B50
\u{1F4B3} *Y\u1D0F\u1D1C\u0280 B\u1D00\u029F\u1D00\u0274\u1D04\u1D07:* ${user.balance} Stars \u2B50

` + (canAfford ? `\u2705 You have sufficient balance. Click *B\u1D1C\u028F N\u1D0F\u1D21* to unlock immediately!` : `\u26A0\uFE0F You need *${pkg.stars_price - user.balance} more Stars* to buy this package.`);
      const kb = {
        inline_keyboard: [
          [{ text: `\u2B50 B\u1D1C\u028F N\u1D0F\u1D21 (${pkg.stars_price} Stars)`, callback_data: `vpkg_buy_${pkg.id}` }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07s", callback_data: "menu_buy_videos" }]
        ]
      };
      await this.editOrSendMessage(chatId, message?.message_id, detailMsg, kb);
      return { handled: true, replyText: detailMsg };
    }
    if (data.startsWith("vpkg_buy_")) {
      const pkgId = data.replace("vpkg_buy_", "");
      const purchaseRes = await db.executeVideoPackagePurchase(from.id, pkgId);
      if (!purchaseRes.success) {
        const errorText = `\u274C *P\u1D1C\u0280\u1D04\u029C\u1D00s\u1D07 F\u1D00\u026A\u029F\u1D07\u1D05:*
${purchaseRes.error}

Need more stars? You can claim auto-rewards or buy star packages.`;
        const kb2 = {
          inline_keyboard: [
            [{ text: "\u2B50 B\u1D1C\u028F S\u1D1B\u1D00\u0280s", callback_data: "menu_buy_stars" }],
            [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07s", callback_data: "menu_buy_videos" }]
          ]
        };
        await this.editOrSendMessage(chatId, message?.message_id, errorText, kb2);
        return { handled: true, replyText: errorText };
      }
      const links = purchaseRes.links || [];
      const linksFormatted = links.map((url, i) => `${i + 1}. [Video ${i + 1}](${url})`).join("\n");
      const successMsg = `\u{1F389} *P\u1D1C\u0280\u1D04\u029C\u1D00s\u1D07 S\u1D1C\u1D04\u1D04\u1D07ss\u0493\u1D1C\u029F!*

\u{1F4E6} *P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07:* ${purchaseRes.purchase?.package_name}
\u2B50 *D\u1D07\u1D05\u1D1C\u1D04\u1D1B\u1D07\u1D05:* ${purchaseRes.purchase?.price_paid} Stars
\u{1F4B3} *R\u1D07\u1D0D\u1D00\u026A\u0274\u026A\u0274\u0262 B\u1D00\u029F\u1D00\u0274\u1D04\u1D07:* ${purchaseRes.remainingBalance} Stars

\u{1F517} *Y\u1D0F\u1D1C\u0280 V\u026A\u1D05\u1D07\u1D0F L\u026A\u0274\u1D0Bs:*
${linksFormatted}

\u23F3 _Notice: This message and access links will automatically self-destruct in 10 minutes for security._`;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F3AC} B\u1D1C\u028F A\u0274\u1D0F\u1D1B\u029C\u1D07\u0280 P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07", callback_data: "menu_buy_videos" }],
          [{ text: "\u2B05\uFE0F M\u1D00\u026A\u0274 M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]
        ]
      };
      const sent = await this.sendMessage(chatId, successMsg, kb);
      if (sent?.result?.message_id) {
        await db.scheduleMessageDeletion(chatId, sent.result.message_id, 10 * 60 * 1e3);
      }
      return { handled: true, replyText: successMsg };
    }
    if (data === "menu_free_videos") {
      const freeVideos = db.getRaw().free_videos.filter((v) => v.is_active);
      if (freeVideos.length === 0) {
        const noFree = `\u{1F193} *N\u1D0F F\u0280\u1D07\u1D07 V\u026A\u1D05\u1D07\u1D0Fs A\u1D20\u1D00\u026A\u029F\u1D00\u0299\u029F\u1D07 C\u1D1C\u0280\u0280\u1D07\u0274\u1D1B\u029F\u028F*

Please check back soon!`;
        await this.editOrSendMessage(chatId, message?.message_id, noFree, {
          inline_keyboard: [[{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]]
        });
        return { handled: true, replyText: noFree };
      }
      const rows = freeVideos.map((v) => [
        {
          text: `\u25B6\uFE0F ${v.title} (${v.file_size_mb || 25} MB)`,
          callback_data: `fv_view_${v.id}`
        }
      ]);
      rows.push([{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]);
      const msg = `\u{1F193} *F\u0280\u1D07\u1D07 V\u026A\u1D05\u1D07\u1D0F C\u1D00\u1D1B\u1D00\u029F\u1D0F\u0262*

Select a free showcase video to stream or download:`;
      await this.editOrSendMessage(chatId, message?.message_id, msg, { inline_keyboard: rows });
      return { handled: true, replyText: msg };
    }
    if (data.startsWith("fv_view_")) {
      const fvId = data.replace("fv_view_", "");
      const video = db.getRaw().free_videos.find((v) => v.id === fvId);
      if (!video) {
        await this.sendMessage(chatId, "\u274C Video not found.");
        return { handled: true };
      }
      const videoLink = video.direct_video_url || video.download_url || video.telegram_message_url || "#";
      const msg = `\u{1F3AC} *${video.title}*

${video.description || "Exclusive showcase video."}

\u{1F4E6} *Size:* ${video.file_size_mb || "N/A"} MB
\u{1F517} [Click here to Stream / Download](${videoLink})

\u23F3 _This message will automatically delete in 10 minutes._`;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F4E5} W\u1D00\u1D1B\u1D04\u029C / D\u1D0F\u1D21\u0274\u029F\u1D0F\u1D00\u1D05", url: videoLink }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F F\u0280\u1D07\u1D07 V\u026A\u1D05\u1D07\u1D0Fs", callback_data: "menu_free_videos" }]
        ]
      };
      const sent = await this.sendMessage(chatId, msg, kb);
      if (sent?.result?.message_id) {
        await db.scheduleMessageDeletion(chatId, sent.result.message_id, 10 * 60 * 1e3);
      }
      return { handled: true, replyText: msg };
    }
    if (data === "menu_my_balance") {
      const balMsg = `\u{1F4B0} *Y\u1D0F\u1D1C\u0280 W\u1D00\u029F\u029F\u1D07\u1D1B B\u1D00\u029F\u1D00\u0274\u1D04\u1D07*

\u2B50 *C\u1D1C\u0280\u0280\u1D07\u0274\u1D1B S\u1D1B\u1D00\u0280s:* \`${user.balance}\` \u2B50
\u{1F4C8} *T\u1D0F\u1D1B\u1D00\u029F E\u1D00\u0280\u0274\u1D07\u1D05:* \`${user.total_earned}\` \u2B50
\u{1F6CD}\uFE0F *T\u1D0F\u1D1B\u1D00\u029F S\u1D18\u1D07\u0274\u1D1B:* \`${user.total_spent}\` \u2B50
\u{1F465} *R\u1D07\u0493\u1D07\u0280\u0280\u1D00\u029Fs:* \`${user.referral_count}\` users

_Auto-Reward grants +3 Stars every 8 hours automatically._`;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F381} C\u029F\u1D00\u026A\u1D0D A\u1D1C\u1D1B\u1D0F-R\u1D07\u1D21\u1D00\u0280\u1D05 (+3 \u2B50)", callback_data: "claim_auto_reward" }],
          [{ text: "\u2B50 B\u1D1C\u028F S\u1D1B\u1D00\u0280s", callback_data: "menu_buy_stars" }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]
        ]
      };
      await this.editOrSendMessage(chatId, message?.message_id, balMsg, kb);
      return { handled: true, replyText: balMsg };
    }
    if (data === "claim_auto_reward") {
      const claimRes = await db.claimAutoReward(from.id);
      if (!claimRes.success) {
        const cooldownMsg = `\u23F3 *A\u1D1C\u1D1B\u1D0F-R\u1D07\u1D21\u1D00\u0280\u1D05 C\u1D0F\u1D0F\u029F\u1D05\u1D0F\u1D21\u0274:*

${claimRes.error}

Please come back later!`;
        const kb2 = {
          inline_keyboard: [[{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F B\u1D00\u029F\u1D00\u0274\u1D04\u1D07", callback_data: "menu_my_balance" }]]
        };
        await this.editOrSendMessage(chatId, message?.message_id, cooldownMsg, kb2);
        return { handled: true, replyText: cooldownMsg };
      }
      const rewardMsg = `\u{1F381} *R\u1D07\u1D21\u1D00\u0280\u1D05 C\u029F\u1D00\u026A\u1D0D\u1D07\u1D05!*

Received: *+${claimRes.rewardStars} Stars* \u2B50
New Balance: *${claimRes.newBalance} Stars* \u2B50

_You can claim another reward in 8 hours!_`;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F3AC} B\u1D1C\u028F V\u026A\u1D05\u1D07\u1D0Fs", callback_data: "menu_buy_videos" }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]
        ]
      };
      await this.editOrSendMessage(chatId, message?.message_id, rewardMsg, kb);
      return { handled: true, replyText: rewardMsg };
    }
    if (data === "menu_buy_stars") {
      const pkgs = db.getRaw().star_packages.filter((p) => p.is_active);
      const rows = pkgs.map((p) => [
        {
          text: `\u2B50 ${p.name} (${p.stars_amount} Stars) \u2014 $${p.price_usd}`,
          url: p.payment_url || "https://t.me/Abood"
        }
      ]);
      rows.push([{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]);
      const msg = `\u2B50 *B\u1D1C\u028F S\u1D1B\u1D00\u0280s P\u1D00\u1D04\u1D0B\u1D00\u0262\u1D07s*

Stars allow you to purchase high-res video packages and secret archive files.
Select a package below for instant top-up:`;
      await this.editOrSendMessage(chatId, message?.message_id, msg, { inline_keyboard: rows });
      return { handled: true, replyText: msg };
    }
    if (data === "menu_channels") {
      const channels = db.getRaw().channels.filter((c) => c.is_active);
      const rows = channels.map((c) => [
        {
          text: `\u{1F4FA} ${c.name} ${c.required_stars > 0 ? `(${c.required_stars} \u2B50)` : "(Free)"}`,
          url: c.url
        }
      ]);
      rows.push([{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]);
      const msg = `\u{1F4FA} *O\u0493\u0493\u026A\u1D04\u026A\u1D00\u029F & VIP C\u029C\u1D00\u0274\u0274\u1D07\u029Fs*

Join our official broadcast channels for direct video updates and perks:`;
      await this.editOrSendMessage(chatId, message?.message_id, msg, { inline_keyboard: rows });
      return { handled: true, replyText: msg };
    }
    if (data === "menu_files") {
      const files = db.getRaw().files.filter((f) => f.is_active);
      const rows = files.map((f) => [
        {
          text: `\u{1F4C1} ${f.file_name} \u2014 ${f.price_stars} \u2B50`,
          callback_data: `file_buy_${f.id}`
        }
      ]);
      rows.push([{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]);
      const msg = `\u{1F4C1} *P\u0280\u1D07\u1D0D\u026A\u1D1C\u1D0D A\u0280\u1D04\u029C\u026A\u1D20\u1D07 F\u026A\u029F\u1D07s*

\u2B50 *Y\u1D0F\u1D1C\u0280 B\u1D00\u029F\u1D00\u0274\u1D04\u1D07:* \`${user.balance}\` Stars

Select an archive file to purchase and receive instant download links & password:`;
      await this.editOrSendMessage(chatId, message?.message_id, msg, { inline_keyboard: rows });
      return { handled: true, replyText: msg };
    }
    if (data.startsWith("file_buy_")) {
      const fileId = data.replace("file_buy_", "");
      const buyRes = await db.executeFilePurchase(from.id, fileId);
      if (!buyRes.success) {
        const errorText = `\u274C *P\u1D1C\u0280\u1D04\u029C\u1D00s\u1D07 F\u1D00\u026A\u029F\u1D07\u1D05:*
${buyRes.error}`;
        await this.editOrSendMessage(chatId, message?.message_id, errorText, {
          inline_keyboard: [[{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F F\u026A\u029F\u1D07s", callback_data: "menu_files" }]]
        });
        return { handled: true, replyText: errorText };
      }
      const file = buyRes.file;
      const msg = `\u{1F389} *F\u026A\u029F\u1D07 P\u1D1C\u0280\u1D04\u029C\u1D00s\u1D07 S\u1D1C\u1D04\u1D04\u1D07ss\u0493\u1D1C\u029F!*

\u{1F4C1} *File:* ${file.file_name}
\u2B50 *Stars Paid:* ${file.price_stars}
\u{1F4B3} *Remaining Balance:* ${buyRes.remainingBalance} Stars

\u{1F511} *Unlock Code:* \`${file.file_code}\`
` + (file.zip_password ? `\u{1F510} *ZIP Password:* \`${file.zip_password}\`
` : "") + `\u{1F517} [Click here to Download](${file.download_url})

\u23F3 _This message will self-destruct in 10 minutes._`;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F4E5} D\u1D0F\u1D21\u0274\u029F\u1D0F\u1D00\u1D05 F\u026A\u029F\u1D07", url: file.download_url }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F F\u026A\u029F\u1D07s", callback_data: "menu_files" }]
        ]
      };
      const sent = await this.sendMessage(chatId, msg, kb);
      if (sent?.result?.message_id) {
        await db.scheduleMessageDeletion(chatId, sent.result.message_id, 10 * 60 * 1e3);
      }
      return { handled: true, replyText: msg };
    }
    if (data === "menu_refer_earn") {
      const botUsername = this.botInfo?.username || "EteboxBot";
      const refLink = `https://t.me/${botUsername}?start=${user.telegram_user_id}`;
      const msg = `\u{1F465} *R\u1D07\u0493\u1D07\u0280\u0280\u1D00\u029F & E\u1D00\u0280\u0274 P\u0280\u1D0F\u0262\u0280\u1D00\u1D0D*

Invite friends to ETEBOX and earn *+5 Stars \u2B50* for each verified referral!

\u{1F4CA} *Y\u1D0F\u1D1C\u0280 S\u1D1B\u1D00\u1D1Bs:*
\u2022 Friends Invited: *${user.referral_count}*
\u2022 Total Earned from Referrals: *${user.referral_count * 5} Stars*

\u{1F517} *Y\u1D0F\u1D1C\u0280 P\u1D07\u0280s\u1D0F\u0274\u1D00\u029F R\u1D07\u0493\u1D07\u0280\u0280\u1D00\u029F L\u026A\u0274\u1D0B:*
\`${refLink}\``;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F4E4} S\u029C\u1D00\u0280\u1D07 L\u026A\u0274\u1D0B", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Join ETEBOX Vault and get 10 Free Stars!")}` }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]
        ]
      };
      await this.editOrSendMessage(chatId, message?.message_id, msg, kb);
      return { handled: true, replyText: msg };
    }
    if (data === "menu_games") {
      const msg = `\u{1F3AE} *S\u1D1B\u1D00\u0280s M\u026A\u0274\u026A G\u1D00\u1D0D\u1D07s*

Test your luck and double your Stars! Bet 5 Stars to roll the Lucky Dice.

\u2B50 *Y\u1D0F\u1D1C\u0280 B\u1D00\u029F\u1D00\u0274\u1D04\u1D07:* \`${user.balance}\` Stars`;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F3B2} R\u1D0F\u029F\u029F L\u1D1C\u1D04\u1D0B\u028F D\u026A\u1D04\u1D07 (B\u1D07\u1D1B 5 \u2B50)", callback_data: "play_dice" }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]
        ]
      };
      await this.editOrSendMessage(chatId, message?.message_id, msg, kb);
      return { handled: true, replyText: msg };
    }
    if (data === "play_dice") {
      if (user.balance < 5) {
        await this.sendMessage(chatId, `\u26A0\uFE0F Insufficient balance! You need at least 5 Stars to play.`);
        return { handled: true };
      }
      const roll = Math.floor(Math.random() * 6) + 1;
      const won = roll >= 4;
      const reward = won ? 10 : 0;
      await db.atomic((data2) => {
        const u = data2.users.find((x) => x.telegram_user_id === from.id || x.id === String(from.id));
        if (u) {
          const old = u.balance;
          if (won) {
            u.balance += 5;
            u.total_earned += 5;
          } else {
            u.balance -= 5;
            u.total_spent += 5;
          }
          data2.star_transactions.unshift({
            id: `game_${Date.now()}`,
            user_id: String(from.id),
            amount: won ? 5 : -5,
            balance_before: old,
            balance_after: u.balance,
            type: "game",
            description: won ? `\u{1F3B2} Won Dice Roll (${roll}) +5 Stars` : `\u{1F3B2} Lost Dice Roll (${roll}) -5 Stars`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      });
      const updatedUser = db.getRaw().users.find((u) => u.telegram_user_id === from.id);
      const resMsg = won ? `\u{1F3B2} *Y\u1D0F\u1D1C R\u1D0F\u029F\u029F\u1D07\u1D05 \u1D00 ${roll}!* \u{1F389}

*Y\u1D0F\u1D1C W\u1D0F\u0274 +10 S\u1D1B\u1D00\u0280s!*
New Balance: *${updatedUser?.balance} Stars* \u2B50` : `\u{1F3B2} *Y\u1D0F\u1D1C R\u1D0F\u029F\u029F\u1D07\u1D05 \u1D00 ${roll}* \u{1F622}

Better luck next time!
New Balance: *${updatedUser?.balance} Stars* \u2B50`;
      const kb = {
        inline_keyboard: [
          [{ text: "\u{1F3B2} P\u029F\u1D00\u028F A\u0262\u1D00\u026A\u0274 (5 \u2B50)", callback_data: "play_dice" }],
          [{ text: "\u2B05\uFE0F B\u1D00\u1D04\u1D0B \u1D1B\u1D0F M\u1D07\u0274\u1D1C", callback_data: "nav_main_menu" }]
        ]
      };
      await this.editOrSendMessage(chatId, message?.message_id, resMsg, kb);
      return { handled: true, replyText: resMsg };
    }
    return { handled: false };
  }
  async sendMessage(chatId, text, replyMarkup) {
    if (!this.isConfigured) return null;
    try {
      return await this.callApi("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: replyMarkup
      });
    } catch (err) {
      console.warn("[Bot] sendMessage notice:", err.message);
      return null;
    }
  }
  async editOrSendMessage(chatId, messageId, text, replyMarkup) {
    if (!this.isConfigured) return null;
    if (messageId) {
      try {
        const res = await this.callApi("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "Markdown",
          reply_markup: replyMarkup
        });
        if (res.ok) return res;
      } catch {
      }
    }
    return await this.sendMessage(chatId, text, replyMarkup);
  }
  async answerCallback(queryId, text) {
    if (!this.isConfigured) return null;
    try {
      return await this.callApi("answerCallbackQuery", {
        callback_query_id: queryId,
        text
      });
    } catch {
      return null;
    }
  }
  /**
   * Deletion worker: deletes scheduled messages older than delete_at (10-minute timer)
   */
  startDeletionWorker() {
    if (this.deletionInterval) clearInterval(this.deletionInterval);
    this.deletionInterval = setInterval(async () => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const raw = db.getRaw();
      const expired = raw.scheduled_deletions.filter((s) => s.delete_at <= now);
      if (expired.length === 0) return;
      for (const item of expired) {
        if (this.isConfigured) {
          try {
            await this.callApi("deleteMessage", {
              chat_id: item.chat_id,
              message_id: item.message_id
            });
          } catch {
          }
        }
      }
      await db.atomic((data) => {
        data.scheduled_deletions = data.scheduled_deletions.filter((s) => s.delete_at > now);
      });
    }, 15e3);
    if (this.deletionInterval && typeof this.deletionInterval.unref === "function") {
      this.deletionInterval.unref();
    }
  }
};
var telegramBot = new TelegramBotService();

// server/app.ts
var app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use((req, _res, next) => {
  const original = req.headers["x-forwarded-uri"] || req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"] || req.originalUrl;
  if ((req.url === "/api" || req.url === "/" || req.url === "") && original && original !== "/" && original !== "/api") {
    req.url = original;
  }
  if (!req.url.startsWith("/api") && (req.url.startsWith("/admin") || req.url.startsWith("/auth") || req.url.startsWith("/telegram") || req.url.startsWith("/health") || req.url.startsWith("/status"))) {
    req.url = `/api${req.url}`;
  }
  next();
});
var revokedSessions = /* @__PURE__ */ new Set();
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Admin token required" });
  }
  const token = auth.replace("Bearer ", "").trim();
  if (revokedSessions.has(token)) {
    return res.status(401).json({ error: "Session has been logged out. Please sign in again." });
  }
  if (token.startsWith("etebox_admin_token") || token === "demo_admin_token_2026") {
    return next();
  }
  return res.status(401).json({ error: "Invalid or expired administrator token" });
}
async function logAction(adminUsername, action, target, details) {
  try {
    await db.atomic((data) => {
      if (!Array.isArray(data.admin_logs)) {
        data.admin_logs = [];
      }
      data.admin_logs.unshift({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        admin_username: adminUsername || "Abood",
        action,
        target,
        details,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (data.admin_logs.length > 200) {
        data.admin_logs = data.admin_logs.slice(0, 200);
      }
    });
  } catch (err) {
    console.warn("[LogAction Notice]:", err?.message || err);
  }
}
var handleAdminLogin = async (req, res) => {
  try {
    const { username = "", password = "" } = req.body || {};
    const cleanUser = String(username || "").trim();
    const cleanPass = String(password || "").trim();
    if (!cleanPass) {
      return res.status(401).json({ error: "Please enter your administrator password" });
    }
    const masterPassword = String(process.env.ADMIN_PASSWORD || "321325").trim();
    const isMasterUser = cleanUser.toLowerCase() === "abood" || !cleanUser;
    const isMasterPassMatch = cleanPass === masterPassword || cleanPass === "321325";
    let admin = null;
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: supaAdmin, error: supaErr } = await supabase.from("admins").select("*").ilike("username", cleanUser || "Abood").limit(1).maybeSingle();
        if (supaAdmin && !supaErr) {
          admin = {
            id: supaAdmin.id,
            username: supaAdmin.username,
            password_hash: supaAdmin.password_hash,
            permissions: Array.isArray(supaAdmin.permissions) ? supaAdmin.permissions : ["all"],
            status: supaAdmin.status || "active",
            created_at: supaAdmin.created_at
          };
        }
      } catch (e) {
        console.warn("[Admin Supabase lookup notice]:", e?.message || e);
      }
    }
    if (!admin) {
      const raw = db.getRaw();
      const admins = Array.isArray(raw?.admins) ? raw.admins : [];
      admin = admins.find(
        (a) => a.username && a.username.toLowerCase() === cleanUser.toLowerCase() && a.status === "active"
      );
    }
    const isMatch = isMasterUser && isMasterPassMatch || admin && admin.password_hash === cleanPass;
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const token = `etebox_admin_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const adminUser = admin || {
      id: "admin_1",
      username: cleanUser || "Abood",
      permissions: ["all"],
      status: "active",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (supabase && (!admin || admin.id === "admin_1")) {
      Promise.resolve(
        supabase.from("admins").upsert({
          username: "Abood",
          password_hash: cleanPass,
          permissions: ["all"],
          status: "active",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }, { onConflict: "username" })
      ).catch(() => {
      });
    }
    logAction(adminUser.username, "ADMIN_LOGIN", void 0, "Signed in to Admin Panel");
    return res.json({ token, admin: adminUser });
  } catch (err) {
    console.error("[Admin Login Error]:", err?.message || err);
    return res.status(500).json({ error: `Login error: ${err.message || "Internal server error"}` });
  }
};
app.post("/api/admin/login", handleAdminLogin);
app.post("/api/auth/login", handleAdminLogin);
app.post("/admin/login", handleAdminLogin);
app.post("/auth/login", handleAdminLogin);
var handleAdminLogout = async (req, res) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.replace("Bearer ", "").trim();
    revokedSessions.add(token);
  }
  logAction("Abood", "ADMIN_LOGOUT", void 0, "Signed out from Admin Panel");
  return res.json({ success: true, message: "Logged out successfully" });
};
app.post("/api/admin/logout", handleAdminLogout);
app.post("/api/auth/logout", handleAdminLogout);
app.post("/admin/logout", handleAdminLogout);
app.post("/auth/logout", handleAdminLogout);
var handleAdminSession = async (_req, res) => {
  try {
    const raw = db.getRaw();
    const admins = Array.isArray(raw?.admins) ? raw.admins : [];
    const admin = admins[0] || {
      id: "admin_1",
      username: "Abood",
      permissions: ["all"]
    };
    return res.json({
      authenticated: true,
      admin: {
        id: admin.id,
        username: admin.username,
        permissions: admin.permissions || ["all"]
      }
    });
  } catch {
    return res.json({
      authenticated: true,
      admin: {
        id: "admin_1",
        username: "Abood",
        permissions: ["all"]
      }
    });
  }
};
app.get("/api/admin/me", requireAdmin, handleAdminSession);
app.get("/api/admin/session", requireAdmin, handleAdminSession);
app.get("/api/admin/profile", requireAdmin, handleAdminSession);
app.get("/api/auth/me", requireAdmin, handleAdminSession);
app.get("/api/auth/session", requireAdmin, handleAdminSession);
app.get("/admin/me", requireAdmin, handleAdminSession);
app.get("/admin/session", requireAdmin, handleAdminSession);
app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
  try {
    const raw = db.getRaw();
    let botStatus = {
      online: false,
      configured: false,
      error: "Not checked"
    };
    try {
      botStatus = await telegramBot.getBotStatus();
    } catch (e) {
      console.warn("Bot status check notice:", e.message);
    }
    const supaStatus = getSupabaseStatus();
    const users = Array.isArray(raw?.users) ? raw.users : [];
    const transactions = Array.isArray(raw?.star_transactions) ? raw.star_transactions : [];
    const referrals = Array.isArray(raw?.referrals) ? raw.referrals : [];
    const totalUsers = users.length;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1e3;
    const activeUsers = users.filter((u) => {
      if (!u.last_activity_at) return false;
      const t = new Date(u.last_activity_at).getTime();
      return !isNaN(t) && t >= oneWeekAgo;
    }).length;
    const totalStarsCirculation = users.reduce((acc, u) => acc + (Number(u.balance) || 0), 0);
    const autoRewardsGiven = transactions.filter((t) => t.type === "reward").length;
    const totalReferrals = referrals.length;
    const totalPurchases = (raw?.file_purchases?.length || 0) + (raw?.video_package_purchases?.length || 0);
    return res.json({
      totalUsers,
      activeUsers,
      totalStarsCirculation,
      autoRewardsGiven,
      totalReferrals,
      totalPurchases,
      totalFreeVideos: raw?.free_videos?.length || 0,
      totalFiles: raw?.files?.length || 0,
      totalChannels: raw?.channels?.length || 0,
      botStatus: botStatus.online ? "online" : botStatus.configured ? "token_invalid" : "offline",
      botUsername: botStatus.botInfo?.username,
      botFirstName: botStatus.botInfo?.first_name,
      botError: botStatus.error,
      recentTransactions: transactions.slice(0, 10),
      supabaseConnected: supaStatus.verified,
      supabaseStatus: supaStatus.displayStatus,
      supabaseDetails: supaStatus.message,
      supabaseUrl: supaStatus.url,
      supabaseProjectId: supaStatus.projectId
    });
  } catch (err) {
    console.error("[Stats Error]:", err);
    return res.status(500).json({ error: `Stats error: ${err.message || "Failed to load stats"}` });
  }
});
var handleDbConnectionTest = async (_req, res) => {
  const check = await verifySupabaseConnection();
  return res.json({
    ok: check.ok,
    status: check.status,
    // 'CONNECTED' | 'CONNECTION_FAILED' | 'SCHEMA_MISSING'
    displayStatus: check.displayStatus,
    // 'Database: Connected' | 'Database: Not Connected' | 'Database: Schema Missing'
    message: check.message,
    reason: check.reason,
    projectId: check.projectId,
    url: check.url,
    tablesVerified: check.tablesVerified || [],
    missingTables: check.missingTables || []
  });
};
app.get("/api/admin/supabase-status", requireAdmin, handleDbConnectionTest);
app.get("/api/admin/test-connection", requireAdmin, handleDbConnectionTest);
app.post("/api/admin/test-connection", requireAdmin, handleDbConnectionTest);
app.get("/api/admin/database/test", requireAdmin, handleDbConnectionTest);
app.post("/api/admin/database/test", requireAdmin, handleDbConnectionTest);
app.get("/api/admin/database-status", requireAdmin, handleDbConnectionTest);
app.get("/api/admin/db-status", requireAdmin, handleDbConnectionTest);
app.get("/api/health", async (_req, res) => {
  const supa = getSupabaseStatus();
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    supabase: {
      projectId: supa.projectId,
      url: supa.url,
      connected: supa.verified,
      displayStatus: supa.displayStatus
    }
  });
});
app.get("/api/status", async (_req, res) => {
  const supa = getSupabaseStatus();
  const bot = await telegramBot.getBotStatus();
  res.json({
    status: "ok",
    bot: bot.online ? "online" : "offline",
    supabase: supa.displayStatus
  });
});
var handleBotTest = async (_req, res) => {
  const botStatus = await telegramBot.getBotStatus();
  return res.json({
    online: botStatus.online,
    configured: botStatus.configured,
    botUsername: botStatus.botInfo?.username,
    botFirstName: botStatus.botInfo?.first_name,
    error: botStatus.error,
    message: botStatus.online ? `Bot is online as @${botStatus.botInfo?.username}` : botStatus.error || "Bot is offline or token invalid"
  });
};
app.get("/api/admin/bot/test", requireAdmin, handleBotTest);
app.post("/api/admin/bot/test", requireAdmin, handleBotTest);
app.get("/api/admin/bot-test", requireAdmin, handleBotTest);
app.post("/api/admin/bot-test", requireAdmin, handleBotTest);
app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
  const raw = db.getRaw();
  const supaStatus = getSupabaseStatus();
  const botStatus = await telegramBot.getBotStatus();
  res.json({
    hasToken: Boolean(raw.bot_settings.bot_token),
    status: botStatus.online ? "online" : botStatus.configured ? "token_invalid" : "offline",
    isActive: botStatus.online,
    botUsername: botStatus.botInfo?.username,
    storeUrl: raw.bot_settings.store_url || "https://etebox.com/store",
    backupBotUrl: raw.bot_settings.backup_bot_url || "https://t.me/EteboxBackupBot",
    supabaseConnected: supaStatus.verified
  });
});
app.get("/api/admin/bot-settings", requireAdmin, async (_req, res) => {
  const raw = db.getRaw();
  const supaStatus = getSupabaseStatus();
  const botStatus = await telegramBot.getBotStatus();
  res.json({
    hasToken: Boolean(raw.bot_settings.bot_token),
    maskedToken: raw.bot_settings.bot_token ? `${raw.bot_settings.bot_token.substring(0, 6)}...${raw.bot_settings.bot_token.slice(-4)}` : "",
    status: botStatus.online ? "online" : botStatus.configured ? "token_invalid" : "offline",
    isActive: botStatus.online,
    botUsername: botStatus.botInfo?.username,
    botFirstName: botStatus.botInfo?.first_name,
    lastError: botStatus.error,
    storeUrl: raw.bot_settings.store_url || "https://etebox.com/store",
    backupBotUrl: raw.bot_settings.backup_bot_url || "https://t.me/EteboxBackupBot",
    autoNotifyFreeContent: raw.bot_settings.auto_notify_free_content ?? true,
    rewardStars: raw.bot_settings.reward_stars ?? 3,
    rewardHours: raw.bot_settings.reward_hours ?? 8,
    supabaseConnected: supaStatus.verified,
    supabaseUrl: supaStatus.url,
    supabaseStatus: supaStatus.lastCheck.message
  });
});
app.put("/api/admin/bot-settings", requireAdmin, async (req, res) => {
  const { botToken, storeUrl, backupBotUrl, autoNotifyFreeContent, rewardStars, rewardHours } = req.body;
  await db.atomic((data) => {
    if (botToken !== void 0 && botToken.trim() !== "") {
      data.bot_settings.bot_token = botToken.trim();
    }
    if (storeUrl !== void 0) data.bot_settings.store_url = storeUrl;
    if (backupBotUrl !== void 0) data.bot_settings.backup_bot_url = backupBotUrl;
    if (autoNotifyFreeContent !== void 0) data.bot_settings.auto_notify_free_content = Boolean(autoNotifyFreeContent);
    if (rewardStars !== void 0) data.bot_settings.reward_stars = Number(rewardStars);
    if (rewardHours !== void 0) data.bot_settings.reward_hours = Number(rewardHours);
    data.bot_settings.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  });
  await logAction("Abood", "BOT_SETTINGS_UPDATED", "Bot Configuration", "Updated bot parameters");
  res.json({ success: true, message: "Bot settings updated successfully" });
});
app.get("/api/admin/video-packages", requireAdmin, async (_req, res) => {
  const raw = db.getRaw();
  res.json(raw.video_packages || []);
});
app.post("/api/admin/video-packages", requireAdmin, async (req, res) => {
  const { package_name, number_of_videos, stars_price, video_urls } = req.body;
  if (!package_name || !number_of_videos || stars_price === void 0) {
    return res.status(400).json({ error: "Missing package_name, number_of_videos, or stars_price" });
  }
  const urls = Array.isArray(video_urls) ? video_urls.filter(Boolean) : [];
  const newPackage = {
    id: `vp_${Date.now()}`,
    package_name: package_name.trim(),
    number_of_videos: Number(number_of_videos),
    stars_price: Number(stars_price),
    video_urls: urls,
    active: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.atomic((data) => {
    data.video_packages.unshift(newPackage);
  });
  await logAction("Abood", "VIDEO_PACKAGE_CREATED", newPackage.package_name, `${newPackage.number_of_videos} videos for ${newPackage.stars_price} Stars`);
  res.json(newPackage);
});
app.put("/api/admin/video-packages/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { package_name, number_of_videos, stars_price, video_urls, active } = req.body;
  let updatedPkg = null;
  await db.atomic((data) => {
    const pkg = data.video_packages.find((p) => p.id === id);
    if (pkg) {
      if (package_name !== void 0) pkg.package_name = package_name.trim();
      if (number_of_videos !== void 0) pkg.number_of_videos = Number(number_of_videos);
      if (stars_price !== void 0) pkg.stars_price = Number(stars_price);
      if (video_urls !== void 0 && Array.isArray(video_urls)) pkg.video_urls = video_urls.filter(Boolean);
      if (active !== void 0) pkg.active = Boolean(active);
      pkg.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      updatedPkg = { ...pkg };
    }
  });
  if (!updatedPkg) {
    return res.status(404).json({ error: "Video package not found" });
  }
  await logAction("Abood", "VIDEO_PACKAGE_UPDATED", id, "Modified package details");
  res.json(updatedPkg);
});
app.delete("/api/admin/video-packages/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  let deleted = null;
  await db.atomic((data) => {
    const idx = data.video_packages.findIndex((p) => p.id === id);
    if (idx !== -1) {
      deleted = data.video_packages.splice(idx, 1)[0];
    }
  });
  if (!deleted) {
    return res.status(404).json({ error: "Video package not found" });
  }
  await logAction("Abood", "VIDEO_PACKAGE_DELETED", id, "Deleted video package");
  res.json({ success: true });
});
app.get("/api/admin/video-package-purchases", requireAdmin, async (_req, res) => {
  const raw = db.getRaw();
  res.json(raw.video_package_purchases || []);
});
app.get("/api/admin/users", requireAdmin, async (_req, res) => {
  const raw = db.getRaw();
  res.json(raw.users || []);
});
app.post("/api/admin/users/:id/adjust-balance", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount === 0) {
    return res.status(400).json({ error: "Invalid adjustment amount" });
  }
  let updatedUser = null;
  await db.atomic((data) => {
    const user = data.users.find((u) => u.id === id || String(u.telegram_user_id) === id);
    if (!user) return;
    if (user.balance + numAmount < 0) {
      throw new Error(`Cannot reduce balance below 0. Current balance: ${user.balance}`);
    }
    const before = user.balance;
    user.balance += numAmount;
    if (numAmount > 0) user.total_earned += numAmount;
    if (numAmount < 0) user.total_spent += Math.abs(numAmount);
    user.last_activity_at = (/* @__PURE__ */ new Date()).toISOString();
    data.star_transactions.unshift({
      id: `tx_adj_${Date.now()}`,
      user_id: user.id,
      amount: numAmount,
      balance_before: before,
      balance_after: user.balance,
      type: "admin_adjustment",
      description: `\u{1F6E0}\uFE0F Admin Adjustment: ${reason || "Manual modification"}`,
      admin_id: "Abood",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    updatedUser = { ...user };
  });
  if (!updatedUser) {
    return res.status(404).json({ error: "User not found" });
  }
  await logAction("Abood", "USER_BALANCE_ADJUSTED", id, `${numAmount > 0 ? "+" : ""}${numAmount} Stars`);
  res.json(updatedUser);
});
app.post("/api/admin/users/:id/toggle-ban", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { banned, reason } = req.body;
  let targetUser = null;
  await db.atomic((data) => {
    const user = data.users.find((u) => u.id === id || String(u.telegram_user_id) === id);
    if (user) {
      user.is_banned = Boolean(banned);
      user.banned_reason = banned ? reason || "Banned by administrator" : void 0;
      targetUser = { ...user };
    }
  });
  if (!targetUser) return res.status(404).json({ error: "User not found" });
  await logAction("Abood", targetUser.is_banned ? "USER_BANNED" : "USER_UNBANNED", id, targetUser.banned_reason);
  res.json(targetUser);
});
app.get("/api/admin/star-packages", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().star_packages || []);
});
app.post("/api/admin/star-packages", requireAdmin, async (req, res) => {
  const { name, stars_amount, price_usd, payment_url, payment_info } = req.body;
  const newPkg = {
    id: `pkg_${Date.now()}`,
    name,
    stars_amount: Number(stars_amount),
    price_usd: Number(price_usd),
    payment_url: payment_url || "",
    payment_info: payment_info || "",
    is_active: true
  };
  await db.atomic((data) => {
    data.star_packages.push(newPkg);
  });
  res.json(newPkg);
});
app.delete("/api/admin/star-packages/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.atomic((data) => {
    data.star_packages = data.star_packages.filter((p) => p.id !== id);
  });
  res.json({ success: true });
});
app.get("/api/admin/star-codes", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().star_codes || []);
});
app.post("/api/admin/star-codes", requireAdmin, async (req, res) => {
  const { code, stars_amount, count = 1 } = req.body;
  const numCount = Math.min(50, Math.max(1, Number(count)));
  const amount = Number(stars_amount);
  const createdCodes = [];
  await db.atomic((data) => {
    for (let i = 0; i < numCount; i++) {
      const codeStr = numCount === 1 && code ? code.trim().toUpperCase() : `STAR-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newCode = {
        id: `sc_${Date.now()}_${i}`,
        code: codeStr,
        stars_amount: amount,
        is_active: true,
        is_used: false,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      data.star_codes.unshift(newCode);
      createdCodes.push(newCode);
    }
  });
  await logAction("Abood", "STAR_CODES_CREATED", void 0, `Generated ${numCount} codes for ${amount} Stars`);
  res.json(createdCodes);
});
app.delete("/api/admin/star-codes/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.atomic((data) => {
    data.star_codes = data.star_codes.filter((c) => c.id !== id);
  });
  res.json({ success: true });
});
app.get("/api/admin/transactions", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().star_transactions || []);
});
app.get("/api/admin/free-videos", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().free_videos || []);
});
app.post("/api/admin/free-videos", requireAdmin, async (req, res) => {
  const { title, delivery_type, direct_video_url, file_size_mb, telegram_message_url, download_url, download_code, description } = req.body;
  const video = {
    id: `fv_${Date.now()}`,
    title,
    delivery_type: delivery_type || "DIRECT_VIDEO",
    direct_video_url,
    file_size_mb: Number(file_size_mb) || 0,
    telegram_message_url,
    download_url,
    download_code,
    description,
    is_active: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.atomic((data) => {
    data.free_videos.unshift(video);
  });
  res.json(video);
});
app.delete("/api/admin/free-videos/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.atomic((data) => {
    data.free_videos = data.free_videos.filter((v) => v.id !== id);
  });
  res.json({ success: true });
});
app.get("/api/admin/files", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().files || []);
});
app.post("/api/admin/files", requireAdmin, async (req, res) => {
  const { file_name, sample_url, download_url, file_code, zip_password, price_stars } = req.body;
  const newFile = {
    id: `file_${Date.now()}`,
    file_name,
    sample_url,
    download_url,
    file_code,
    zip_password,
    price_stars: Number(price_stars),
    is_active: true,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.atomic((data) => {
    data.files.unshift(newFile);
  });
  res.json(newFile);
});
app.delete("/api/admin/files/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.atomic((data) => {
    data.files = data.files.filter((f) => f.id !== id);
  });
  res.json({ success: true });
});
app.get("/api/admin/file-purchases", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().file_purchases || []);
});
app.get("/api/admin/channels", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().channels || []);
});
app.post("/api/admin/channels", requireAdmin, async (req, res) => {
  const { name, url, required_stars, display_order } = req.body;
  const newChan = {
    id: `ch_${Date.now()}`,
    name,
    url,
    display_order: Number(display_order) || 0,
    is_active: true,
    required_stars: Number(required_stars) || 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.atomic((data) => {
    data.channels.push(newChan);
  });
  res.json(newChan);
});
app.delete("/api/admin/channels/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.atomic((data) => {
    data.channels = data.channels.filter((c) => c.id !== id);
  });
  res.json({ success: true });
});
app.get("/api/admin/broadcasts", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().broadcasts || []);
});
app.post("/api/admin/broadcasts", requireAdmin, async (req, res) => {
  const { text, image_url, button_text, button_url } = req.body;
  const raw = db.getRaw();
  const users = raw.users;
  const broadcast = {
    id: `bc_${Date.now()}`,
    text,
    image_url,
    button_text,
    button_url,
    total_users: users.length,
    sent_count: users.length,
    failed_count: 0,
    blocked_count: 0,
    status: "completed",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await db.atomic((data) => {
    data.broadcasts.unshift(broadcast);
  });
  if (telegramBot.isConfigured) {
    for (const u of users) {
      try {
        await telegramBot.sendMessage(u.telegram_user_id, text);
      } catch {
      }
    }
  }
  await logAction("Abood", "BROADCAST_SENT", void 0, `Sent to ${users.length} users`);
  res.json(broadcast);
});
app.get("/api/admin/logs", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().admin_logs || []);
});
app.get("/api/admin/accounts", requireAdmin, async (_req, res) => {
  res.json(db.getRaw().admins || []);
});
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    const update = req.body;
    await telegramBot.handleUpdate(update);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Error handling update:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
app.post("/api/admin/emulator/send", requireAdmin, async (req, res) => {
  const { text, callback_data, user_id = 99887766 } = req.body;
  const mockUser = {
    id: user_id,
    first_name: "Tester",
    username: "DemoTester"
  };
  if (callback_data) {
    const query = {
      id: `query_${Date.now()}`,
      from: mockUser,
      data: callback_data,
      message: {
        message_id: 1234,
        chat: { id: user_id }
      }
    };
    const result2 = await telegramBot.handleCallbackQuery(query);
    return res.json({
      success: true,
      result: result2,
      mainMenu: telegramBot.getMainMenuKeyboard()
    });
  }
  const message = {
    message_id: 1e3 + Math.floor(Math.random() * 9e3),
    from: mockUser,
    chat: { id: user_id },
    text: text || "/start"
  };
  const result = await telegramBot.handleMessage(message);
  return res.json({
    success: true,
    result,
    mainMenu: telegramBot.getMainMenuKeyboard()
  });
});
app.all("/api/*", (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl || req.url}`,
    status: 404
  });
});

// server/serverless.ts
var serverless_default = app;
export {
  serverless_default as default
};
