// ===========================================𝐃𝐈𝐆𝐈𝐓𝐀𝐋 𝐃𝐎𝐍 - Enterprise WhatsApp Pairing System
// Developed by 𝙽𝙴𝚇𝙰 𝚃𝙴𝙲𝙷 
// Version: 5.0 Premium Edition
// ============================================

require('dotenv').config();
require('./setting/config');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { performance } = require('perf_hooks');
const os = require('os');
const { BOT_TOKEN } = require('./nexstore/token');
const { sleep } = require('./nexstore/utils');
const { autoLoadPairs } = require('./autoload');

// ==================== SYSTEM CONFIGURATION ====================
const SYSTEM = {
  name: "𝐍𝐄𝐗𝐀 𝐕𝟓",
  shortName: "𝐍𝐄𝐗𝐀",
  creator: "𝙽𝙴𝚇𝙰 𝚃𝙴𝙲𝙷",
  version: "5.0.0",
  environment: process.env.NODE_ENV || "production",
  sessionLimit: 100,
  codeExpiry: 300000, // 5 minutes
  broadcastDelay: 100,
  maxLogs: 1000
};

// Owner Configuration
const OWNERS = {
  primary: 8539446210,
  secondary: 8539446210,
  dev: 8539446210,
  all: [8539446210, 7638289357]
};

// Developer Contact Information
const DEVELOPER_CONTACTS = {
  telegram: 'https://t.me/bigleem247',
  whatsapp: 'https://whatsapp.com/channel/0029VbBRSOALikg4s32Dp70c',
  email: '',
  support: '@bigleem247'
};

// File System Structure
const PATHS = {
  base: path.join(__dirname, 'axis_storage'),
  admin: path.join(__dirname, 'axis_storage', 'admin.json'),
  users: path.join(__dirname, 'axis_storage', 'users.json'),
  userDetails: path.join(__dirname, 'axis_storage', 'userdetails.json'),
  stats: path.join(__dirname, 'axis_storage', 'stats.json'),
  banned: path.join(__dirname, 'axis_storage', 'banned.json'),
  reports: path.join(__dirname, 'axis_storage', 'reports.json'),
  sessions: path.join(__dirname, 'axis_storage', 'sessions'),
  audit: path.join(__dirname, 'axis_storage', 'audit.json'),
  maintenance: path.join(__dirname, 'axis_storage', 'maintenance.json'),
  backups: path.join(__dirname, 'axis_storage', 'backups'),
  // NEW: Premium system paths
  premium: path.join(__dirname, 'axis_storage', 'premium.json'),
  trials: path.join(__dirname, 'axis_storage', 'trials.json')
};

// Media Assets
const ASSETS = {
  menuImages: [
    'https://files.catbox.moe/l8cc9s.jpeg',
    'https://files.catbox.moe/l8cc9s.jpeg',
  ],
  pairingVideos: [
    'https://files.catbox.moe/l8cc9s.jpeg',
    'https://files.catbox.moe/l8cc9s.jpeg'
  ],
};

// Channel Requirements
const REQUIRED_CHANNELS = [
  {
    id: -1002852974006,
    name: 'NEXA V5 UPDATES',
    link: 'https://t.me/Nexa_x_group'
  },

  {
    id: -1003643136165,
    name: 'Community Group',
    link: 'https://t.me/bigleemcyberhub'
  }
];

// Social Links
const SOCIAL = {
    whatsapp: 'https://whatsapp.com/channel/0029VbBRS0ALikg4s32Dp70c',

    telegram: {
        primary: 'https://t.me/bigleemcyberhub',
        group: 'https://t.me/Nexa_x_group',
    },

    developer: 'https://t.me/bigleem247'
};

// Rate Limiting
const RATE_LIMIT = {
  window: 60000, // 1 minute
  max: 15 // requests per minute
};

// ==================== INITIALIZATION ====================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Data Stores
let database = {
  admins: [...OWNERS.all.map(id => id.toString())],
  users: new Set(),
  userDetails: {},
  banned: {},
  stats: {
    startTime: Date.now(),
    totalConnections: 0,
    dailyConnections: 0,
    totalUsers: 0,
    totalMessages: 0,
    groupMessages: 0,
    privateMessages: 0,
    failures: 0,
    pairingSpeed: [],
    lastReset: new Date().toDateString()
  },
  reports: [],
  audit: [],
  activeSessions: new Map(),
  maintenance: false,
  // NEW: Premium system stores
  premium: {}, // Format: { "user_id": { expiry: timestamp, addedBy: admin_id, addedAt: timestamp } }
  trialMode: {
    active: false,
    expiry: null,
    startedBy: null,
    startedAt: null
  }
};

// Rate Limit Store
const rateLimit = new Map();

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format uptime from milliseconds
 */
const formatUptime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}ᴅ`);
  if (hours > 0) parts.push(`${hours}ʜ`);
  if (minutes > 0) parts.push(`${minutes}ᴍ`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Parse duration string (e.g., "3 days", "1 week", "24 hours")
 */
const parseDuration = (durationStr) => {
  const match = durationStr.match(/^(\d+)\s*(second|minute|hour|day|week|month)s?$/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  };
  
  return value * (multipliers[unit] || multipliers.day);
};

/**
 * Format duration for display
 */
const formatDuration = (ms) => {
  if (ms < 0) return 'Expired';
  
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  
  return parts.join(', ') || 'Less than a minute';
};

/**
 * Format number with commas
 */
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Get time-based greeting
 */
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'ᴍᴏʀɴɪɴɢ', emoji: '🌅' };
  if (hour < 17) return { text: 'ᴀғᴛᴇʀɴᴏᴏɴ', emoji: '☀️' };
  if (hour < 20) return { text: 'ᴇᴠᴇɴɪɴɢ', emoji: '🌆' };
  return { text: 'ɴɪɢʜᴛ', emoji: '🌙' };
};

/**
 * Sanitize user input
 */
const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[<>[\]{}()\\;'"\`]/g, '').substring(0, 500);
};

/**
 * Validate phone number
 */
const validatePhone = (number) => {
  if (!number || number.trim() === '') {
    return { valid: false, error: 'ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ' };
  }
  
  if (/[a-z]/i.test(number)) {
    return { valid: false, error: 'ʟᴇᴛᴛᴇʀs ɴᴏᴛ ᴀʟʟᴏᴡᴇᴅ' };
  }
  
  if (!/^\d{7,15}$/.test(number.split('|')[0])) {
    return { valid: false, error: 'ɪɴᴠᴀʟɪᴅ ғᴏʀᴍᴀᴛ' };
  }
  
  if (number.startsWith('0')) {
    return { valid: false, error: 'ɴᴏ ʟᴇᴀᴅɪɴɢ ᴢᴇʀᴏ' };
  }
  
  const restricted = ['252', '201', '202'];
  if (restricted.includes(number.slice(0, 3))) {
    return { valid: false, error: 'ᴄᴏᴜɴᴛʀʏ ɴᴏᴛ sᴜᴘᴘᴏʀᴛᴇᴅ' };
  }
  
  return { valid: true };
};

/**
 * Check rate limit
 */
const checkRateLimit = (userId) => {
  const now = Date.now();
  const userLimit = rateLimit.get(userId) || { count: 0, reset: now + RATE_LIMIT.window };
  
  if (now > userLimit.reset) {
    userLimit.count = 0;
    userLimit.reset = now + RATE_LIMIT.window;
  }
  
  if (userLimit.count >= RATE_LIMIT.max) return false;
  
  userLimit.count++;
  rateLimit.set(userId, userLimit);
  return true;
};

/**
 * Permission checks
 */
const isOwner = (userId) => OWNERS.all.includes(Number(userId));
const isAdmin = (userId) => database.admins.includes(userId.toString());

// ==================== PREMIUM SYSTEM FUNCTIONS ====================

/**
 * Check if user is premium
 */
const isPremium = (userId) => {
  const userIdStr = userId.toString();
  const premiumData = database.premium[userIdStr];
  
  if (!premiumData) return false;
  
  // Check if expired
  if (premiumData.expiry < Date.now()) {
    // Auto-remove expired premium
    delete database.premium[userIdStr];
    saveData();
    return false;
  }
  
  return true;
};

/**
 * Check if trial mode is active
 */
const isTrialActive = () => {
  if (!database.trialMode.active) return false;
  if (database.trialMode.expiry && database.trialMode.expiry < Date.now()) {
    // Auto-deactivate trial
    database.trialMode.active = false;
    database.trialMode.expiry = null;
    saveData();
    return false;
  }
  return true;
};

/**
 * Check if user has access (premium OR trial OR admin/owner)
 */
const hasAccess = (userId) => {
  return isAdmin(userId.toString()) || 
         isOwner(userId) || 
         isPremium(userId) || 
         isTrialActive();
};

/**
 * Send access denied message
 */
const sendAccessDenied = async (chatId) => {
  const message = `╔════════════════════════════════╗
║      ⛔ ꜱʏꜱᴛᴇᴍ ʀᴇꜱᴛʀɪᴄᴛᴇᴅ ⛔      
╠════════════════════════════════╣
║                                
║  ✖ ꜱᴛᴀᴛᴜꜱ    :: ᴅᴇɴɪᴇᴅ         
║  ✖ ᴜꜱᴇʀ      :: ꜰʀᴇᴇ ᴛɪᴇʀ      
║  ✖ ᴀᴄᴄᴇꜱꜱ    :: ʙʟᴏᴄᴋᴇᴅ         
║                                
║  ⚠ ᴘʀᴇᴍɪᴜᴍ ᴀᴄᴄᴇꜱꜱ ʀᴇQᴜɪʀᴇᴅ      
║                                
╠════════════════════════════════╣
║         ᴅᴇᴠᴇʟᴏᴘᴇʀ ᴄᴏɴᴛᴀᴄᴛ         
║                                
║  👤 @bigleem247                
║  📡 ᴛɢ :: ${DEVELOPER_CONTACTS.telegram}
║  💬 ᴡᴀ :: ${DEVELOPER_CONTACTS.whatsapp}
║                                
╠════════════════════════════════╣
║      🔓 ᴜᴘɢʀᴀᴅᴇ ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ       ║
╚════════════════════════════════╝`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

// ==================== FILE OPERATIONS ====================

/**
 * Ensure directories exist
 */
const ensureDirectories = async () => {
  const dirs = [
    PATHS.base,
    PATHS.sessions,
    PATHS.backups,
    path.join(__dirname, 'nexstore', 'pairing'),
    path.join(__dirname, 'allfunc')
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error(`ᴅɪʀᴇᴄᴛᴏʀʏ ᴇʀʀᴏʀ: ${dir}`, err.message);
    }
  }
};

/**
 * Check if file exists
 */
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Load database
 */
const loadDatabase = async () => {
  // Load admins
  if (await fileExists(PATHS.admin)) {
    try {
      const data = await fs.readFile(PATHS.admin, 'utf8');
      database.admins = [...new Set([...OWNERS.all.map(id => id.toString()), ...JSON.parse(data)])];
    } catch (err) {
      console.error('ᴀᴅᴍɪɴ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  } else {
    await fs.writeFile(PATHS.admin, JSON.stringify(database.admins, null, 2));
  }

  // Load users
  if (await fileExists(PATHS.users)) {
    try {
      const data = await fs.readFile(PATHS.users, 'utf8');
      database.users = new Set(JSON.parse(data));
      database.stats.totalUsers = database.users.size;
    } catch (err) {
      console.error('ᴜsᴇʀs ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load user details
  if (await fileExists(PATHS.userDetails)) {
    try {
      database.userDetails = JSON.parse(await fs.readFile(PATHS.userDetails, 'utf8'));
    } catch (err) {
      console.error('ᴜsᴇʀ ᴅᴇᴛᴀɪʟs ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load banned
  if (await fileExists(PATHS.banned)) {
    try {
      database.banned = JSON.parse(await fs.readFile(PATHS.banned, 'utf8'));
    } catch (err) {
      console.error('ʙᴀɴɴᴇᴅ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load stats
  if (await fileExists(PATHS.stats)) {
    try {
      database.stats = JSON.parse(await fs.readFile(PATHS.stats, 'utf8'));
      const today = new Date().toDateString();
      if (database.stats.lastReset !== today) {
        database.stats.dailyConnections = 0;
        database.stats.lastReset = today;
      }
    } catch (err) {
      console.error('sᴛᴀᴛs ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load maintenance
  if (await fileExists(PATHS.maintenance)) {
    try {
      database.maintenance = JSON.parse(await fs.readFile(PATHS.maintenance, 'utf8')).enabled || false;
    } catch (err) {
      console.error('ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load reports
  if (await fileExists(PATHS.reports)) {
    try {
      database.reports = JSON.parse(await fs.readFile(PATHS.reports, 'utf8'));
    } catch (err) {
      console.error('ʀᴇᴘᴏʀᴛs ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // Load audit
  if (await fileExists(PATHS.audit)) {
    try {
      database.audit = JSON.parse(await fs.readFile(PATHS.audit, 'utf8'));
    } catch (err) {
      console.error('ᴀᴜᴅɪᴛ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
    }
  }

  // NEW: Load premium data
  if (await fileExists(PATHS.premium)) {
    try {
      database.premium = JSON.parse(await fs.readFile(PATHS.premium, 'utf8'));
    } catch (err) {
      console.error('ᴘʀᴇᴍɪᴜᴍ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
      database.premium = {};
    }
  } else {
    await fs.writeFile(PATHS.premium, JSON.stringify(database.premium, null, 2));
  }

  // NEW: Load trial data
  if (await fileExists(PATHS.trials)) {
    try {
      database.trialMode = JSON.parse(await fs.readFile(PATHS.trials, 'utf8'));
    } catch (err) {
      console.error('ᴛʀɪᴀʟ ʟᴏᴀᴅ ᴇʀʀᴏʀ:', err.message);
      database.trialMode = { active: false, expiry: null, startedBy: null, startedAt: null };
    }
  } else {
    await fs.writeFile(PATHS.trials, JSON.stringify(database.trialMode, null, 2));
  }
};

/**
 * Save database
 */
const saveData = async () => {
  try {
    await Promise.all([
      fs.writeFile(PATHS.admin, JSON.stringify(database.admins, null, 2)),
      fs.writeFile(PATHS.users, JSON.stringify([...database.users], null, 2)),
      fs.writeFile(PATHS.userDetails, JSON.stringify(database.userDetails, null, 2)),
      fs.writeFile(PATHS.banned, JSON.stringify(database.banned, null, 2)),
      fs.writeFile(PATHS.stats, JSON.stringify(database.stats, null, 2)),
      fs.writeFile(PATHS.maintenance, JSON.stringify({ enabled: database.maintenance }, null, 2)),
      fs.writeFile(PATHS.reports, JSON.stringify(database.reports, null, 2)),
      fs.writeFile(PATHS.audit, JSON.stringify(database.audit.slice(-SYSTEM.maxLogs), null, 2)),
      // NEW: Save premium and trial data
      fs.writeFile(PATHS.premium, JSON.stringify(database.premium, null, 2)),
      fs.writeFile(PATHS.trials, JSON.stringify(database.trialMode, null, 2))
    ]);
  } catch (err) {
    console.error('sᴀᴠᴇ ᴇʀʀᴏʀ:', err.message);
  }
};

// ==================== USER TRACKING ====================

/**
 * Track user activity
 */
const trackUser = async (userId, userName = 'ᴜsᴇʀ', isGroup = false) => {
  const userIdStr = userId.toString();
  
  if (!database.users.has(userIdStr)) {
    database.users.add(userIdStr);
    database.stats.totalUsers = database.users.size;
    
    database.userDetails[userIdStr] = {
      name: userName,
      joined: new Date().toISOString(),
      messages: 1,
      lastActive: new Date().toISOString(),
      pairs: 0,
      groupMessages: isGroup ? 1 : 0,
      privateMessages: isGroup ? 0 : 1,
      // NEW: Track premium status in user details
      premium: isPremium(userIdStr)
    };
    
    console.log(chalk.green(`➕ ɴᴇᴡ ᴜsᴇʀ: ${userName} (${userIdStr})`));
  } else {
    if (database.userDetails[userIdStr]) {
      database.userDetails[userIdStr].messages++;
      database.userDetails[userIdStr].lastActive = new Date().toISOString();
      if (isGroup) {
        database.userDetails[userIdStr].groupMessages++;
      } else {
        database.userDetails[userIdStr].privateMessages++;
      }
      // Update premium status
      database.userDetails[userIdStr].premium = isPremium(userIdStr);
    }
  }
  
  database.stats.totalMessages++;
  if (isGroup) database.stats.groupMessages++;
  else database.stats.privateMessages++;
  
  await saveData();
};

// ==================== BAN CHECK ====================

/**
 * Check if user is banned
 */
const checkBanned = async (userId, chatId = null) => {
  const userIdStr = userId.toString();
  
  if (database.banned[userIdStr]) {
    if (chatId) {
      await bot.sendMessage(chatId, 
        `╭══════════════════════════════╮
