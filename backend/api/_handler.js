let appPromise;
let databasePromise;

const allowedOrigins = new Set([
  'https://fairshareblue.vercel.app',
  'https://fairshare-blue.vercel.app',
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

async function loadApp() {
  if (!appPromise) {
    appPromise = import('../app.js').then(({ default: app }) => app);
  }
  return appPromise;
}

async function connectDatabase() {
  if (!databasePromise) {
    databasePromise = import('../src/config/database.js').then(({ connectDB }) => connectDB());
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
    console.error('Vercel API request failed:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
