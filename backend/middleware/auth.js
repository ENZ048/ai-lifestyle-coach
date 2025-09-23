const { getAdmin } = require('../lib/firebaseAdmin');

// Extract bearer token from Authorization header
function getAccessToken(req) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function verifyFirebaseToken(token) {
  const admin = getAdmin();
  const decoded = await admin.auth().verifyIdToken(token);
  // shape a minimal user object compatible with prior code
  return {
    id: decoded.uid,
    email: decoded.email || null,
    phone_number: decoded.phone_number || null,
    firebase: decoded,
  };
}

// Strict auth: requires a valid Firebase ID token
async function authenticate(req, res, next) {
  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });

    const user = await verifyFirebaseToken(token);
    req.user = user;
    next();
  } catch (err) {
    const status = err?.errorInfo?.code === 'auth/id-token-expired' ? 401 : 401;
    return res.status(status).json({ error: 'Unauthorized' });
  }
}

// Optional auth: attaches req.user if valid, otherwise continues
async function optionalAuth(req, res, next) {
  try {
    const token = getAccessToken(req);
    if (!token) return next();
  const admin = getAdmin();
  const user = await verifyFirebaseToken(token);
    req.user = user;
    return next();
  } catch (err) {
    return next();
  }
}

module.exports = { authenticate, optionalAuth };
