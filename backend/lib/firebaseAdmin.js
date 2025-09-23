const admin = require('firebase-admin');

// Lazy initialize to allow server to boot without creds; callers will error on use
function initIfNeeded() {
  if (admin.apps.length > 0) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    if (!privateKey.startsWith('-----BEGIN')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    return admin;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return admin;
  }

  return null;
}

function getAdmin() {
  const instance = initIfNeeded();
  if (!instance) {
    throw new Error('Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS');
  }
  return admin;
}

module.exports = { getAdmin };
