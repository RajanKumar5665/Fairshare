
import 'dotenv/config';
import Joi from 'joi';

const envSchema = Joi.object({
    PORT: Joi.number().default(4000),

    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),

    MONGO_URI: Joi.string().required(),

    JWT_ACCESS_SECRET: Joi.string().min(10).required(),
    JWT_REFRESH_SECRET: Joi.string().min(10).required(),

    JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

    CLIENT_URL: Joi.string()
        .uri()
        .default('http://localhost:5173'),

    COOKIE_DOMAIN: Joi.string().default('localhost'),

    // Twilio Verify Configuration
    TWILIO_ACCOUNT_SID: Joi.string()
        .pattern(/^AC[a-fA-F0-9]{32}$/)
        .required(),

    TWILIO_AUTH_TOKEN: Joi.string()
        .min(20)
        .required(),

    TWILIO_VERIFY_SERVICE_SID: Joi.string()
        .pattern(/^VA[a-fA-F0-9]{32}$/)
        .required(),

    OTP_EXPIRY_MINUTES: Joi.number().default(5),

    // Razorpay Configuration
    RAZORPAY_MODE: Joi.string()
        .valid('test', 'live')
        .default('test'),

    RAZORPAY_KEY_ID: Joi.string()
        .optional()
        .allow('', 'rzp_test_placeholder'),

    RAZORPAY_KEY_SECRET: Joi.string()
        .optional()
        .allow('', 'rzp_secret_placeholder'),

    ADMIN_REGISTRATION_SECRET: Joi.string()
        .min(24)
        .optional()
        .allow(''),

}).unknown(true);

const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    convert: true,
});

if (error) {
    console.error(
        'Invalid environment variables:',
        error.details.map((d) => d.message)
    );

    process.exit(1);
}

export const env = value;