│      ⛔ ꜱʏꜱᴛᴇᴍ ʙᴀɴɴᴇᴅ ⛔       │
╰══════════════════════════════╯

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ✖ ꜱᴛᴀᴛᴜꜱ   :: ʙᴀɴɴᴇᴅ
┃ ✖ ᴜꜱᴇʀ     :: ʀᴇꜱᴛʀɪᴄᴛᴇᴅ
┃ ✖ ᴀᴄᴄᴇꜱꜱ   :: ᴛᴇʀᴍɪɴᴀᴛᴇᴅ
┃
┃ ⚠ ᴀᴄᴄᴏᴜɴᴛ ꜱᴜꜱᴘᴇɴᴅᴇᴅ
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ʀᴇᴀꜱᴏɴ :
┃ ${database.banned[userIdStr].reason || 'ᴠɪᴏʟᴀᴛɪᴏɴ ᴏꜰ ᴛᴇʀᴍꜱ'}
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 ʏᴏᴜ ᴄᴀɴ ɴᴏ ʟᴏɴɢᴇʀ ᴜꜱᴇ
┃ ᴛʜɪꜱ ʙᴏᴛ’ꜱ ꜱᴇʀᴠɪᴄᴇꜱ
┃
┃ 📡 ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ ɪꜰ
┃ ʏᴏᴜ ʙᴇʟɪᴇᴠᴇ ᴛʜɪꜱ ɪꜱ ᴀɴ ᴇʀʀᴏʀ
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`,
        { parse_mode: 'Markdown' }
      );
    }
    return true;
  }
  return false;
};

// ==================== MEMBERSHIP VERIFICATION ====================

/**
 * Verify channel membership
 */
const verifyMembership = async (userId) => {
  try {
    const result = {
      verified: true,
      missing: []
    };
    
    for (const channel of REQUIRED_CHANNELS) {
      try {
        const member = await bot.getChatMember(channel.id, userId);
        const valid = ['member', 'administrator', 'creator'].includes(member.status);
        if (!valid) {
          result.verified = false;
          result.missing.push(channel.name);
        }
      } catch {
        result.verified = false;
        result.missing.push(channel.name);
      }
    }
    
    return result;
  } catch (error) {
    console.error('ᴍᴇᴍʙᴇʀsʜɪᴘ ᴄʜᴇᴄᴋ ᴇʀʀᴏʀ:', error.message);
    return {
      verified: false,
      missing: REQUIRED_CHANNELS.map(c => c.name)
    };
  }
};

// ==================== SESSION MANAGEMENT ====================

/**
 * Get all sessions
 */
const getSessions = async () => {
  try {
    const entries = await fs.readdir(PATHS.sessions, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory() && entry.name.includes('@s.whatsapp.net'))
      .map(entry => entry.name);
  } catch {
    return [];
  }
};

/**
 * Get detailed session information with status
 */
const getSessionDetails = async () => {
  try {
    const entries = await fs.readdir(PATHS.sessions, { withFileTypes: true });
    const sessions = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.includes('@s.whatsapp.net')) continue;
      
      const sessionPath = path.join(PATHS.sessions, entry.name);
      const credsPath = path.join(sessionPath, 'creds.json');
      
      let status = 'ɪɴᴀᴄᴛɪᴠᴇ';
      let name = 'ᴜɴᴋɴᴏᴡɴ';
      let lastActive = null;
      
      if (await fileExists(credsPath)) {
        try {
          const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
          if (creds.me && creds.me.id) {
            status = 'ᴀᴄᴛɪᴠᴇ ✅';
            name = creds.me.name || 'ᴜɴᴋɴᴏᴡɴ';
            lastActive = creds.lastActive || null;
          } else {
            status = 'ᴄᴏʀʀᴜᴘᴛᴇᴅ ❌';
          }
        } catch (e) {
          status = 'ᴄᴏʀʀᴜᴘᴛᴇᴅ ❌';
        }
      } else {
        status = 'ɪɴᴄᴏᴍᴘʟᴇᴛᴇ ⚠️';
      }
      
      sessions.push({
        jid: entry.name,
        number: entry.name.split('@')[0],
        name,
        status,
        lastActive,
        path: sessionPath
      });
    }
    
    return sessions;
  } catch (error) {
    console.error('sᴇssɪᴏɴ ᴅᴇᴛᴀɪʟs ᴇʀʀᴏʀ:', error.message);
    return [];
  }
};

/**
 * Delete session
 */
const deleteSession = async (phone) => {
  const sessionPath = path.join(PATHS.sessions, `${phone}@s.whatsapp.net`);
  try {
    if (await fileExists(sessionPath)) {
      await fs.rm(sessionPath, { recursive: true, force: true });
      return true;
    }
  } catch (err) {
    console.error('sᴇssɪᴏɴ ᴅᴇʟᴇᴛɪᴏɴ ᴇʀʀᴏʀ:', err.message);
  }
  return false;
};

// ==================== AUDIT LOGGING ====================

/**
 * Add audit log entry
 */
const addAuditLog = (action, userId, target = null, details = {}) => {
  database.audit.push({
    timestamp: new Date().toISOString(),
    action,
    userId,
    target,
    details
  });
  
  if (database.audit.length > SYSTEM.maxLogs) {
    database.audit = database.audit.slice(-SYSTEM.maxLogs);
  }
  
  saveData();
};

// ==================== GROUP MESSAGE HANDLER ====================

/**
 * Handle group messages
 */
const handleGroupMessage = async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const mention = msg.from.username ? `@${msg.from.username}` : `[${msg.from.first_name}](tg://user?id=${userId})`;
  
  await bot.sendMessage(chatId, 
    `${mention}
╔══════════════════════════════╗
║        📡 ᴅᴍ ʀᴇQᴜɪʀᴇᴅ 📡        ║
╠══════════════════════════════╣
║                              
║  ◈ ꜱᴛᴀᴛᴜꜱ   :: ʟɪᴍɪᴛᴇᴅ         
║  ◈ ᴍᴏᴅᴇ     :: ɢʀᴏᴜᴘ ᴄʜᴀᴛ      
║  ◈ ᴀᴄᴄᴇꜱꜱ   :: ᴘᴀʀᴛɪᴀʟ         
║                              
║  ⚠ ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀᴛ ɴᴇᴇᴅᴇᴅ         
║                              
╠══════════════════════════════╣
║  💬 ᴘʟᴇᴀꜱᴇ ᴜꜱᴇ ᴛʜɪꜱ ʙᴏᴛ ɪɴ      
║  ᴘʀɪᴠᴀᴛᴇ ᴍᴇꜱꜱᴀɢᴇꜱ ᴛᴏ           
║  ᴜɴʟᴏᴄᴋ ꜰᴜʟʟ ꜰᴇᴀᴛᴜʀᴇꜱ          
║                              
╠══════════════════════════════╣
║   🔓 ꜱᴡɪᴛᴄʜ ᴛᴏ ᴅᴍ ꜰᴏʀ ꜰᴜʟʟ      
║        ꜰᴜɴᴄᴛɪᴏɴᴀʟɪᴛʏ            
╚══════════════════════════════╝`,
    {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 ᴄʜᴀᴛ ᴘʀɪᴠᴀᴛᴇʟʏ', url: `https://t.me/${(await bot.getMe()).username}` }]
        ]
      }
    }
  );
};

// ==================== MAIN MENU ====================

/**
 * Send main menu
 */
