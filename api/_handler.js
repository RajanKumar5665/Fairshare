let appPromise;
let databasePromise;

const allowedOrigins = new Set([
  'https://fairshareblue.vercel.app',
  'https://fairshare-blue.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  if (/\.vercel\.app$/.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

async function loadApp() {
  if (!appPromise) {
    appPromise = import('../backend/app.js').then(({ default: app }) => app);
  }
  return appPromise;
}

async function connectDatabase() {
  if (!databasePromise) {
    databasePromise = import('../backend/src/config/database.js').then(({ connectDB }) => connectDB());
  }
  return databasePromise;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const [app] = await Promise.all([loadApp(), connectDatabase()]);
    return app(req, res);
  } catch (error) {
    console.error('Serverless API request failed:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Internal server error',
    });
  }
}
