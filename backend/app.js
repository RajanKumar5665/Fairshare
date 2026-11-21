import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './src/config/env.js';
import { notFound } from './src/middlewares/notFound.js';
import { errorHandler } from './src/middlewares/errorHandler.js';
import authRoutes from './src/modules/auth/auth.routes.js';
import roomRoutes from './src/modules/rooms/room.routes.js';
import expenseRoutes from './src/modules/expenses/expense.routes.js';
import subscriptionRoutes from './src/modules/subscription/subscription.routes.js';
import adminRoutes from './src/modules/admin/admin.routes.js';

const app = express();

// Behind Nginx in production: trust the first proxy so client IPs (rate limits,
// secure cookies) are read from X-Forwarded-* correctly.
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

// ─── Security Headers (CSP via Helmet) ─────────────────────────────────────
const isProd = env.NODE_ENV === 'production';

// Dev me local/LAN testing ke liye, prod me nahi chahiye
const devConnectSrc = isProd
  ? []
  : ['http://localhost:*', 'http://127.0.0.1:*'];

const connectSrc = [
  "'self'",
  env.CLIENT_URL,
  'https://accounts.google.com',
  'https://oauth2.googleapis.com',
  'https://api.razorpay.com',
  'https://lumberjack.razorpay.com',
  ...devConnectSrc,
].filter(Boolean); // CLIENT_URL missing ho to skip

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          'https://accounts.google.com',
          'https://www.gstatic.com',
          'https://checkout.razorpay.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://accounts.google.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc,
        frameSrc: [
          "'self'",
          'https://accounts.google.com',
          'https://api.razorpay.com',
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // PWA fetch ke liye
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);


// Production: only CLIENT_URL + TRUSTED_ORIGINS (comma separated). Local: any origin.
export const allowedOrigins = [env.CLIENT_URL, ...(env.TRUSTED_ORIGINS || '').split(',')]
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
export const corsOrigin = isProd ? allowedOrigins : true;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    exposedHeaders: ["Content-Disposition"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// ─── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ─── NoSQL Injection Prevention (Express 5 safe) ───────────────────────────
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  if (req.params) mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  if (req.query) mongoSanitize.sanitize(req.query, { replaceWith: '_' });
  next();
});

// ─── Logging ────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Global Rate Limit ──────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
);

// ─── Health ─────────────────────────────────────────────────────────────────
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ success: true, message: 'API is running', env: env.NODE_ENV });
});

// ─── Routes (Dual-mounted so both /api/... and direct /... work seamlessly on serverless) ────
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/rooms', '/rooms'], roomRoutes);
app.use(['/api/expenses', '/expenses'], expenseRoutes);
app.use(['/api/subscription', '/subscription'], subscriptionRoutes);
app.use(['/api/admin', '/admin'], adminRoutes);

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