const sendMainMenu = async (chatId, userId, userName, isAdminUser = false, isOwnerUser = false) => {
  const greeting = getGreeting();
  const uptime = formatUptime(Date.now() - database.stats.startTime);
  const sessions = await getSessions();
  const userPremium = isPremium(userId);
  const trialActive = isTrialActive();
  
  let menu = `╭══════════════════════════════════╮
│          ⚡ ᴍᴀɪɴ ᴍᴇɴᴜ ⚡           │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴏɴʟɪɴᴇ
│ ◇ ꜱʏꜱᴛᴇᴍ   :: ᴀᴄᴛɪᴠᴇ
│ ◇ ᴍᴏᴅᴇ     :: ꜱᴛᴀʙʟᴇ
│
│ ${greeting.emoji} ɢᴏᴏᴅ ${greeting.text},
│ ${userName}
│
│ 📡 ᴇɴᴛᴇʀᴘʀɪꜱᴇ ᴡʜᴀᴛꜱᴀᴘᴘ
│ ᴘᴀɪʀɪɴɢ ꜱʏꜱᴛᴇᴍ
│
│ ⚡ ꜱᴇᴄᴜʀᴇ • ꜰᴀꜱᴛ • ʀᴇʟɪᴀʙʟᴇ
└──────────────────────────────────┘

╭══════════════════════════════════╮
│        🖥 ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ 🖥         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ⏱ ᴜᴘᴛɪᴍᴇ     :: ${uptime}
│ 👥 ᴜꜱᴇʀꜱ      :: ${formatNumber(database.stats.totalUsers)}
│ 🔗 ꜱᴇꜱꜱɪᴏɴꜱ   :: ${sessions.length}/${SYSTEM.sessionLimit}
│ 📈 ᴛᴏᴅᴀʏ      :: ${formatNumber(database.stats.dailyConnections)}
│
├──────────────────────────────────┤
│ ⚙ ᴘᴇʀꜰᴏʀᴍᴀɴᴄᴇ ꜱᴛᴀʙʟᴇ
│ 📡 ᴀʟʟ ꜱʏꜱᴛᴇᴍꜱ ʀᴜɴɴɪɴɢ
└──────────────────────────────────┘`;

  // Show premium status for non-admin users
  if (!isAdminUser && !isOwnerUser) {
    if (userPremium) {
      const expiry = new Date(database.premium[userId.toString()].expiry);
      menu += `╭══════════════════════════════════╮
│      💎 ᴘʀᴇᴍɪᴜᴍ ꜱᴛᴀᴛᴜꜱ 💎       │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴀᴄᴛɪᴠᴇ
│ ◇ ᴀᴄᴄᴇꜱꜱ   :: ɢʀᴀɴᴛᴇᴅ
│ ◇ ʟᴇᴠᴇʟ    :: ᴘʀᴇᴍɪᴜᴍ
│
│ 👑 ᴘʀᴇᴍɪᴜᴍ : ᴀᴄᴛɪᴠᴇ
│ 📅 ᴇxᴘɪʀᴇꜱ :
│ ${expiry.toLocaleDateString()}
│
├──────────────────────────────────┤
│ ⚡ ᴀʟʟ ꜰᴇᴀᴛᴜʀᴇꜱ ᴜɴʟᴏᴄᴋᴇᴅ
│ 🔓 ꜰᴜʟʟ ꜱʏꜱᴛᴇᴍ ᴀᴄᴄᴇꜱꜱ
└──────────────────────────────────┘`;
    } else if (trialActive) {
      const trialExpiry = new Date(database.trialMode.expiry);
      menu += `\n├◆ 🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ: ᴀᴄᴛɪᴠᴇ (ᴇɴᴅs: ${trialExpiry.toLocaleDateString()})`;
    }
  }

if (isAdminUser || isOwnerUser) {
  menu += `
╭══════════════════════════════════╮
│      ⚡ Qᴜɪᴄᴋ ᴀᴄᴛɪᴏɴꜱ ⚡         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ᴍᴏᴅᴇ     :: ᴜꜱᴇʀ ᴘᴀɴᴇʟ
│ ◇ ᴀᴄᴄᴇꜱꜱ   :: ʙᴀꜱɪᴄ
│
│ /ᴘᴀɪʀ       → ᴘᴀɪʀ ᴡʜᴀᴛꜱᴀᴘᴘ
│ /ᴜɴᴘᴀɪʀ     → ʀᴇᴍᴏᴠᴇ ꜱᴇꜱꜱɪᴏɴ
│ /ᴘɪɴɢ       → ʟᴀᴛᴇɴᴄʏ ᴄʜᴇᴄᴋ
│ /ʀᴜɴᴛɪᴍᴇ    → ꜱʏꜱᴛᴇᴍ ᴜᴘᴛɪᴍᴇ
│ /ꜱᴛᴀᴛꜱ      → ʙᴏᴛ ꜱᴛᴀᴛɪꜱᴛɪᴄꜱ
│ /ʀᴇᴘᴏʀᴛ     → ᴄᴏɴᴛᴀᴄᴛ ꜱᴜᴘᴘᴏʀᴛ
│ /ʜᴇʟᴘ       → ᴄᴏᴍᴍᴀɴᴅ ʟɪꜱᴛ
│
├──────────────────────────────────┤
│ 📡 ʀᴇᴀᴅʏ ꜰᴏʀ ᴄᴏᴍᴍᴀɴᴅꜱ
└──────────────────────────────────┘


╭══════════════════════════════════╮
│      🛠 ᴀᴅᴍɪɴ ᴄᴏɴᴛʀᴏʟ 🛠         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ᴍᴏᴅᴇ     :: ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ
│ ◇ ᴀᴄᴄᴇꜱꜱ   :: ᴇʟᴇᴠᴀᴛᴇᴅ
│
│ /ᴜꜱᴇʀꜱ        → ᴜꜱᴇʀ ʀᴇɢɪꜱᴛʀʏ
│ /ʟɪꜱᴛᴘᴀɪʀ     → ᴀᴄᴛɪᴠᴇ ꜱᴇꜱꜱɪᴏɴꜱ
│ /ʙʀᴏᴀᴅᴄᴀꜱᴛ    → ꜱʏꜱᴛᴇᴍ ᴀʟᴇʀᴛ
│ /ᴄʟᴇᴀɴ        → ᴘᴜʀɢᴇ ꜱᴇꜱꜱɪᴏɴꜱ
│ /ʙᴀɴ          → ʀᴇꜱᴛʀɪᴄᴛ ᴜꜱᴇʀ
│ /ᴜɴʙᴀɴ        → ʀᴇꜱᴛᴏʀᴇ ᴀᴄᴄᴇꜱꜱ
│ /ᴄʜᴇᴄᴋᴜꜱᴇʀ    → ᴜꜱᴇʀ ᴀᴜᴅɪᴛ
│ /ʟᴏɢꜱ         → ᴀᴜᴅɪᴛ ʟᴏɢꜱ
│ /ᴀɴɴᴏᴜɴᴄᴇ     → ꜱᴄʜᴇᴅᴜʟᴇᴅ ᴍꜱɢ
│
├──────────────────────────────────┤
│ ⚙ ᴀᴅᴍɪɴ ᴄᴏɴᴛʀᴏʟꜱ ᴇɴᴀʙʟᴇᴅ
└──────────────────────────────────┘


╭══════════════════════════════════╮
│      👑 ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅꜱ 👑       │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ᴍᴏᴅᴇ     :: ʀᴏᴏᴛ ᴀᴄᴄᴇꜱꜱ
│ ◇ ʟᴇᴠᴇʟ    :: ᴏᴡɴᴇʀ
│
│ /ᴀᴅᴅᴀᴅᴍɪɴ      → ᴀᴅᴅ ᴀᴅᴍɪɴ
│ /ʀᴇᴍᴏᴠᴇᴀᴅᴍɪɴ   → ʀᴇᴍᴏᴠᴇ ᴀᴅᴍɪɴ
│ /ʀᴇꜱᴛᴀʀᴛ       → ʀᴇꜱᴛᴀʀᴛ ʙᴏᴛ
│ /ᴛʀɪᴀʟꜱ
│
├──────────────────────────────────┤
│ ⚡ ꜰᴜʟʟ ꜱʏꜱᴛᴇᴍ ᴄᴏɴᴛʀᴏʟ
└──────────────────────────────────┘`;
  }

  menu += `
╭══════════════════════════════════╮
│        ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ⚡          │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱʏꜱᴛᴇᴍ   :: ᴄᴏʀᴇ ᴇɴɢɪɴᴇ
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ʀᴜɴɴɪɴɢ
│
│ 👤 ${SYSTEM.creator}
│
├──────────────────────────────────┤
│ ⚙ ᴇɴɢɪɴᴇ ɪɴɪᴛɪᴀʟɪᴢᴇᴅ
│ 📡 ᴅᴇᴠᴇʟᴏᴘᴇᴅ & ᴍᴀɪɴᴛᴀɪɴᴇᴅ
└──────────────────────────────────┘`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔗 ᴘᴀɪʀ', callback_data: 'pair_guide' },
        { text: '📖 ᴛᴜᴛᴏʀɪᴀʟ', callback_data: 'show_tutorial' },
        { text: '📊 sᴛᴀᴛs', callback_data: 'bot_stats' }
      ],
      [
        { text: '📢 ᴄʜᴀɴɴᴇʟ', url: SOCIAL.telegram.primary },
        { text: '👥 ɢʀᴏᴜᴘ', url: SOCIAL.telegram.group }
      ]
    ]
  };

  try {
    await bot.sendPhoto(chatId, ASSETS.menuImages[Math.floor(Math.random() * ASSETS.menuImages.length)], {
      caption: menu,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    await bot.sendMessage(chatId, menu, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

// ==================== MEMBERSHIP REQUIREMENT ====================

/**
 * Send membership required message
 */
const sendMembershipRequired = async (chatId, verification, userName) => {
  const greeting = getGreeting();
  
  const missingList = verification.missing.map(ch => `├◆ ❌ ${ch}`).join('\n');
  
  const message = `╭══════════════════════════════════╮
│     🔐 ᴠᴇʀɪꜰɪᴄᴀᴛɪᴏɴ ʀᴇQ 🔐      │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴘᴇɴᴅɪɴɢ
│ ◇ ᴀᴄᴄᴇꜱꜱ   :: ʟᴏᴄᴋᴇᴅ
│ ◇ ᴍᴏᴅᴇ     :: ᴠᴇʀɪꜰʏ
│
│ ${greeting.emoji} ʜᴇʟʟᴏ,
│ ${userName}
│
│ 📡 ᴊᴏɪɴ ᴀʟʟ ʀᴇQᴜɪʀᴇᴅ ᴄʜᴀɴɴᴇʟꜱ
│ ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ ᴜꜱɪɴɢ ꜱʏꜱᴛᴇᴍ
│
├──────────────────────────────────┤
│ 📡 ᴍɪꜱꜱɪɴɢ ᴄʜᴀɴɴᴇʟꜱ :
│
│ ${missingList}
│
├──────────────────────────────────┤
│ 📜 ɪɴꜱᴛʀᴜᴄᴛɪᴏɴꜱ :
│
│ ▸ ᴊᴏɪɴ ᴀʟʟ ᴄʜᴀɴɴᴇʟꜱ ᴀʙᴏᴠᴇ
│ ▸ ᴛʜᴇɴ ᴄʟɪᴄᴋ ᴠᴇʀɪꜰʏ ʙᴇʟᴏᴡ
│
├──────────────────────────────────┤
│ ⚠ ᴀᴄᴛɪᴏɴ ʀᴇQᴜɪʀᴇᴅ
│ 🔓 ᴀᴡᴀɪᴛɪɴɢ ᴠᴇʀɪꜰɪᴄᴀᴛɪᴏɴ
└──────────────────────────────────┘`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📢 ᴄʜᴀɴɴᴇʟ 1', url: SOCIAL.telegram.primary },
      ],
      [
        { text: '👥 ɢʀᴏᴜᴘ', url: SOCIAL.telegram.group },
      ],
      [{ text: '✅ ᴠᴇʀɪғʏ', callback_data: 'verify_membership' }]
    ]
  };

  try {
    await bot.sendVideo(chatId, ASSETS.pairingVideos[0], {
      caption: message,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch {
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

// ==================== COMMAND: START ====================

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'ᴜsᴇʀ';
  const isGroup = msg.chat.type !== 'private';

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `╭══════════════════════════════════╮
│       ⏳ ʀᴀᴛᴇ ʟɪᴍɪᴛᴇᴅ ⏳         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ    :: ᴛʜʀᴏᴛᴛʟᴇᴅ
│ ◇ ʀᴇQᴜᴇꜱᴛꜱ  :: ᴇxᴄᴇᴇᴅᴇᴅ
│
│ ⚠ ᴛᴏᴏ ᴍᴀɴʏ ʀᴇQᴜᴇꜱᴛꜱ
│
│ ⏳ ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ ᴀ ᴍᴏᴍᴇɴᴛ
│ ʙᴇꜰᴏʀᴇ ᴛʀʏɪɴɢ ᴀɢᴀɪɴ
│
├──────────────────────────────────┤
│ 🔁 ꜱʏꜱᴛᴇᴍ ᴄᴏᴏʟᴅᴏᴡɴ ᴀᴄᴛɪᴠᴇ
└──────────────────────────────────┘`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;
  await trackUser(userId, userName, isGroup);

  if (isGroup) {
    return handleGroupMessage(msg);
  }

  // Check channel membership for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    const verification = await verifyMembership(userId);
    if (!verification.verified) {
      return sendMembershipRequired(chatId, verification, userName);
    }
  }

  await sendMainMenu(chatId, userId, userName, isAdmin(userId.toString()), isOwner(userId));
});

// ==================== COMMAND: PAIR ====================

bot.onText(/\/pair(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;
  const isGroup = msg.chat.type !== 'private';

  // Maintenance check
  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔧 MAINTENANCE MODE 🔧┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ▸ STATUS: ACTIVE
┃ ▸ SYSTEM: PAUSED
┃
┃ ⚠ Bot Under Maintenance
┃
┃ Please try again later
┃
┃ ────────────────
┃ 🛠 Updates in progress
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⏳ RATE LIMITED ⏳   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ▸ STATUS: ACTIVE
┃ ▸ SYSTEM: OVERLOADED
┃
┃ ⚠ Too many requests
┃
┃ Please wait and retry
┃ after cooldown
┃
┃ ────────────────
┃ 🔁 Throttle protection on
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (isGroup) {
    return handleGroupMessage(msg);
  }

  // Check channel membership for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    const verification = await verifyMembership(userId);
    if (!verification.verified) {
      return sendMembershipRequired(chatId, verification, msg.from.first_name);
    }
  }

  // NEW: Check premium access for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│         🔗 ᴘᴀɪʀ ɢᴜɪᴅᴇ 🔗         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ʀᴇᴀᴅʏ
│ ◇ ᴍᴏᴅᴇ     :: ᴡʜᴀᴛꜱᴀᴘᴘ ᴘᴀɪʀ
│
│ 📌 ᴜꜱᴀɢᴇ :
│ /ᴘᴀɪʀ 923078071982
│
│ 📌 ᴡɪᴛʜ ᴄᴏᴅᴇ :
│ /ᴘᴀɪʀ 923078071982|1234
│
├──────────────────────────────────┤
│ ⚡ ᴇɴᴛᴇʀ ɴᴜᴍʙᴇʀ ᴛᴏ ʙᴇɢɪɴ
│ ᴘᴀɪʀɪɴɢ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  const validation = validatePhone(input);
  if (!validation.valid) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│      ❌ ɪɴᴠᴀʟɪᴅ ɪɴᴘᴜᴛ ❌         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴇʀʀᴏʀ
│ ◇ ᴛʏᴘᴇ     :: ᴠᴀʟɪᴅᴀᴛɪᴏɴ
│
│ ⚠ ${validation.error}
│
├──────────────────────────────────┤
│ 🔁 ᴘʟᴇᴀꜱᴇ ᴄʜᴇᴄᴋ ʏᴏᴜʀ ɪɴᴘᴜᴛ
│ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  const [number, customCode] = input.split('|');
  const cleanNumber = number.replace(/[^0-9]/g, '');

  const sessions = await getSessions();
  if (sessions.length >= SYSTEM.sessionLimit) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│      🚫 ʟɪᴍɪᴛ ʀᴇᴀᴄʜᴇᴅ 🚫         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ꜰᴜʟʟ
│ ◇ ꜱʏꜱᴛᴇᴍ   :: ʙᴜꜱʏ
│
│ ⚠ ᴍᴀxɪᴍᴜᴍ ꜱᴇꜱꜱɪᴏɴꜱ ʀᴇᴀᴄʜᴇᴅ
│
│ ⏳ ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ
│
├──────────────────────────────────┤
│ 🔒 ᴄᴀᴘᴀᴄɪᴛʏ ʟɪᴍɪᴛ ᴇɴꜰᴏʀᴄᴇᴅ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  if (sessions.includes(`${cleanNumber}@s.whatsapp.net`)) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│     🔁 ꜱᴇꜱꜱɪᴏɴ ᴇxɪꜱᴛꜱ 🔁        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴀᴄᴛɪᴠᴇ
│ ◇ ᴛʏᴘᴇ     :: ᴅᴜᴘʟɪᴄᴀᴛᴇ
│
│ ⚠ ꜱᴇꜱꜱɪᴏɴ ᴀʟʀᴇᴀᴅʏ ᴇxɪꜱᴛꜱ
│
│ 📌 ᴜꜱᴇ ᴄᴏᴍᴍᴀɴᴅ ʙᴇʟᴏᴡ :
│ /ᴜɴᴘᴀɪʀ ${cleanNumber}
│
├──────────────────────────────────┤
│ 🔒 ᴅᴜᴘʟɪᴄᴀᴛᴇ ꜱᴇꜱꜱɪᴏɴ ʙʟᴏᴄᴋᴇᴅ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  if (database.activeSessions.has(cleanNumber)) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│       🔄 ɪɴ ᴘʀᴏɢʀᴇꜱꜱ 🔄         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ʀᴜɴɴɪɴɢ
│ ◇ ᴍᴏᴅᴇ     :: ᴘᴀɪʀɪɴɢ
│
│ ⚠ ᴘᴀɪʀɪɴɢ ᴀʟʀᴇᴀᴅʏ ɪɴ ᴘʀᴏɢʀᴇꜱꜱ
│
│ ⏳ ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ
│
├──────────────────────────────────┤
│ ⚙ ꜱʏꜱᴛᴇᴍ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʀᴇQᴜᴇꜱᴛ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  const processingMsg = await bot.sendMessage(chatId,
    `╭══════════════════════════════════╮
│     🔄 ᴘᴀɪʀɪɴɢ ᴀᴄᴛɪᴠᴇ 🔄        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴄᴏɴɴᴇᴄᴛɪɴɢ
│ ◇ ᴍᴏᴅᴇ     :: ᴡʜᴀᴛꜱᴀᴘᴘ ʟɪɴᴋ
│
│ ⠋ ᴄᴏɴɴᴇᴄᴛɪɴɢ ᴛᴏ ᴡʜᴀᴛꜱᴀᴘᴘ
│
│ 📱 ɴᴜᴍʙᴇʀ :
│ +${cleanNumber}
│
├──────────────────────────────────┤
│ ⚙ ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ...
└──────────────────────────────────┘`,
    { parse_mode: 'Markdown' }
  );

  database.activeSessions.set(cleanNumber, {
    chatId,
    userId,
    startTime: Date.now(),
    messageId: processingMsg.message_id
  });

  const dots = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const loadingInterval = setInterval(async () => {
    try {
      await bot.editMessageText(
        `╭══════════════════════════════════╮
│     🔄 ᴘᴀɪʀɪɴɢ ᴀᴄᴛɪᴠᴇ 🔄        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴄᴏɴɴᴇᴄᴛɪɴɢ
│ ◇ ᴍᴏᴅᴇ     :: ᴡʜᴀᴛꜱᴀᴘᴘ ʟɪɴᴋ
│
│ ${dots[i]} ᴄᴏɴɴᴇᴄᴛɪɴɢ ᴛᴏ ᴡʜᴀᴛꜱᴀᴘᴘ
│
│ 📱 ɴᴜᴍʙᴇʀ :
│ +${cleanNumber}
│
├──────────────────────────────────┤
│ ⚙ ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ...
└──────────────────────────────────┘`,
        {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'Markdown'
        }
      );
      i = (i + 1) % dots.length;
    } catch (e) {}
  }, 300);

  try {
    const pairModule = require('./pair');
    const jid = cleanNumber + '@s.whatsapp.net';
    await pairModule(jid);
    await sleep(4000);
    
    clearInterval(loadingInterval);

    const pairingFile = path.join(__dirname, 'nexstore', 'pairing', 'pairing.json');
    
    if (!await fileExists(pairingFile)) {
      throw new Error('ᴘᴀɪʀɪɴɢ.json ɴᴏᴛ ғᴏᴜɴᴅ');
    }
    
    const cu = await fs.readFile(pairingFile, 'utf-8');
    const cuObj = JSON.parse(cu);
    const code = customCode || cuObj.code;

    delete require.cache[require.resolve('./pair')];

    // Save to owner.json
    const ownerPath = path.join(__dirname, 'allfunc', 'owner.json');
    let ownerData = [];

    try {
      const ownerFile = await fs.readFile(ownerPath, 'utf-8');
      ownerData = JSON.parse(ownerFile);
    } catch (err) {
      console.log("⚠️ ᴄʀᴇᴀᴛɪɴɢ ɴᴇᴡ ᴏᴡɴᴇʀ.ᴊsᴏɴ");
      ownerData = [];
    }

    const senderNumber = cleanNumber;
    const whatsappFormat = senderNumber + "@s.whatsapp.net";
    const lidFormat = senderNumber + "@lid";

    let updated = false;
    if (!ownerData.includes(whatsappFormat)) {
      ownerData.push(whatsappFormat);
      updated = true;
    }
    if (!ownerData.includes(lidFormat)) {
      ownerData.push(lidFormat);
      updated = true;
    }

    if (updated) {
      await fs.writeFile(ownerPath, JSON.stringify(ownerData, null, 2));
    }

    database.stats.totalConnections++;
    database.stats.dailyConnections++;
    database.stats.pairingSpeed.push(Date.now() - database.activeSessions.get(cleanNumber).startTime);
    if (database.stats.pairingSpeed.length > 100) database.stats.pairingSpeed.shift();
    
    if (database.userDetails[userId]) {
      database.userDetails[userId].pairs++;
    }
    
    await saveData();

    await bot.editMessageText(
      `╭══════════════════════════════════╮
│    🔗 ᴘᴀɪʀɪɴɢ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟ 🔗     │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴄᴏᴍᴘʟᴇᴛᴇᴅ
│ ◇ ʀᴇꜱᴜʟᴛ   :: ꜱᴜᴄᴄᴇꜱꜱ
│
│ ✅ ᴄᴏɴɴᴇᴄᴛɪᴏɴ ᴇꜱᴛᴀʙʟɪꜱʜᴇᴅ
│
├──────────────────────────────────┤
│ 🔐 ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ :
│
│ ${code}
│
├──────────────────────────────────┤
│ 📜 ɪɴꜱᴛʀᴜᴄᴛɪᴏɴꜱ :
│
│ 1. ᴏᴘᴇɴ ᴡʜᴀᴛꜱᴀᴘᴘ
│ 2. ɢᴏ ᴛᴏ ꜱᴇᴛᴛɪɴɢꜱ
│ 3. ᴛᴀᴘ “ʟɪɴᴋᴇᴅ ᴅᴇᴠɪᴄᴇꜱ”
│ 4. ꜱᴇʟᴇᴄᴛ “ʟɪɴᴋ ᴀ ᴅᴇᴠɪᴄᴇ”
│ 5. ᴇɴᴛᴇʀ ᴛʜᴇ ᴄᴏᴅᴇ ᴀʙᴏᴠᴇ
│
├──────────────────────────────────┤
│ ⚡ ᴄᴏᴅᴇ ᴇxᴘɪʀᴇꜱ ɪɴ 5 ᴍɪɴᴜᴛᴇꜱ
└──────────────────────────────────┘`,
      {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 ᴄᴏᴘʏ ᴄᴏᴅᴇ', callback_data: `copy_${code}` }],
            [
              { text: '📖 ᴛᴜᴛᴏʀɪᴀʟ', callback_data: 'show_tutorial' },
              { text: '🏠 ᴍᴇɴᴜ', callback_data: 'show_main' }
            ]
          ]
        }
      }
    );

    addAuditLog('ᴘᴀɪʀ', userId, cleanNumber);
    setTimeout(() => database.activeSessions.delete(cleanNumber), SYSTEM.codeExpiry);

  } catch (error) {
    clearInterval(loadingInterval);
    database.activeSessions.delete(cleanNumber);
    database.stats.failures++;
    await saveData();

    await bot.editMessageText(
      `╭══════════════════════════════════╮
│      ❌ ᴘᴀɪʀɪɴɢ ꜰᴀɪʟᴇᴅ ❌        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ᴇʀʀᴏʀ
│ ◇ ʀᴇꜱᴜʟᴛ   :: ᴜɴꜱᴜᴄᴄᴇꜱꜱꜰᴜʟ
│
│ ⚠ ${error.message}
│
├──────────────────────────────────┤
│ 🔁 ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ
│ ᴀɴᴅ ᴄʜᴇᴄᴋ ʏᴏᴜʀ ᴅᴇᴛᴀɪʟꜱ
└──────────────────────────────────┘`,
      {
        chat_id: chatId,
        message_id: processingMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 ʀᴇᴘᴏʀᴛ', callback_data: 'show_report' }]
          ]
        }
      }
    );
  }
});

