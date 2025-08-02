// config/env.js
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Validate required environment variables
const requiredEnvVars = ["JWT_SECRET_KEY", "DATABASE_URL"]

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar])

if (missingEnvVars.length > 0) {
	console.error("❌ Missing required environment variables:", missingEnvVars.join(", "))
	process.exit(1)
}

// Validate JWT secret strength
if (process.env.JWT_SECRET_KEY.length < 32) {
	console.error("❌ JWT_SECRET_KEY must be at least 32 characters long")
	process.exit(1)
}

// Validate DATABASE_URL format
const databaseUrlPattern = /^mysql:\/\/.+/
if (!databaseUrlPattern.test(process.env.DATABASE_URL)) {
	console.error("❌ DATABASE_URL must be a valid MySQL connection string")
	process.exit(1)
}

// Configuration object with defaults and validation
export const config = {
	port: parseInt(process.env.PORT) || 3000,
	nodeEnv: process.env.NODE_ENV || "development",
	jwtSecret: process.env.JWT_SECRET_KEY,
	databaseUrl: process.env.DATABASE_URL,

	// Security settings
	accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
	refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 7 * 24 * 60 * 60 * 1000, // 7 days

	// CORS settings
	allowedOrigins:
		process.env.NODE_ENV === "production"
			? process.env.ALLOWED_ORIGINS?.split(",") || []
			: ["http://localhost:3001"],

	// Rate limiting
	rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
	rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

	// Content limits
	maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH) || 1000,
	maxBioLength: parseInt(process.env.MAX_BIO_LENGTH) || 500,
	maxTitleLength: parseInt(process.env.MAX_TITLE_LENGTH) || 100,
}

// Validation function for runtime checks
export const validateEnvironment = () => {
	const errors = []

	if (config.port < 1 || config.port > 65535) {
		errors.push("PORT must be between 1 and 65535")
	}

	if (!["development", "test", "production"].includes(config.nodeEnv)) {
		errors.push("NODE_ENV must be development, test, or production")
	}

	if (config.rateLimitMaxRequests < 1) {
		errors.push("RATE_LIMIT_MAX_REQUESTS must be at least 1")
	}

	if (errors.length > 0) {
		console.error("❌ Environment validation errors:", errors.join(", "))
		process.exit(1)
	}

	console.log("✅ Environment configuration validated successfully")
}
