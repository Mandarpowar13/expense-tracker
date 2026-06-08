const crypto = require('crypto');

const SESSION_TTL_MS = 10 * 60 * 1000;
const sessions = new Map();

const cleanupExpired = () => {
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
};

const createSession = ({ userId, transactions, fileHash, upiApp }) => {
  cleanupExpired();

  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  sessions.set(sessionId, {
    userId: userId.toString(),
    transactions,
    fileHash,
    upiApp,
    expiresAt
  });

  return { sessionId, expiresIn: Math.floor(SESSION_TTL_MS / 1000) };
};

const getSession = (sessionId, userId) => {
  cleanupExpired();

  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (session.userId !== userId.toString()) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
};

const deleteSession = (sessionId) => {
  sessions.delete(sessionId);
};

module.exports = {
  createSession,
  getSession,
  deleteSession
};