// ==================== COMMAND: UNPAIR ====================

bot.onText(/\/unpair(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔧 MAINTENANCE MODE 🔧┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ▸ STATUS: ACTIVE
┃ ▸ SYSTEM: OFFLINE
┃
┃ ⚠ Bot is under maintenance
┃
┃ ────────────────
┃ 🔧 Please try again later
┃
┃ ⚙ Updates in progress
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⏳ RATE LIMITED ⏳   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ▸ STATUS: THROTTLED
┃ ▸ SYSTEM: BUSY
┃
┃ ⚠ Too many requests
┃
┃ Please wait
┃
┃ ────────────────
┃ 🔁 Cooldown active
┃ ⚙ Try again shortly
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  // NEW: Check premium access for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│        🔓 ᴜɴᴘᴀɪʀ ɢᴜɪᴅᴇ          │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ᴄᴏᴍᴍᴀɴᴅ  :: /ᴜɴᴘᴀɪʀ
│ ◇ ꜰᴏʀᴍᴀᴛ   :: /ᴜɴᴘᴀɪʀ 923078071982
│
│ ⚠ ᴜꜱᴇ ᴄᴏʀʀᴇᴄᴛ ɴᴜᴍʙᴇʀ ꜰᴏʀᴍᴀᴛ
│ ⚠ ꜱᴇꜱꜱɪᴏɴ ᴡɪʟʟ ʙᴇ ʀᴇᴍᴏᴠᴇᴅ
│
├──────────────────────────────────┤
│ 🔁 ꜱʏꜱᴛᴇᴍ ᴀᴄᴛɪᴏɴ :: ᴀᴄᴛɪᴠᴇ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  const validation = validatePhone(input);
  if (!validation.valid) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│      ❌ ɪɴᴠᴀʟɪᴅ ɪɴᴘᴜᴛ ❌         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ꜰᴀɪʟᴇᴅ
│ ◇ ꜱʏꜱᴛᴇᴍ   :: ᴠᴀʟɪᴅᴀᴛɪᴏɴ ᴇʀʀᴏʀ
│
│ ⚠ ${validation.error}
│
│ 🔁 ᴘʟᴇᴀꜱᴇ ᴄʜᴇᴄᴋ ʏᴏᴜʀ ɪɴᴘᴜᴛ
│ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ ᴄᴏʀʀᴇᴄᴛʟʏ
│
├──────────────────────────────────┤
│ ⚙ ɪɴᴘᴜᴛ ᴄʜᴇᴄᴋᴇʀ ᴀᴄᴛɪᴠᴇ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  const cleanNumber = input.split('|')[0].replace(/[^0-9]/g, '');

  if (await deleteSession(cleanNumber)) {
    database.activeSessions.delete(cleanNumber);
    addAuditLog('ᴜɴᴘᴀɪʀ', userId, cleanNumber);
    
    bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│     🗑 ꜱᴇꜱꜱɪᴏɴ ʀᴇᴍᴏᴠᴇᴅ 🗑      │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ     :: ꜱᴜᴄᴄᴇꜱꜱ
│ ◇ ᴏᴘᴇʀᴀᴛɪᴏɴ  :: ᴜɴᴘᴀɪʀ
│
│ 📱 ɴᴜᴍʙᴇʀ :
│ +${cleanNumber}
│
│ ✔ ꜱᴇꜱꜱɪᴏɴ :: ᴄʟᴇᴀʀᴇᴅ
│
├──────────────────────────────────┤
│ 🔁 ᴅᴇᴠɪᴄᴇ ʟɪɴᴋ ʀᴇᴍᴏᴠᴇᴅ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  } else {
    bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│         🔍 ɴᴏᴛ ꜰᴏᴜɴᴅ            │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ꜰᴀɪʟᴇᴅ
│ ◇ ꜱʏꜱᴛᴇᴍ   :: ꜱᴇᴀʀᴄʜ ʀᴇꜱᴜʟᴛ
│
│ ⚠ ɴᴏ ꜱᴇꜱꜱɪᴏɴ ꜰᴏᴜɴᴅ
│ 📱 ɴᴜᴍʙᴇʀ :
│ +${cleanNumber}
│
├──────────────────────────────────┤
│ 🔁 ᴠᴇʀɪꜰʏ ɪɴᴘᴜᴛ & ʀᴇᴛʀʏ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ==================== PREMIUM COMMANDS ====================

/**
 * /addprem <user_id> <duration> - Add premium access
 */
bot.onText(/\/addprem(?:\s+(\d+)\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;
  const durationStr = match ? match[2] : null;

  // Admin only check
  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, 
      `╭══════════════════════════════════╮
│        ⛔ ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ ⛔        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ʙʟᴏᴄᴋᴇᴅ
│ ◇ ꜱʏꜱᴛᴇᴍ   :: ᴘᴇʀᴍɪꜱꜱɪᴏɴ ᴇʀʀᴏʀ
│
│ ⚠ ᴀᴅᴍɪɴ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ
│ 🔐 ᴀᴄᴄᴇꜱꜱ ʀᴇꜱᴛʀɪᴄᴛᴇᴅ
│
├──────────────────────────────────┤
│ 🔁 ᴀᴜᴛʜ ᴄʜᴇᴄᴋ ꜰᴀɪʟᴇᴅ
└──────────────────────────────────┘`, 
      { parse_mode: 'Markdown' }
    );
  }

  if (!targetId || !durationStr) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   💎 ADD PREMIUM      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ▸ STATUS: GUIDE MODE
┃ ▸ SYSTEM: PREMIUM CTRL
┃
┃ 📌 USAGE:
┃ /addprem <user_id> <duration>
┃
┃ 📎 EXAMPLES:
┃ /addprem 123456789 3 days
┃ /addprem 123456789 1 week
┃ /addprem 123456789 24 hours
┃
┃ ────────────────
┃ ⚡ PREMIUM SYSTEM ACTIVE
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⏳ RATE LIMITED ⏳   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ▸ STATUS: ACTIVE
┃ ▸ SYSTEM: OVERLOADED
┃
┃ ⚠ Too many requests
┃
┃ Please wait and retry
┃ after cooldown
┃
┃ ────────────────
┃ 🔁 Throttle protection on
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  const expiry = Date.now() + durationMs;
  
  // Add to premium database
  database.premium[targetId] = {
    expiry: expiry,
    addedBy: userId.toString(),
    addedAt: Date.now()
  };

  await saveData();

  // Notify admin
  await bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💎 PREMIUM ADDED 💎   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ✔ STATUS: SUCCESS
┃
┃ 👤 USER ID: ${targetId}
┃ ⏱️ DURATION: ${durationStr}
┃ 📅 EXPIRES: ${new Date(expiry).toLocaleString()}
┃
┃ ⚡ PREMIUM ACTIVATED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  // Notify user
  try {
    await bot.sendMessage(targetId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🎉 CONGRATULATIONS 🎉  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ✔ PREMIUM ACTIVATED
┃
┃ 👤 STATUS: PREMIUM USER
┃ 👑 ACCESS: UNLIMITED
┃ ⏱️ DURATION: ${durationStr}
┃ 📅 EXPIRES: ${new Date(expiry).toLocaleString()}
┃
┃ 🚀 ENJOY ALL FEATURES
┗━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     🙏 THANK YOU 🙏     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ✨ ENJOY PREMIUM ACCESS
┃
┃ ⚡ NEXA V5 SYSTEM ACTIVE
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    // User might have blocked the bot, ignore
  }

  addAuditLog('ᴀᴅᴅᴘʀᴇᴍ', userId, targetId, { duration: durationStr, expiry });
});

/**
 * /delprem <user_id> - Remove premium access
 */
bot.onText(/\/delprem(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;

  // Admin only check
  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, 
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED ⛔   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 RESTRICTED AREA
┃
┃ 👮 ADMIN ONLY COMMAND
┃
┃ ⚠ You don’t have permission
┃ to execute this action
┃
┃ ────────────────
┃ 🔒 Security system active
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, 
      { parse_mode: 'Markdown' }
    );
  }

  if (!targetId) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 💎 DEL PREMIUM GUIDE 💎 ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 USAGE:
┃ /delprem <user_id>
┃
┃ 📍 EXAMPLE:
┃ /delprem 123456789
┃
┃ ⚠ This removes premium access
┃ from the selected user
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!database.premium[targetId]) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     ⚠ NOT FOUND ⚠     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ❌ USER NOT PREMIUM
┃
┃ 📌 STATUS: NO PREMIUM DATA
┃
┃ ⚠ This user is not in the
┃ premium database
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  // Remove from premium
  delete database.premium[targetId];
  await saveData();

  // Notify admin
  await bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   💔 PREMIUM REMOVED   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ✔ STATUS: SUCCESS
┃
┃ 👤 USER ID: ${targetId}
┃
┃ ⚡ PREMIUM ACCESS REVOKED
┃ 🔒 USER DOWNGRADED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  // Notify user
  try {
    await bot.sendMessage(targetId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⏳ PREMIUM EXPIRED   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: INACTIVE
┃
┃ 💔 YOUR PREMIUM ACCESS
┃ HAS BEEN REMOVED
┃
┃ 📞 CONTACT DEVELOPER
┃ FOR RENEWAL
┃
┃ ────────────────
┃ 🔒 ACCESS DOWNGRADED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    // User might have blocked the bot, ignore
  }

  addAuditLog('ᴅᴇʟᴘʀᴇᴍ', userId, targetId);
});

/**
 * /trials <duration> - Enable trial mode for everyone
 */
