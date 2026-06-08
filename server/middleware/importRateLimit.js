const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;

const buckets = new Map();

const importRateLimit = (req, res, next) => {
  const userId = req.user?._id?.toString();

  if (!userId) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const now = Date.now();
  const bucket = buckets.get(userId) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }

  bucket.count += 1;
  buckets.set(userId, bucket);

  if (bucket.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      message: 'Too many import attempts. Please try again later.'
    });
  }

  next();
};

module.exports = importRateLimit;
