// =============================================================================
// MailerOps - Modular Backend Server
// =============================================================================

const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// ─── Environment ────────────────────────────────────────────────────────────
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = process.env.PORT || 3000;
const SQLITE_DB_FILE = process.env.SQLITE_PATH || path.join(__dirname, 'data.sqlite');

// ─── Store Initialization ───────────────────────────────────────────────────
const { createMongoStore } = require('./lib/mongoStore');
const { createSqliteStore } = require('./lib/sqliteStore');

// ─── Middleware ─────────────────────────────────────────────────────────────
const authMiddleware = require('./middleware/auth');
const loggingMiddleware = require('./middleware/logging');
const { errorHandler } = require('./middleware/error');

// ─── Routes ─────────────────────────────────────────────────────────────────
const authRouter = require('./routes/auth');
const specialRouter = require('./routes/special');
const serversRouter = require('./routes/servers');
const reputationRouter = require('./routes/reputation');
const crudRouter = require('./routes/crud');

// ─── Background Tasks ───────────────────────────────────────────────────────
const { startBackgroundTasks } = require('./lib/backgroundTasks');

// ─── Express App ────────────────────────────────────────────────────────────
const app = express();

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging & Auth
app.use(loggingMiddleware);
app.use(authMiddleware);

// Mount Routes (Order matters for matching)
app.use('/oauth', authRouter);     // Matches /oauth/callback
app.use('/servers', serversRouter); // Matches /servers/bulk-action
app.use('/api/reputation', reputationRouter); // Matches /api/reputation/upsert
app.use('/api', specialRouter);     // Matches /api/json-upload, /api/ip-stats, etc.
app.use('/', specialRouter);       // Matches /_reset
app.use('/', crudRouter);          // Matches /:collection, /:collection/:id

// Error Handling (Must be last)
app.use(errorHandler);

// ─── Startup Logic ──────────────────────────────────────────────────────────

async function createStore() {
  const dbType = process.env.DATABASE_TYPE || 'sqlite';
  
  if (dbType === 'mongodb') {
    try {
      const store = await createMongoStore();
      console.log('[server] Storage mode: MongoDB');
      return store;
    } catch (err) {
      console.error('[server] MongoDB connection failed:', err.message);
      process.exit(1);
    }
  }

  // Fallback to SQLite
  try {
    const store = createSqliteStore(SQLITE_DB_FILE);
    console.log(`[server] Storage mode: SQLite (${SQLITE_DB_FILE})`);
    return store;
  } catch (err) {
    console.error('[server] SQLite initialization failed:', err.message);
    process.exit(1);
  }
}

async function startServer() {
  const store = await createStore();
  app.locals.store = store;

  // Initialize Shadow Intelligence Layer (Background Tasks)
  startBackgroundTasks(store);

  app.listen(PORT, () => {
    console.log(`[server] MailerOps API running on port ${PORT}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// ─── Error handling for process crashes ─────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  process.exit(1);
});

// Fire!
startServer().catch((error) => {
  console.error('[CRITICAL] Failed to start API:', error);
  process.exit(1);
});