bot.onText(/\/trials(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const durationStr = match ? match[1] : null;

  // Admin only check
  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, 
      `╭══════════════════════════════════╮
│        ⛔ ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ ⛔        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 🚫 ʀᴇꜱᴛʀɪᴄᴛᴇᴅ ᴄᴏᴍᴍᴀɴᴅ
│
│ 👮 ᴀᴅᴍɪɴ ᴏɴʟʏ ᴀᴄᴄᴇꜱꜱ
│
│ ⚠ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴀᴜᴛʜᴏʀɪᴢᴇᴅ
│ ᴛᴏ ᴜꜱᴇ ᴛʜɪꜱ ꜰᴇᴀᴛᴜʀᴇ
│
├──────────────────────────────────┤
│ 🔒 ꜱᴇᴄᴜʀɪᴛʏ ʟᴏᴄᴋᴇᴅ
└──────────────────────────────────┘`, 
      { parse_mode: 'Markdown' }
    );
  }

  if (!durationStr) {
    const status = database.trialMode.active ? 
      `ᴀᴄᴛɪᴠᴇ ✅ (ᴇxᴘɪʀᴇs: ${new Date(database.trialMode.expiry).toLocaleString()})` : 
      'ɪɴᴀᴄᴛɪᴠᴇ ❌';
    
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│      🧪 ᴛʀɪᴀʟ ᴍᴏᴅᴇ ɢᴜɪᴅᴇ       │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ◇ ꜱᴛᴀᴛᴜꜱ   :: ${status}
│
│ 📌 ᴜꜱᴀɢᴇ :
│ /ᴛʀɪᴀʟꜱ <duration>
│
│ 📍 ᴇxᴀᴍᴘʟᴇꜱ :
│ /ᴛʀɪᴀʟꜱ 3 ᴅᴀʏꜱ
│ /ᴛʀɪᴀʟꜱ 1 ᴡᴇᴇᴋ
│ /ᴛʀɪᴀʟꜱ 24 ʜᴏᴜʀꜱ
│
├──────────────────────────────────┤
│ ⚡ ᴇɴᴅ ᴛʀɪᴀʟ ᴇᴀʀʟʏ :
│ /ᴛʀɪᴀʟꜱ ᴇɴᴅ
│
├──────────────────────────────────┤
│ 🔓 ᴛᴇᴍᴘᴏʀᴀʀʏ ᴀᴄᴄᴇꜱꜱ ꜱʏꜱᴛᴇᴍ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  // Handle early end
  if (durationStr.toLowerCase() === 'ᴇɴᴅ') {
    database.trialMode.active = false;
    database.trialMode.expiry = null;
    database.trialMode.startedBy = null;
    database.trialMode.startedAt = null;
    await saveData();

    await bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│     🧪 ᴛʀɪᴀʟ ᴍᴏᴅᴇ ᴇɴᴅᴇᴅ       │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ⛔ ꜱᴛᴀᴛᴜꜱ   :: ᴇxᴘɪʀᴇᴅ
│
│ ⚠ ᴛʀɪᴀʟ ᴘᴇʀɪᴏᴅ ʜᴀꜱ ᴇɴᴅᴇᴅ
│
│ 🔒 ʙᴏᴛ ʀᴇꜱᴛʀɪᴄᴛᴇᴅ ᴛᴏ ᴘʀᴇᴍɪᴜᴍ ᴏɴʟʏ
│
├──────────────────────────────────┤
│ 📌 ᴘʟᴇᴀꜱᴇ ᴜᴘɢʀᴀᴅᴇ ᴛᴏ ᴄᴏɴᴛɪɴᴜᴇ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );

    addAuditLog('ᴛʀɪᴀʟ_ᴇɴᴅ', userId);
    return;
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│     ❗ ɪɴᴠᴀʟɪᴅ ᴅᴜʀᴀᴛɪᴏɴ ❗       │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ⚠ ꜰᴏʀᴍᴀᴛ ᴇʀʀᴏʀ
│
│ 📌 ᴠᴀʟɪᴅ ꜰᴏʀᴍᴀᴛꜱ :
│ • 3 ᴅᴀʏꜱ
│ • 1 ᴡᴇᴇᴋ
│ • 24 ʜᴏᴜʀꜱ
│
├──────────────────────────────────┤
│ 🔁 ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ᴄᴏʀʀᴇᴄᴛʟʏ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  const expiry = Date.now() + durationMs;

  // Enable trial mode
  database.trialMode = {
    active: true,
    expiry: expiry,
    startedBy: userId.toString(),
    startedAt: Date.now()
  };

  await saveData();

  // Notify admin
  await bot.sendMessage(chatId,
    `╭══════════════════════════════════╮
│    🧪 ᴛʀɪᴀʟ ᴍᴏᴅᴇ ᴇɴᴀʙʟᴇᴅ       │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 🎉 ꜱᴛᴀᴛᴜꜱ   :: ᴀᴄᴛɪᴠᴇ
│
│ ⏱️ ᴅᴜʀᴀᴛɪᴏɴ :
│ ${durationStr}
│
│ 📅 ᴇxᴘɪʀᴇꜱ :
│ ${new Date(expiry).toLocaleString()}
│
│ 👥 ᴀᴄᴄᴇꜱꜱ :: ᴛᴇᴍᴘᴏʀᴀʀʏ ᴏᴘᴇɴ
│
├──────────────────────────────────┤
│ ⚡ ᴛʀɪᴀʟ ꜱʏꜱᴛᴇᴍ ᴏɴʟɪɴᴇ
└──────────────────────────────────┘`,
    { parse_mode: 'Markdown' }
  );

  // Broadcast to all users
  const broadcastMsg = `╭══════════════════════════════════╮
│    🎉 ᴛʀɪᴀʟ ᴀᴄᴛɪᴠᴀᴛᴇᴅ 🎉        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 🚀 ꜱᴛᴀᴛᴜꜱ   :: ᴏɴʟɪɴᴇ
│
│ 📢 ʙᴏᴛ ɪꜱ ɴᴏᴡ ꜰʀᴇᴇ ᴀᴄᴄᴇꜱꜱ
│ ꜰᴏʀ ᴀʟʟ ᴜꜱᴇʀꜱ
│
│ ⏱️ ᴅᴜʀᴀᴛɪᴏɴ :
│ ${durationStr}
│
│ 📅 ᴇxᴘɪʀᴇꜱ :
│ ${new Date(expiry).toLocaleString()}
│
├──────────────────────────────────┤
│ ⚡ ᴇɴᴊᴏʏ ꜰʀᴇᴇ ᴘᴀɪʀɪɴɢ
└──────────────────────────────────┘`;

  // Send to all users (limited to avoid rate limits)
  let sent = 0;
  for (const user of [...database.users].slice(0, 100)) {
    try {
      await bot.sendMessage(user, broadcastMsg, { parse_mode: 'Markdown' });
      sent++;
      await sleep(100);
    } catch (e) {}
  }

  await bot.sendMessage(chatId,
    `╭══════════════════════════════════╮
│     📢 ʙʀᴏᴀᴅᴄᴀꜱᴛ ʀᴇꜱᴜʟᴛ        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ✔ ꜱᴛᴀᴛᴜꜱ   :: ᴄᴏᴍᴘʟᴇᴛᴇᴅ
│
│ 👥 ꜱᴇɴᴛ ᴛᴏ :
│ ${sent} ᴜꜱᴇʀꜱ
│
│ 📡 ɴᴏᴛɪꜰɪᴄᴀᴛɪᴏɴ
│ ᴅᴇʟɪᴠᴇʀᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ
│
├──────────────────────────────────┤
│ ⚡ ꜱʏꜱᴛᴇᴍ ʙʀᴏᴀᴅᴄᴀꜱᴛ ᴅᴏɴᴇ
└──────────────────────────────────┘`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴛʀɪᴀʟ_ꜱᴛᴀʀᴛ', userId, null, { duration: durationStr, expiry });
});

/**
 * /premlist - List all premium users
 */
bot.onText(/\/premlist/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, 
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED ⛔   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 RESTRICTED COMMAND
┃
┃ 👮 ADMIN ONLY ACCESS
┃
┃ ⚠ You are not authorized
┃ to perform this action
┃
┃ ────────────────
┃ 🔒 SECURITY BLOCK ACTIVE
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, 
      { parse_mode: 'Markdown' }
    );
  }

  const premiumUsers = Object.entries(database.premium)
    .filter(([_, data]) => data.expiry > Date.now())
    .map(([id, data]) => ({
      id,
      expiry: new Date(data.expiry).toLocaleString(),
      addedBy: data.addedBy,
      addedAt: new Date(data.addedAt).toLocaleString()
    }));

  if (premiumUsers.length === 0) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 💎 NO PREMIUM USERS   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: EMPTY LIST
┃
┃ ❌ NO ACTIVE PREMIUM USERS
┃ FOUND IN DATABASE
┃
┃ ────────────────
┃ 📌 SYSTEM HAS NO RECORDS
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  let listText = `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 💎 PREMIUM USERS LIST ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 👥 TOTAL: ${premiumUsers.length}
┃
┃ 📊 STATUS: ACTIVE DATABASE
┃
┃ ────────────────
┃ ⚡ PREMIUM SYSTEM LOADED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`;

  premiumUsers.slice(0, 20).forEach((user, index) => {
    listText += `├◆ ${index + 1}. ɪᴅ: ${user.id}\n`;
    listText += `├◆    ⏱️ ᴇxᴘɪʀʏ: ${user.expiry}\n`;
    if (index < premiumUsers.length - 1) listText += `│\n`;
  });

  if (premiumUsers.length > 20) {
    listText += `├◆ ... ᴀɴᴅ ${premiumUsers.length - 20} ᴍᴏʀᴇ\n`;
  }

  listText += `└ ❏`;

  bot.sendMessage(chatId, listText, { parse_mode: 'Markdown' });
});

// ==================== COMMAND: PING ====================

bot.onText(/\/ping/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const start = Date.now();

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔧 MAINTENANCE MODE   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: ACTIVE
┃
┃ 🔧 BOT IS UNDER MAINTENANCE
┃
┃ ⏳ PLEASE TRY AGAIN LATER
┃
┃ ────────────────
┃ 🔒 SYSTEM TEMPORARILY OFFLINE
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⏳ RATE LIMIT ⏳     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: ACTIVE
┃
┃ 🚫 TOO MANY REQUESTS
┃
┃ ⏳ PLEASE WAIT
┃ BEFORE TRYING AGAIN
┃
┃ ────────────────
┃ 🔁 THROTTLE PROTECTION ON
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  // NEW: Check premium access for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  const sentMsg = await bot.sendMessage(chatId,
    `╭══════════════════════════════════╮
│        📡 ᴘɪɴɢ ᴛᴇꜱᴛ 📡          │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ⚙ ꜱᴛᴀᴛᴜꜱ   :: ʀᴜɴɴɪɴɢ
│
│ ⏳ ᴍᴇᴀꜱᴜʀɪɴɢ ʟᴀᴛᴇɴᴄʏ...
│
├──────────────────────────────────┤
│ 🔄 ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ
└──────────────────────────────────┘`,
    { parse_mode: 'Markdown' }
  );

  const latency = Date.now() - start;
  const status = latency < 500 ? 'ᴇxᴄᴇʟʟᴇɴᴛ' : latency < 1000 ? 'ɢᴏᴏᴅ' : 'sʟᴏᴡ';
  const emoji = latency < 500 ? '🟢' : latency < 1000 ? '🟡' : '🔴';

  await bot.editMessageText(
    `╭══════════════════════════════════╮
│           📡 ᴘᴏɴɢ! 📡            │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ⚡ ʀᴇꜱᴘᴏɴꜱᴇ ʀᴇᴄᴇɪᴠᴇᴅ
│
│ 📶 ʟᴀᴛᴇɴᴄʏ :
│ ${latency}ᴍꜱ
│
│ ${emoji} ꜱᴛᴀᴛᴜꜱ :
│ ${status}
│
├──────────────────────────────────┤
│ 🚀 ᴄᴏɴɴᴇᴄᴛɪᴏɴ ꜱᴛᴀʙʟᴇ
└──────────────────────────────────┘`,
    {
      chat_id: chatId,
      message_id: sentMsg.message_id,
      parse_mode: 'Markdown'
    }
  );
});

// ==================== COMMAND: RUNTIME ====================

bot.onText(/\/runtime/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔧 MAINTENANCE MODE   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: ACTIVE
┃
┃ 🔧 BOT IS UNDER MAINTENANCE
┃
┃ ⏳ PLEASE TRY AGAIN LATER
┃
┃ ────────────────
┃ 🔒 SYSTEM TEMPORARILY OFFLINE
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⏳ RATE LIMIT ⏳     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: ACTIVE
┃
┃ 🚫 TOO MANY REQUESTS
┃
┃ ⏳ PLEASE WAIT
┃ BEFORE TRYING AGAIN
┃
┃ ────────────────
┃ 🔁 THROTTLE PROTECTION ON
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  // NEW: Check premium access for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  const uptime = formatUptime(Date.now() - database.stats.startTime);
  const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  const cpu = os.loadavg()[0].toFixed(2);

  bot.sendMessage(chatId,
    `╭══════════════════════════════════╮
│      ⚙ ꜱʏꜱᴛᴇᴍ ʀᴜɴᴛɪᴍᴇ          │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 📡 ꜱᴛᴀᴛᴜꜱ   :: ᴏɴʟɪɴᴇ
│
│ ⏱️ ᴜᴘᴛɪᴍᴇ :
│ ${uptime}
│
│ 💾 ᴍᴇᴍᴏʀʏ :
│ ${memory}ᴍʙ
│
│ ⚙️ ᴄᴘᴜ :
│ ${cpu}%
│
│ 💻 ᴘʟᴀᴛꜰᴏʀᴍ :
│ ${os.platform()}
│
├──────────────────────────────────┤
│ 🚀 ꜱʏꜱᴛᴇᴍ ꜱᴛᴀʙʟᴇ
└──────────────────────────────────┘`,
    { parse_mode: 'Markdown' }
  );
});

// ==================== COMMAND: STATS ====================

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔧 MAINTENANCE MODE   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: ACTIVE
┃
┃ 🔧 BOT IS UNDER MAINTENANCE
┃
┃ ⏳ PLEASE TRY AGAIN LATER
┃
┃ ────────────────
┃ 🔒 SYSTEM TEMPORARILY OFFLINE
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⏳ RATE LIMIT ⏳     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: ACTIVE
┃
┃ 🚫 TOO MANY REQUESTS
┃
┃ ⏳ PLEASE WAIT
┃ BEFORE TRYING AGAIN
┃
┃ ────────────────
┃ 🔁 THROTTLE PROTECTION ON
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  // NEW: Check premium access for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  const sessions = await getSessions();
  const avgSpeed = database.stats.pairingSpeed.length > 0 
    ? Math.round(database.stats.pairingSpeed.reduce((a, b) => a + b) / database.stats.pairingSpeed.length) 
    : 0;

  // NEW: Premium stats
  const premiumCount = Object.keys(database.premium).filter(id => isPremium(id)).length;

  let stats = `╭══════════════════════════════════╮
│        📊 ʙᴏᴛ ꜱᴛᴀᴛɪꜱᴛɪᴄꜱ        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 👥 ᴜꜱᴇʀꜱ :
│ ${formatNumber(database.stats.totalUsers)}
│
│ 🔗 ꜱᴇꜱꜱɪᴏɴꜱ :
│ ${sessions.length}/${SYSTEM.sessionLimit}
│
│ 📊 ᴄᴏɴɴᴇᴄᴛɪᴏɴꜱ :
│ ${formatNumber(database.stats.totalConnections)}
│
│ 📅 ᴛᴏᴅᴀʏ :
│ ${formatNumber(database.stats.dailyConnections)}
│
│ ⚡ ᴀᴠɢ ꜱᴘᴇᴇᴅ :
│ ${avgSpeed}ᴍꜱ
│
│ ❌ ꜰᴀɪʟᴜʀᴇꜱ :
│ ${database.stats.failures}
│
│ 🛡️ ʙᴀɴɴᴇᴅ :
│ ${Object.keys(database.banned).length}
│
│ 👑 ᴘʀᴇᴍɪᴜᴍ :
│ ${premiumCount}
│
├──────────────────────────────────┤
│ 📡 ꜱʏꜱᴛᴇᴍ ᴍᴏɴɪᴛᴏʀɪɴɢ ᴀᴄᴛɪᴠᴇ
└──────────────────────────────────┘`;

  if (database.trialMode.active) {
    const trialExpiry = new Date(database.trialMode.expiry).toLocaleString();
    stats += `\n├◆ 🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ: ᴀᴄᴛɪᴠᴇ (ᴇɴᴅs: ${trialExpiry})`;
  }

  stats += `\n│\n└ ❏`;

  bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
});

// ==================== COMMAND: REPORT ====================

bot.onText(/\/report(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const message = match ? match[1] : null;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔧 MAINTENANCE MODE   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: ACTIVE
┃
┃ 🔧 BOT IS UNDER MAINTENANCE
┃
┃ ⏳ PLEASE TRY AGAIN LATER
┃
┃ ────────────────
┃ 🔒 SYSTEM TEMPORARILY OFFLINE
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⏳ RATE LIMIT ⏳     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: ACTIVE
┃
┃ 🚫 TOO MANY REQUESTS
┃
┃ ⏳ PLEASE WAIT
┃ BEFORE TRYING AGAIN
┃
┃ ────────────────
┃ 🔁 THROTTLE PROTECTION ON
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  if (!message) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│        📩 ʀᴇᴘᴏʀᴛ ɢᴜɪᴅᴇ          │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ⚠ ꜱᴛᴀᴛᴜꜱ   :: ꜱᴜᴘᴘᴏʀᴛ
│
│ 📌 ᴜꜱᴀɢᴇ :
│ /ʀᴇᴘᴏʀᴛ <message>
│
│ 📍 ᴇxᴀᴍᴘʟᴇ :
│ /ʀᴇᴘᴏʀᴛ ʙᴏᴛ ɴᴏᴛ ʀᴇꜱᴘᴏɴᴅɪɴɢ
│
├──────────────────────────────────┤
│ 🛠 ꜱᴇɴᴅ ɪꜱꜱᴜᴇ ᴅᴇᴛᴀɪʟꜱ ᴄʟᴇᴀʀʟʏ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  const reportId = Date.now();
  const userName = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  const report = {
    id: reportId,
    userId: userId.toString(),
    userName: userName,
    message: sanitizeInput(message),
    timestamp: new Date().toISOString(),
    status: 'ᴘᴇɴᴅɪɴɢ'
  };

  database.reports.push(report);
  await saveData();

  const reportMessage = `╭══════════════════════════════════╮
│         📩 ɴᴇᴡ ʀᴇᴘᴏʀᴛ           │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 🆔 ɪᴅ        :: ${userId}
│ 👤 ᴜꜱᴇʀ     :: ${userName}
│ 📌 ʀᴇᴘᴏʀᴛ ɪᴅ :: ${reportId}
│
├──────────────────────────────────┤
│ ⚠ ᴍᴇꜱꜱᴀɢᴇ :
│ ${sanitizeInput(message)}
│
├──────────────────────────────────┤
│ 🛠 ꜱᴛᴀᴛᴜꜱ   :: ʀᴇᴄᴇɪᴠᴇᴅ
└──────────────────────────────────┘`;

  for (const adminId of database.admins) {
    try {
      await bot.sendMessage(adminId, reportMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 ʀᴇᴘʟʏ', callback_data: `reply_${userId}` }],
            [{ text: '📋 ᴄᴏᴘʏ ɪᴅ', callback_data: `copyid_${userId}` }]
          ]
        }
      });
    } catch (e) {}
  }

  bot.sendMessage(chatId,
    `╭══════════════════════════════════╮
│        📩 ʀᴇᴘᴏʀᴛ ꜱʏꜱᴛᴇᴍ          │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ✔ ʀᴇᴘᴏʀᴛ ꜱᴜʙᴍɪᴛᴛᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ
│
│ 🆔 ʀᴇᴘᴏʀᴛ ɪᴅ :
│ ${reportId}
│
│ 👤 ᴜꜱᴇʀ :
│ ${userName}
│
├──────────────────────────────────┤
│ ⚠ ᴍᴇꜱꜱᴀɢᴇ :
│ ${sanitizeInput(message)}
│
├──────────────────────────────────┤
│ 🛠 ꜱᴛᴀᴛᴜꜱ   :: ʀᴇᴄᴇɪᴠᴇᴅ
│ 📡 ᴡᴇ ᴡɪʟʟ ʀᴇᴠɪᴇᴡ ꜱʜᴏʀᴛʟʏ
└──────────────────────────────────┘`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ʀᴇᴘᴏʀᴛ', userId, null, { reportId });
});

