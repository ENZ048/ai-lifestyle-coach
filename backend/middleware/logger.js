// Simple logging middleware with request timing and error logging
// No external dependencies to keep it lightweight.

function genReqId() {
  // Simple, low-collision id: time base36 + random base36
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hrtimeMs(startBigInt) {
  const end = process.hrtime.bigint();
  return Number(end - startBigInt) / 1e6; // ms
}

// Request/Response logger
function requestLogger(req, res, next) {
  const reqId = genReqId();
  req.id = reqId;
  const start = process.hrtime.bigint();

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';
  const method = req.method;
  const url = req.originalUrl || req.url;

  // Per-request log helper
  req.log = (...args) => {
    // Prefix logs with timestamp and request id for correlation
    const ts = new Date().toISOString();
    console.log(`${ts} [req ${reqId}]`, ...args);
  };

  console.log(`${new Date().toISOString()} [req ${reqId}] ${method} ${url} ip=${ip} ua=\"${ua}\"`);

  // Log when response finishes
  res.on('finish', () => {
    const durMs = hrtimeMs(start).toFixed(1);
    const status = res.statusCode;
    const len = res.getHeader('content-length') || '-';
    console.log(`${new Date().toISOString()} [req ${reqId}] ${method} ${url} -> ${status} ${len}B ${durMs}ms`);
  });

  next();
}

// Error logging middleware (should be added after routes)
// It logs and delegates sending the response (500 if not already sent)
function errorLogger(err, req, res, _next) {
  const reqId = req?.id || 'no-req';
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const stack = err.stack || '(no stack)';
  console.error(`${new Date().toISOString()} [req ${reqId}] ERROR ${status}: ${message}`);
  console.error(stack);
  if (res.headersSent) return; // avoid double-send
  res.status(status).json({ error: message, requestId: reqId });
}

// Timing helper for async blocks: logs start/end with duration
async function timeAsync(req, label, fn) {
  const start = process.hrtime.bigint();
  req?.log?.(`start ${label}`);
  try {
    const result = await fn();
    const ms = hrtimeMs(start).toFixed(1);
    req?.log?.(`end   ${label} ${ms}ms`);
    return result;
  } catch (e) {
    const ms = hrtimeMs(start).toFixed(1);
    req?.log?.(`fail  ${label} ${ms}ms -> ${e?.message || e}`);
    throw e;
  }
}

// Manual timer if you need more control
function startTimer(req, label) {
  const start = process.hrtime.bigint();
  req?.log?.(`start ${label}`);
  return {
    end(extra = '') {
      const ms = hrtimeMs(start).toFixed(1);
      req?.log?.(`end   ${label} ${ms}ms ${extra}`.trim());
      return Number(ms);
    },
  };
}

module.exports = { requestLogger, errorLogger, timeAsync, startTimer };