// ==================== COMMAND: TUTORIAL ====================

bot.onText(/\/tutorial/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   🔧 MAINTENANCE MODE ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ SYSTEM STATUS: ACTIVE
┃
┃ 🔧 BOT IS UNDER MAINTENANCE
┃ 🛠 UPDATES ARE BEING APPLIED
┃
┃ ────────────────
┃ ⏳ PLEASE TRY AGAIN LATER
┃ 🚫 SOME FEATURES MAY BE UNAVAILABLE
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     ⏳ RATE LIMITED   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ SYSTEM WARNING
┃
┃ 🚫 TOO MANY REQUESTS
┃ ⏱ PLEASE WAIT A MOMENT
┃
┃ ────────────────
┃ 🔁 RATE LIMIT ACTIVE
┃ 🛡 PROTECTION ENABLED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  // NEW: Check premium access for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  const tutorial = `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⚙ SETUP TUTORIAL    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 STEP 1: PREPARATION
┃
┃ • Ensure WhatsApp is installed
┃ • Keep internet connection stable
┃
┃ ────────────────
┃ 📌 STEP 2: GENERATE CODE
┃
┃ • Use: /pair 923078071982
┃ • Wait for pairing code
┃
┃ ────────────────
┃ 📌 STEP 3: LINK DEVICE
┃
┃ • Open WhatsApp Settings
┃ • Tap “Linked Devices”
┃ • Select “Link a Device”
┃ • Enter the pairing code
┃
┃ ────────────────
┃ ⚡ NOTE:
┃ Code expires in 5 minutes
┗━━━━━━━━━━━━━━━━━━━━━━━┛`;

  bot.sendMessage(chatId, tutorial, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔗 ᴘᴀɪʀ ɴᴏᴡ', callback_data: 'pair_guide' }
        ]
      ]
    }
  });
});

// ==================== COMMAND: HELP ====================

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (database.maintenance && !isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   🔧 MAINTENANCE MODE ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ SYSTEM NOTICE
┃
┃ 🔧 BOT IS UNDER MAINTENANCE
┃ 🛠 UPDATES IN PROGRESS
┃
┃ ────────────────
┃ ⏳ PLEASE TRY AGAIN LATER
┃ 🚫 SOME FEATURES MAY BE DISABLED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     ⏳ RATE LIMIT     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ SYSTEM ALERT
┃
┃ 🚫 TOO MANY REQUESTS
┃ ⏱ PLEASE WAIT AND RETRY
┃
┃ ────────────────
┃ 🔁 THROTTLE ACTIVE
┃ 🛡 PROTECTION ENABLED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (await checkBanned(userId, chatId)) return;

  // NEW: Check premium access for non-admin users
  if (!isAdmin(userId.toString()) && !isOwner(userId) && !hasAccess(userId)) {
    return sendAccessDenied(chatId);
  }

  let help = `╭══════════════════════════════════╮
│       ⚙ ᴄᴏᴍᴍᴀɴᴅ ᴄᴇɴᴛᴇʀ         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ──── ɢᴇɴᴇʀᴀʟ ᴄᴏᴍᴍᴀɴᴅꜱ ────
│
│ /ꜱᴛᴀʀᴛ   :: ɪɴɪᴛɪᴀʟɪᴢᴇ ʙᴏᴛ
│ /ᴘᴀɪʀ    :: ᴘᴀɪʀ ᴡʜᴀᴛꜱᴀᴘᴘ
│ /ᴜɴᴘᴀɪʀ  :: ʀᴇᴍᴏᴠᴇ ꜱᴇꜱꜱɪᴏɴ
│ /ᴘɪɴɢ    :: ᴛᴇꜱᴛ ᴄᴏɴɴᴇᴄᴛɪᴏɴ
│ /ʀᴜɴᴛɪᴍᴇ :: ꜱʏꜱᴛᴇᴍ ᴜᴘᴛɪᴍᴇ
│ /ꜱᴛᴀᴛꜱ   :: ʙᴏᴛ ꜱᴛᴀᴛɪꜱᴛɪᴄꜱ
│ /ʀᴇᴘᴏʀᴛ  :: ᴄᴏɴᴛᴀᴄᴛ ꜱᴜᴘᴘᴏʀᴛ
│ /ʜᴇʟᴘ    :: ꜱʜᴏᴡ ᴍᴇɴᴜ
│
└──────────────────────────────────┘`;

  if (isAdmin(userId.toString()) || isOwner(userId)) {
    help += `
╭══════════════════════════════════╮
│       ⚙ ᴄᴏᴍᴍᴀɴᴅ ᴄᴇɴᴛᴇʀ         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ──── ᴀᴅᴍɪɴ ᴄᴏᴍᴍᴀɴᴅꜱ ────
│
│ /ᴜꜱᴇʀꜱ        :: ʟɪꜱᴛ ᴀʟʟ ᴜꜱᴇʀꜱ
│ /ʟɪꜱᴛᴘᴀɪʀ     :: ᴀᴄᴛɪᴠᴇ ꜱᴇꜱꜱɪᴏɴꜱ
│ /ʙʀᴏᴀᴅᴄᴀꜱᴛ   :: ꜱᴇɴᴅ ᴀɴɴᴏᴜɴᴄᴇᴍᴇɴᴛ
│ /ᴄʟᴇᴀɴ       :: ʀᴇᴍᴏᴠᴇ ɪɴᴠᴀʟɪᴅ ꜱᴇꜱꜱɪᴏɴꜱ
│ /ᴄʜᴇᴄᴋᴜꜱᴇʀ   :: ᴜꜱᴇʀ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ
│ /ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ :: ᴛᴏɢɢʟᴇ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ
│ /ʟᴏɢꜱ        :: ᴠɪᴇᴡ ᴀᴜᴅɪᴛ ʟᴏɢꜱ
│ /ᴀɴɴᴏᴜɴᴄᴇ    :: ꜱᴄʜᴇᴅᴜʟᴇᴅ ᴍᴇꜱꜱᴀɢᴇ
│ /ᴛʀɪᴀʟꜱ       :: ᴛʀɪᴀʟ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ
│
└──────────────────────────────────┘`;
  }

  if (isOwner(userId)) {
    help += `
╭══════════════════════════════════╮
│       ⚙ ᴄᴏᴍᴍᴀɴᴅ ᴄᴇɴᴛᴇʀ         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ ──── ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅꜱ ────
│
│ /ᴀᴅᴅᴀᴅᴍɪɴ     :: ᴀᴅᴅ ɴᴇᴡ ᴀᴅᴍɪɴ
│ /ʀᴇᴍᴏᴠᴇᴀᴅᴍɪɴ  :: ʀᴇᴍᴏᴠᴇ ᴀᴅᴍɪɴ
│ /ʀᴇꜱᴛᴀʀᴛ      :: ʀᴇꜱᴛᴀʀᴛ ʙᴏᴛ
│
└──────────────────────────────────┘`;
  }

  help += `└ ❏`;

  bot.sendMessage(chatId, help, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏠 ᴍᴀɪɴ ᴍᴇɴᴜ', callback_data: 'show_main' }]
      ]
    }
  });
});

// ==================== ADMIN COMMANDS ====================

// /users - FIXED with proper formatting
bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ SYSTEM RESTRICTION
┃
┃ 👮 ADMIN ONLY ACCESS
┃ 🚫 YOU DO NOT HAVE PERMISSION
┃
┃ ────────────────
┃ 🔒 ACTION BLOCKED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  const usersList = [...database.users].slice(0, 10);
  let userText = '';
  usersList.forEach((id, index) => {
    const name = database.userDetails[id]?.name || 'ᴜɴᴋɴᴏᴡɴ';
    userText += `├◆ ${index + 1}. ${id} (${name})\n`;
  });

  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     👥 USER LIST     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📊 TOTAL USERS: ${database.stats.totalUsers}
┃
${userText}${database.stats.totalUsers > 10 ? `┃ ────────────────
┃ ➕ AND ${database.stats.totalUsers - 10} MORE USERS
┃` : ''}┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );
});

// /listpair - COMPLETELY FIXED with detailed session information
bot.onText(/\/listpair/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ RESTRICTED AREA
┃
┃ 👮 ADMIN ONLY ACCESS
┃ 🚫 ACTION NOT ALLOWED
┃
┃ ────────────────
┃ 🔒 PERMISSION REQUIRED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  const sessions = await getSessionDetails();
  
  if (sessions.length === 0) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     📭 NO SESSIONS    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: EMPTY
┃
┃ 🚫 NO ACTIVE SESSIONS FOUND
┃
┃ ────────────────
┃ 🔎 TRY PAIRING A DEVICE FIRST
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  // Count active vs inactive
  const activeCount = sessions.filter(s => s.status === 'ᴀᴄᴛɪᴠᴇ ✅').length;
  const inactiveCount = sessions.filter(s => s.status !== 'ᴀᴄᴛɪᴠᴇ ✅').length;

  let sessionList = '';
  sessions.slice(0, 15).forEach((session, index) => {
    sessionList += `├◆ ${index + 1}. +${session.number}\n`;
    sessionList += `├◆    ᴛʏᴘᴇ: ${session.status}\n`;
    if (session.name !== 'ᴜɴᴋɴᴏᴡɴ') {
      sessionList += `├◆    ɴᴀᴍᴇ: ${session.name}\n`;
    }
    sessionList += `│\n`;
  });

  const summary = `╭══════════════════════════════════╮
│        🔗 ᴀʟʟ ꜱᴇꜱꜱɪᴏɴꜱ          │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 📊 ᴛᴏᴛᴀʟ     :: ${sessions.length}/${SYSTEM.sessionLimit}
│ ✅ ᴀᴄᴛɪᴠᴇ    :: ${activeCount}
│ ⚠ ɪɴᴀᴄᴛɪᴠᴇ  :: ${inactiveCount}
│
├──────────────────────────────────┤
│ ${sessionList}
│
│ ${sessions.length > 15 ? `
│ ────────────────────────────────
│ ➕ ᴀɴᴅ ${sessions.length - 15} ᴍᴏʀᴇ ꜱᴇꜱꜱɪᴏɴꜱ
│` : ``}
└──────────────────────────────────┘`;

  bot.sendMessage(chatId, summary, { parse_mode: 'Markdown' });
});

// /broadcast
bot.onText(/\/broadcast(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const message = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `╭══════════════════════════════════╮
│        ⛔ ᴀᴄᴄᴇꜱꜱ ᴅᴇɴɪᴇᴅ ⛔        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 🚫 ᴘᴇʀᴍɪꜱꜱɪᴏɴ ʙʟᴏᴄᴋᴇᴅ
│
│ 👮 ᴀᴅᴍɪɴ ᴀᴄᴄᴇꜱꜱ ᴏɴʟʏ
│ 🔒 ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴀᴜᴛʜᴏʀɪᴢᴇᴅ
│
├──────────────────────────────────┤
│ ⚠ ᴀᴄᴛɪᴏɴ ʀᴇꜱᴛʀɪᴄᴛᴇᴅ
└──────────────────────────────────┘`, { parse_mode: 'Markdown' });
  }

  if (!message) {
    return bot.sendMessage(chatId,
      `╭══════════════════════════════════╮
│     📢 ʙʀᴏᴀᴅᴄᴀꜱᴛ ɢᴜɪᴅᴇ        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 📌 ʜᴏᴡ ᴛᴏ ᴜꜱᴇ
│
│ 📝 /ʙʀᴏᴀᴅᴄᴀꜱᴛ message here
│
├──────────────────────────────────┤
│ 👥 ᴛᴏᴛᴀʟ ᴜꜱᴇʀꜱ :
│ ${database.stats.totalUsers}
│
├──────────────────────────────────┤
│ ⚡ ꜱᴇɴᴅ ᴍᴇꜱꜱᴀɢᴇꜱ ᴛᴏ ᴀʟʟ ᴜꜱᴇʀꜱ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );
  }

  const total = database.users.size;
  if (total === 0) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     📭 NO USERS      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: EMPTY
┃
┃ 🚫 NO USERS AVAILABLE
┃ 📡 NOTHING TO BROADCAST
┃
┃ ────────────────
┃ 🔎 USERS WILL APPEAR AFTER ACTIVITY
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  const statusMsg = await bot.sendMessage(chatId,
    `╭══════════════════════════════════╮
│        📡 ʙʀᴏᴀᴅᴄᴀꜱᴛɪɴɢ         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 📊 ᴛᴏᴛᴀʟ ᴜꜱᴇʀꜱ :
│ ${total}
│
│ 📤 ꜱᴇɴᴛ :
│ 0
│
│ ❌ ꜰᴀɪʟᴇᴅ :
│ 0
│
├──────────────────────────────────┤
│ ⚡ ɪɴɪᴛɪᴀʟɪᴢɪɴɢ ʙʀᴏᴀᴅᴄᴀꜱᴛ
│ 🔄 ᴘʀᴏᴄᴇꜱꜱ ꜱᴛᴀʀᴛᴇᴅ
└──────────────────────────────────┘`,
    { parse_mode: 'Markdown' }
  );

  let sent = 0;
  let failed = 0;
  const users = [...database.users];

  for (let i = 0; i < users.length; i++) {
    try {
      await bot.sendMessage(users[i],
        `╭══════════════════════════════════╮
│      📢 ᴀɴɴᴏᴜɴᴄᴇᴍᴇɴᴛ          │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 📝 ᴍᴇꜱꜱᴀɢᴇ :
│ ${message}
│
├──────────────────────────────────┤
│ 📌 ɪɴꜰᴏ
│ 👤 ꜰʀᴏᴍ : ${SYSTEM.name} ᴀᴅᴍɪɴ
│ 🕒 ᴛɪᴍᴇ : ${new Date().toLocaleString()}
└──────────────────────────────────┘`,
        { parse_mode: 'Markdown' }
      );
      sent++;

      if (i % 10 === 0 || i === users.length - 1) {
        await bot.editMessageText(
          `╭══════════════════════════════════╮
│        📡 ʙʀᴏᴀᴅᴄᴀꜱᴛɪɴɢ         │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 📊 ᴘʀᴏɢʀᴇꜱꜱ :
│ ${Math.round((i + 1) / total * 100)}%
│
│ 📤 ꜱᴇɴᴛ :
│ ${sent}
│
│ ❌ ꜰᴀɪʟᴇᴅ :
│ ${failed}
│
├──────────────────────────────────┤
│ 🔄 ꜱᴇɴᴅɪɴɢ ɪɴ ᴘʀᴏɢʀᴇꜱꜱ
│ ⚡ ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ...
└──────────────────────────────────┘`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown'
          }
        );
      }

      await sleep(SYSTEM.broadcastDelay);
    } catch (error) {
      failed++;
      if (error.response?.body?.error_code === 403) {
        database.users.delete(users[i]);
      }
    }
  }

  await bot.editMessageText(
    `╭══════════════════════════════════╮
│       📡 ʙʀᴏᴀᴅᴄᴀꜱᴛ ᴅᴏɴᴇ        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 📤 ꜱᴇɴᴛ :
│ ${sent}
│
│ ❌ ꜰᴀɪʟᴇᴅ :
│ ${failed}
│
│ ✅ ꜱᴜᴄᴄᴇꜱꜱ :
│ ${Math.round(sent / total * 100)}%
│
├──────────────────────────────────┤
│ ✔ ᴘʀᴏᴄᴇꜱꜱ ᴄᴏᴍᴘʟᴇᴛᴇᴅ
│ 📊 ᴀʟʟ ᴛᴀꜱᴋꜱ ꜰɪɴɪꜱʜᴇᴅ
└──────────────────────────────────┘`,
    {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'Markdown'
    }
  );

  await saveData();
  addAuditLog('ʙʀᴏᴀᴅᴄᴀsᴛ', userId, null, { sent, failed, total });
});

// /clean
bot.onText(/\/clean/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 ACTION BLOCKED
┃
┃ 👮 ADMIN ONLY ACCESS
┃ 🔒 PERMISSION REQUIRED
┃
┃ ────────────────
┃ ⚠ UNAUTHORIZED REQUEST
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  const sessions = await getSessions();
  let cleaned = 0;
  let kept = 0;

  for (const session of sessions) {
    const sessionPath = path.join(PATHS.sessions, session);
    const credsPath = path.join(sessionPath, 'creds.json');
    
    let isValid = false;
    if (await fileExists(credsPath)) {
      try {
        const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
        isValid = !!(creds.me && creds.me.id);
      } catch (e) {}
    }
    
    if (!isValid) {
      await fs.rm(sessionPath, { recursive: true, force: true });
      cleaned++;
    } else {
      kept++;
    }
  }

  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   🧹 CLEANUP DONE    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🗑 REMOVED: ${cleaned}
┃ 📦 KEPT: ${kept}
┃
┃ ────────────────
┃ ✔ CLEANUP COMPLETED
┃ ⚡ SYSTEM OPTIMIZED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴄʟᴇᴀɴ', userId, null, { cleaned, kept });
});

// /ban
bot.onText(/\/ban(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 ACCESS BLOCKED
┃
┃ 👮 ADMIN ONLY
┃ 🔒 AUTHORIZATION REQUIRED
┃
┃ ────────────────
┃ ⚠ PERMISSION DENIED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃      🚫 BAN GUIDE     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 HOW TO USE
┃
┃ 📝 /ban 123456789 spamming
┃ 📝 /ban 123456789
┃
┃ ────────────────
┃ ⚠ USE RESPONSIBLY
┃ 🔒 ACTION IS IRREVERSIBLE (UNTIL UNBAN)
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  const parts = input.split(' ');
  const targetId = parts[0];
  const reason = parts.slice(1).join(' ') || 'ᴠɪᴏʟᴀᴛɪᴏɴ ᴏғ ᴛᴇʀᴍs';

  if (isOwner(parseInt(targetId))) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃        ❌ ERROR       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 ACTION FAILED
┃
┃ 👑 CANNOT BAN OWNER
┃ 🔒 OPERATION NOT ALLOWED
┃
┃ ────────────────
┃ ⚠ PRIVILEGED USER PROTECTED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  database.banned[targetId] = {
    reason,
    date: new Date().toISOString(),
    bannedBy: userId.toString()
  };

  await saveData();

  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃      🚫 USER BANNED   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🆔 USER ID: ${targetId}
┃ 📌 REASON: ${reason}
┃
┃ ────────────────
┃ ⚠ STATUS: RESTRICTED
┃ 🔒 ACCESS REVOKED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ʙᴀɴ', userId, targetId, { reason });
});

// /unban
bot.onText(/\/unban(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 ACTION RESTRICTED
┃
┃ 👮 ADMIN ONLY ACCESS
┃ 🔒 PERMISSION REQUIRED
┃
┃ ────────────────
┃ ⚠ YOU ARE NOT AUTHORIZED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃      🔓 UNBAN GUIDE   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 HOW TO USE
┃
┃ 📝 /unban 123456789
┃
┃ ────────────────
┃ ⚡ RESTORES USER ACCESS
┃ 🔓 REMOVES BAN RESTRICTION
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  const targetId = input.trim();

  if (!database.banned[targetId]) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃        ℹ INFO        ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS CHECK
┃
┃ 👤 USER IS NOT BANNED
┃ 🔓 NO RESTRICTIONS FOUND
┃
┃ ────────────────
┃ ✔ ALL SYSTEMS CLEAR
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  delete database.banned[targetId];
  await saveData();

  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     🔓 USER UNBANNED  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🆔 USER ID: ${targetId}
┃
┃ ────────────────
┃ ✔ ACCESS RESTORED
┃ 🔄 RESTRICTIONS REMOVED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴜɴʙᴀɴ', userId, targetId);
});

// /checkuser
bot.onText(/\/checkuser(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 OPERATION BLOCKED
┃
┃ 👮 ADMIN ONLY
┃ 🔒 AUTHORIZATION REQUIRED
┃
┃ ────────────────
┃ ⚠ UNAUTHORIZED ACCESS
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (!targetId) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   🔍 CHECK USER GUIDE ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 HOW TO USE
┃
┃ 📝 /checkuser 123456789
┃
┃ ────────────────
┃ ⚡ VIEW USER DETAILS & STATUS
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  const user = database.userDetails[targetId] || {};
  const isBanned = database.banned[targetId] ? 'ʏᴇs' : 'ɴᴏ';
  const banReason = database.banned[targetId] ? database.banned[targetId].reason : 'ɴ/ᴀ';
  const premiumStatus = isPremium(targetId) ? 'ᴀᴄᴛɪᴠᴇ ✅' : 'ɪɴᴀᴄᴛɪᴠᴇ ❌';
  const premiumExpiry = database.premium[targetId] ? new Date(database.premium[targetId].expiry).toLocaleString() : 'ɴ/ᴀ';
  
  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃      👤 USER INFO     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🆔 ID: ${targetId}
┃ 👤 NAME: ${user.name || 'N/A'}
┃ 📅 JOINED: ${user.joined ? new Date(user.joined).toLocaleDateString() : 'N/A'}
┃ 💬 MSGS: ${user.messages || 0}
┃ 🔗 PAIRS: ${user.pairs || 0}
┃ 🔒 BANNED: ${isBanned}
┃ 📝 REASON: ${banReason}
┃ 👑 PREMIUM: ${premiumStatus}
┃ ⏱ PREMIUM EXP: ${premiumExpiry}
┃
┃ ────────────────
┃ 📊 USER PROFILE DETAILS
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );
});

// /maintenance
bot.onText(/\/maintenance(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const mode = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 OPERATION BLOCKED
┃
┃ 👮 ADMIN ONLY
┃ 🔒 AUTHORIZATION REQUIRED
┃
┃ ────────────────
┃ ⚠ UNAUTHORIZED ACCESS
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (!mode) {
    const status = database.maintenance ? 'ᴇɴᴀʙʟᴇᴅ 🔧' : 'ᴅɪsᴀʙʟᴇᴅ ✅';
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   🔧 MAINTENANCE MODE ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚙ CURRENT STATUS: ${status}
┃
┃ 📌 HOW TO USE
┃ 📝 /maintenance on
┃ 📝 /maintenance off
┃
┃ ────────────────
┃ ⚡ CONTROL SYSTEM AVAILABILITY
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!['ᴏɴ', 'ᴏғғ'].includes(mode.toLowerCase())) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃       ⚠ INVALID      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 INVALID COMMAND
┃
┃ 📌 USE:
┃ 📝 /maintenance on
┃ 📝 /maintenance off
┃
┃ ────────────────
┃ ⚠ PLEASE FOLLOW CORRECT FORMAT
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  database.maintenance = mode.toLowerCase() === 'ᴏɴ';
  await saveData();

  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   🔧 MAINTENANCE MODE ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚙ STATUS:
┃ ${database.maintenance ? 'ENABLED 🔧' : 'DISABLED ✅'}
┃
┃ ────────────────
┃ ⚡ SYSTEM CONTROL PANEL
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ', userId, null, { enabled: database.maintenance });
});

// /logs
bot.onText(/\/logs/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 ACCESS RESTRICTED
┃
┃ 👮 ADMIN ONLY
┃ 🔒 PERMISSION REQUIRED
┃
┃ ────────────────
┃ ⚠ UNAUTHORIZED ACTION
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  const recentLogs = database.audit.slice(-5).reverse();
  
  if (recentLogs.length === 0) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃       📂 NO LOGS     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS: EMPTY
┃
┃ 📭 NO LOGS AVAILABLE
┃ 🔍 NOTHING TO DISPLAY
┃
┃ ────────────────
┃ ⚡ LOGS WILL APPEAR AFTER ACTIVITY
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  let logText = `┌ ❏ ◆ *⌜𝗥𝗘𝗖𝗘𝗡𝗧 𝗟𝗢𝗚𝗦⌟* ◆\n│\n`;
  recentLogs.forEach((log, index) => {
    const time = new Date(log.timestamp).toLocaleString();
    logText += `├◆ ${index + 1}. ${log.action}\n├◆    ᴜsᴇʀ: ${log.userId}\n├◆    ᴛɪᴍᴇ: ${time}\n`;
    if (log.target) logText += `├◆    ᴛᴀʀɢᴇᴛ: ${log.target}\n`;
    logText += `│\n`;
  });
  logText += `└ ❏`;

  bot.sendMessage(chatId, logText, { parse_mode: 'Markdown' });
});

// /announce
bot.onText(/\/announce(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match ? match[1] : null;

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 REQUEST DENIED
┃
┃ 👮 ADMIN ONLY ACCESS
┃ 🔒 PERMISSION REQUIRED
┃
┃ ────────────────
┃ ⚠ UNAUTHORIZED USER
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (!input) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   📢 ANNOUNCE GUIDE   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 HOW TO USE
┃
┃ 📝 /announce 10m update message
┃ 📝 /announce 1h system update
┃
┃ ────────────────
┃ ⚡ SEND TIMED ANNOUNCEMENTS
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  const parts = input.split(' ');
  const timeArg = parts[0];
  const message = parts.slice(1).join(' ');

  if (!message) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃        ❌ ERROR       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ INVALID INPUT
┃
┃ 🚫 PLEASE PROVIDE A MESSAGE
┃
┃ ────────────────
┃ 📌 EXAMPLE:
┃ /announce 10m system update
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  let delay = 0;
  if (timeArg.endsWith('ᴍ')) {
    delay = parseInt(timeArg) * 60 * 1000;
  } else if (timeArg.endsWith('ʜ')) {
    delay = parseInt(timeArg) * 60 * 60 * 1000;
  } else {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃       ⚠ INVALID      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 WRONG FORMAT
┃
┃ ⏱ USE: 10m OR 1h
┃
┃ ────────────────
┃ 📌 EXAMPLE:
┃ /announce 10m update message
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  const scheduleTime = new Date(Date.now() + delay);

  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📢 ANNOUNCEMENT SET   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⏰ TIME: ${scheduleTime.toLocaleString()}
┃ 💬 MESSAGE: ${message}
┃
┃ ────────────────
┃ ✔ SUCCESSFULLY SCHEDULED
┃ 🔔 WILL BE SENT AUTOMATICALLY
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  setTimeout(async () => {
    let sent = 0;
    let failed = 0;
    
    for (const user of [...database.users]) {
      try {
        await bot.sendMessage(user,
          `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📢 SCHEDULED NOTICE   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 💬 MESSAGE:
┃ ${message}
┃
┃ ────────────────
┃ ℹ INFO
┃ 🕒 TIME: ${new Date().toLocaleString()}
┃
┃ ────────────────
┃ ✔ SUCCESSFULLY QUEUED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
          { parse_mode: 'Markdown' }
        );
        sent++;
        await sleep(SYSTEM.broadcastDelay);
      } catch {
        failed++;
      }
    }

    bot.sendMessage(userId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📢 ANNOUNCEMENT DONE  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📤 SENT: ${sent}
┃ ❌ FAILED: ${failed}
┃
┃ ────────────────
┃ ✔ BROADCAST COMPLETED
┃ 📡 DELIVERY FINISHED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }, delay);

  addAuditLog('ᴀɴɴᴏᴜɴᴄᴇ', userId, null, { time: timeArg, message });
});

// ==================== OWNER COMMANDS ====================

// /addadmin
bot.onText(/\/addadmin(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 REQUEST BLOCKED
┃
┃ 👑 OWNER ONLY ACCESS
┃ 🔒 PERMISSION REQUIRED
┃
┃ ────────────────
┃ ⚠ RESTRICTED AREA
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (!targetId) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   👮 ADD ADMIN GUIDE  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 HOW TO USE
┃
┃ 📝 /addadmin 123456789
┃
┃ ────────────────
┃ ⚡ GRANTS ADMIN PRIVILEGES
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (database.admins.includes(targetId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃        ℹ INFO        ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS CHECK
┃
┃ 👮 USER IS ALREADY AN ADMIN
┃ 🔒 NO ACTION REQUIRED
┃
┃ ────────────────
┃ ✔ ROLE ALREADY ASSIGNED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  database.admins.push(targetId);
  await saveData();

  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   👮 ADMIN ADDED     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🆔 USER ID: ${targetId}
┃
┃ ────────────────
┃ ✔ ADMIN ROLE ASSIGNED
┃ 🔓 PRIVILEGES GRANTED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ᴀᴅᴅᴀᴅᴍɪɴ', userId, targetId);
});

// /removeadmin
bot.onText(/\/removeadmin(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match ? match[1] : null;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 OPERATION BLOCKED
┃
┃ 👑 OWNER ONLY ACCESS
┃ 🔒 AUTHORIZATION REQUIRED
┃
┃ ────────────────
┃ ⚠ RESTRICTED COMMAND
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  if (!targetId) {
    return bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🚫 REMOVE ADMIN GUIDE┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 HOW TO USE
┃
┃ 📝 /removeadmin 123456789
┃
┃ ────────────────
┃ ⚡ REVOKES ADMIN PRIVILEGES
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  if (isOwner(parseInt(targetId))) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃        ❌ ERROR       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 ACTION BLOCKED
┃
┃ 👑 CANNOT REMOVE OWNER
┃ 🔒 OPERATION NOT ALLOWED
┃
┃ ────────────────
┃ ⚠ OWNER IS PROTECTED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  const index = database.admins.indexOf(targetId);
  if (index === -1) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃        ℹ INFO        ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ STATUS CHECK
┃
┃ 👤 USER IS NOT AN ADMIN
┃ 🔓 NO ADMIN PRIVILEGES FOUND
┃
┃ ────────────────
┃ ✔ NO ACTION REQUIRED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  database.admins.splice(index, 1);
  await saveData();

  bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   🚫 ADMIN REMOVED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🆔 USER ID: ${targetId}
┃
┃ ────────────────
┃ ✔ ADMIN PRIVILEGES REVOKED
┃ 🔒 ACCESS DOWNGRADED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  addAuditLog('ʀᴇᴍᴏᴠᴇᴀᴅᴍɪɴ', userId, targetId);
});

// /restart
bot.onText(/\/restart/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 ACTION BLOCKED
┃
┃ 👑 OWNER ONLY ACCESS
┃ 🔒 AUTHORIZATION REQUIRED
┃
┃ ────────────────
┃ ⚠ RESTRICTED COMMAND
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  await bot.sendMessage(chatId,
    `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     🔄 RESTARTING     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ SYSTEM NOTICE
┃
┃ 🤖 BOT WILL RESTART IN 3 SECONDS
┃
┃ ────────────────
┃ ⏳ PLEASE WAIT...
┃ 🔁 REBOOT PROCESS STARTED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
    { parse_mode: 'Markdown' }
  );

  await saveData();
  addAuditLog('ʀᴇsᴛᴀʀᴛ', userId);

  setTimeout(() => {
    console.log('🔄 ʀᴇsᴛᴀʀᴛ ɪɴɪᴛɪᴀᴛᴇᴅ ʙʏ ᴏᴡɴᴇʀ');
    process.exit(1);
  }, 3000);
});

// ==================== CALLBACK HANDLER ====================
bot.on('callback_query', async (query) => {
  const msg = query.message;
  const data = query.data;
  const userId = query.from.id;
  const chatId = msg.chat.id;
  const userName = query.from.first_name || 'ᴜsᴇʀ';

  await trackUser(userId, userName);

  if (data === 'verify_membership') {
    await bot.answerCallbackQuery(query.id, { text: 'ᴠᴇʀɪғʏɪɴɢ...' });
    
    const verification = await verifyMembership(userId);
    
    if (verification.verified) {
      await bot.editMessageText(
        `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ✅ VERIFICATION OK  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🔓 ACCESS GRANTED
┃
┃ 👉 CLICK BELOW TO CONTINUE
┃
┃ ────────────────
┃ ✔ AUTHENTICATION SUCCESSFUL
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
        {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 ᴄᴏɴᴛɪɴᴜᴇ', callback_data: 'show_main' }]
            ]
          }
        }
      );
    } else {
      await bot.answerCallbackQuery(query.id, {
        text: 'ᴘʟᴇᴀsᴇ ᴊᴏɪɴ ᴀʟʟ ᴄʜᴀɴɴᴇʟs ғɪʀsᴛ',
        show_alert: true
      });
    }
  }

  else if (data === 'show_main') {
    await bot.answerCallbackQuery(query.id);
    await sendMainMenu(chatId, userId, userName, isAdmin(userId.toString()), isOwner(userId));
  }

  else if (data === 'show_tutorial') {
    await bot.answerCallbackQuery(query.id);
    
    bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   🎥 VIDEO TUTORIAL   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 SETUP GUIDE
┃
┃ ▶ WATCH COMPLETE SETUP VIDEO
┃ 📖 FOLLOW STEP-BY-STEP INSTRUCTIONS
┃
┃ ────────────────
┃ ⚡ RECOMMENDED FOR NEW USERS
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ ᴡᴀᴛᴄʜ ɴᴏᴡ', callback_data: 'watch_tutorial' }]
          ]
        }
      }
    );
  }

  else if (data === 'watch_tutorial') {
    await bot.answerCallbackQuery(query.id, { text: 'sᴇɴᴅɪɴɢ ᴠɪᴅᴇᴏ...' });
    
    try {
      await bot.sendVideo(chatId, ASSETS.tutorialVideo, {
        caption: `🎬 *${SYSTEM.name} sᴇᴛᴜᴘ ɢᴜɪᴅᴇ*`,
        parse_mode: 'Markdown'
      });
    } catch (e) {
      await bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃        ❌ ERROR       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ MEDIA ERROR
┃
┃ 🎥 VIDEO UNAVAILABLE
┃ 🔗 FILE NOT FOUND OR BROKEN LINK
┃
┃ ────────────────
┃ 🔄 TRY AGAIN LATER
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
    }
  }

  else if (data === 'pair_guide') {
    await bot.answerCallbackQuery(query.id);
    
    bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     🔗 PAIR GUIDE     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 HOW TO USE
┃
┃ 📝 /pair 923078071982
┃ 📝 /pair 923078071982|1234
┃
┃ ────────────────
┃ ⚡ LINK YOUR DEVICE TO BOT
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );
  }

  else if (data === 'bot_stats') {
    await bot.answerCallbackQuery(query.id, { text: 'ʟᴏᴀᴅɪɴɢ...' });
    
    const sessions = await getSessions();
    const avgSpeed = database.stats.pairingSpeed.length > 0 
      ? Math.round(database.stats.pairingSpeed.reduce((a, b) => a + b) / database.stats.pairingSpeed.length) 
      : 0;
    const premiumCount = Object.keys(database.premium).filter(id => isPremium(id)).length;

    let stats = `╭══════════════════════════════════╮
│        📊 ʙᴏᴛ ꜱᴛᴀᴛɪꜱᴛɪᴄꜱ        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 👥 ᴜꜱᴇʀꜱ :
│ ${formatNumber(database.stats.totalUsers)}
│
│ 🔗 ꜱᴇꜱꜱɪᴏɴꜱ :
│ ${sessions.length}/${SYSTEM.sessionLimit}
│
│ 📡 ᴄᴏɴɴᴇᴄᴛɪᴏɴꜱ :
│ ${formatNumber(database.stats.totalConnections)}
│
│ 📅 ᴛᴏᴅᴀʏ :
│ ${formatNumber(database.stats.dailyConnections)}
│
│ ⚡ ᴀᴠɢ ꜱᴘᴇᴇᴅ :
│ ${avgSpeed}ᴍꜱ
│
│ 👑 ᴘʀᴇᴍɪᴜᴍ :
│ ${premiumCount}
│
├──────────────────────────────────┤
│ 📈 ꜱʏꜱᴛᴇᴍ ᴏᴠᴇʀᴠɪᴇᴡ
└──────────────────────────────────┘`;

    if (database.trialMode.active) {
      const trialExpiry = new Date(database.trialMode.expiry).toLocaleString();
      stats += `\n├◆ 🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ: ᴀᴄᴛɪᴠᴇ (ᴇɴᴅs: ${trialExpiry})`;
    }

    stats += `\n│\n└ ❏`;

    await bot.editMessageText(stats, {
      chat_id: chatId,
      message_id: msg.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 ʀᴇғʀᴇsʜ', callback_data: 'bot_stats' }]
        ]
      }
    });
  }

  else if (data.startsWith('copy_')) {
    const code = data.replace('copy_', '');
    await bot.answerCallbackQuery(query.id, {
      text: `ᴄᴏᴅᴇ: ${code}`,
      show_alert: true
    });
  }

  else if (data.startsWith('copyid_')) {
    const id = data.replace('copyid_', '');
    await bot.answerCallbackQuery(query.id, {
      text: `ᴜsᴇʀ ɪᴅ: ${id}`,
      show_alert: true
    });
  }

  else if (data.startsWith('reply_')) {
    const targetId = data.replace('reply_', '');
    
    await bot.answerCallbackQuery(query.id, {
      text: 'ʀᴇᴘʟʏ ᴛᴏ ᴛʜɪs ᴍᴇssᴀɢᴇ',
      show_alert: true
    });
    
    bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     💬 REPLY MODE    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 👤 TARGET: ${targetId}
┃
┃ 📌 HOW TO USE
┃ /reply ${targetId} your message
┃
┃ ────────────────
┃ ⚡ DIRECT MESSAGE SYSTEM
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
      }
    );
  }
});

// ==================== ADMIN REPLY COMMAND ====================
bot.onText(/\/reply (\d+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = match[1];
  const replyMessage = match[2];

  if (!isAdmin(userId.toString()) && !isOwner(userId)) {
    return bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ ACCESS DENIED    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚫 REQUEST BLOCKED
┃
┃ 👮 ADMIN ONLY AREA
┃ 🔒 YOU ARE NOT AUTHORIZED
┃
┃ ────────────────
┃ ⚠ ACCESS RESTRICTED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }

  try {
    await bot.sendMessage(targetId,
      `╭══════════════════════════════════╮
│       👮 ᴀᴅᴍɪɴ ʀᴇꜱᴘᴏɴꜱᴇ        │
╰══════════════════════════════════╯

┌──────────────────────────────────┐
│ 💬 ᴍᴇꜱꜱᴀɢᴇ :
│ ${replyMessage}
│
├──────────────────────────────────┤
│ ⚡ ꜱᴇɴᴛ ʙʏ ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ
│ 🔒 ᴏꜰꜰɪᴄɪᴀʟ ʀᴇᴘʟʏ
└──────────────────────────────────┘`,
      { parse_mode: 'Markdown' }
    );

    bot.sendMessage(chatId,
      `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃     📤 REPLY SENT    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 👤 TO: ${targetId}
┃ 💬 MESSAGE: ${replyMessage}
┃
┃ ────────────────
┃ ✔ SUCCESSFULLY DELIVERED
┃ ⚡ RESPONSE COMPLETED
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
      { parse_mode: 'Markdown' }
    );

    addAuditLog('ᴀᴅᴍɪɴ_ʀᴇᴘʟʏ', userId, targetId, { message: replyMessage });
  } catch (error) {
    bot.sendMessage(chatId, `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃        ❌ ERROR       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ SYSTEM FAILURE
┃
┃ 🚫 FAILED TO SEND REPLY
┃ 🔄 TRY AGAIN LATER
┃
┃ ────────────────
┃ 🛠 CHECK CONNECTION OR BOT STATUS
┗━━━━━━━━━━━━━━━━━━━━━━━┛`, { parse_mode: 'Markdown' });
  }
});

// ==================== GROUP MESSAGE HANDLER ====================
bot.on('message', async (msg) => {
  if (msg.chat.type === 'private') return;
  
  if (msg.text && msg.text.includes(`@${(await bot.getMe()).username}`)) {
    await handleGroupMessage(msg);
  }
});

// ==================== AUTO-REPLY SYSTEM ====================
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/') || msg.chat.type === 'private') return;

  const text = msg.text.toLowerCase();
  const chatId = msg.chat.id;

  const responses = {
    'how to pair': '┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇ /pair ғᴏʟʟᴏᴡᴇᴅ ʙʏ ʏᴏᴜʀ ɴᴜᴍʙᴇʀ\n│\n└ ❏',
    'how to connect': '┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇ /pair ᴄᴏᴍᴍᴀɴᴅ ᴛᴏ ᴄᴏɴɴᴇᴄᴛ\n│\n└ ❏',
    'what is meta': `┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ${SYSTEM.name} ɪs ᴀ ᴘʀᴏғᴇssɪᴏɴᴀʟ ᴘᴀɪʀɪɴɢ sʏsᴛᴇᴍ\n│\n└ ❏`,
    'help': '┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇ /help ғᴏʀ ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ\n│\n└ ❏',
    'tutorial': '┌ ❏ ◆ *⌜𝗜𝗡𝗙𝗢⌟* ◆\n│\n├◆ ᴜsᴇ /tutorial ғᴏʀ ᴠɪᴅᴇᴏ ɢᴜɪᴅᴇ\n│\n└ ❏',
  'premium': `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃    💎 PREMIUM INFO    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📌 GET PREMIUM ACCESS
┃
┃ 📞 CONTACT: @dev_shazam
┃ 💬 TELEGRAM: ${DEVELOPER_CONTACTS.telegram}
┃
┃ ────────────────
┃ ⚡ BENEFITS:
┃ • Unlimited access
┃ • No restrictions
┃ • Priority support
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
  };

  for (const [key, response] of Object.entries(responses)) {
    if (text.includes(key)) {
      await bot.sendMessage(chatId, response, {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
      });
      break;
    }
  }
});

// ==================== PREMIUM EXPIRY CHECKER ====================
// Run every hour to check and remove expired premium users
setInterval(async () => {
  let expired = 0;
  const now = Date.now();
  
  for (const [userId, data] of Object.entries(database.premium)) {
    if (data.expiry < now) {
      delete database.premium[userId];
      expired++;
      
      // Notify user about expiry
      try {
        await bot.sendMessage(userId,
          `┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃   ⛔ PREMIUM EXPIRED  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ⚠ SUBSCRIPTION ENDED
┃
┃ 💳 YOUR PREMIUM ACCESS HAS EXPIRED
┃ 🔒 FEATURES ARE NOW LIMITED
┃
┃ ────────────────
┃ 📞 CONTACT DEVELOPER FOR RENEWAL
┗━━━━━━━━━━━━━━━━━━━━━━━┛`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {}
    }
  }
  
  if (expired > 0) {
    console.log(`🧹 ᴄʟᴇᴀɴᴇᴅ ${expired} ᴇxᴘɪʀᴇᴅ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀs`);
    await saveData();
  }
}, 60 * 60 * 1000); // Check every hour

// Also check trial mode expiry
setInterval(async () => {
  if (database.trialMode.active && database.trialMode.expiry < Date.now()) {
    database.trialMode.active = false;
    database.trialMode.expiry = null;
    await saveData();
    console.log('🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ ᴇxᴘɪʀᴇᴅ');
  }
}, 60 * 1000); // Check every minute

// ==================== INITIALIZATION ====================
(async () => {
  console.clear();
  
  await ensureDirectories();
  await loadDatabase();
  
  console.log(chalk.cyan(`
╔══════════════════════════════════════╗
║     ${SYSTEM.name} v${SYSTEM.version}          ║
║     ${SYSTEM.creator}              ║
║     ᴇɴᴛᴇʀᴘʀɪsᴇ ᴘᴀɪʀɪɴɢ sʏsᴛᴇᴍ        ║
║     ᴘʀᴇᴍɪᴜᴍ ᴇᴅɪᴛɪᴏɴ                 ║
╚══════════════════════════════════════╝
  `));

  console.log(chalk.green('✅ sʏsᴛᴇᴍ ɪɴɪᴛɪᴀʟɪᴢᴇᴅ'));
  console.log(chalk.blue(`👥 ᴜsᴇʀs: ${formatNumber(database.stats.totalUsers)}`));
  console.log(chalk.yellow(`🔗 ᴀᴅᴍɪɴs: ${database.admins.length}`));
  console.log(chalk.magenta(`👑 ᴘʀᴇᴍɪᴜᴍ: ${Object.keys(database.premium).length}`));
  console.log(chalk.cyan(`🎁 ᴛʀɪᴀʟ ᴍᴏᴅᴇ: ${database.trialMode.active ? 'ᴀᴄᴛɪᴠᴇ' : 'ɪɴᴀᴄᴛɪᴠᴇ'}`));
  console.log(chalk.cyan(`⏱️ ᴜᴘᴛɪᴍᴇ: ${formatUptime(Date.now() - database.stats.startTime)}`));
  console.log(chalk.white('\n📢 ᴍᴏɴɪᴛᴏʀɪɴɢ ғᴏʀ ᴄᴏᴍᴍᴀɴᴅs...\n'));
})();

// ==================== SHUTDOWN HANDLERS ====================
const shutdown = async (signal) => {
  console.log(`\n🛑 ʀᴇᴄᴇɪᴠᴇᴅ ${signal}. sᴀᴠɪɴɢ ᴅᴀᴛᴀ...`);
  await saveData();
  console.log('✅ ᴅᴀᴛᴀ sᴀᴠᴇᴅ. sʜᴜᴛᴛɪɴɢ ᴅᴏᴡɴ...');
  bot.stopPolling();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('message', (msg) => {
  if (msg === 'shutdown') shutdown('PM2_SHUTDOWN');
});

module.exports = { bot };