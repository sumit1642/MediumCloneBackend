// index.js
import express from "express"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import cors from "cors"
import { authenticationRoutes } from "./routes/auth.routes.js"
import { postRoute } from "./routes/post.routes.js"
import { interactionRoute } from "./routes/interaction.routes.js"
import { profileRoute } from "./routes/profile.routes.js"
import { tagRoute } from "./routes/tag.routes.js"
import { getAllPostsController } from "./controllers/post.controller.js"
import { optionalAuth } from "./middleware/posts.middleware.js"
import { apiRateLimit, generateCSRFToken } from "./utils/security.js"
import { config, validateEnvironment } from "./config/env.js"
import { cleanupExpiredRefreshTokens } from "./services/auth.service.js"

// Validate environment before starting
validateEnvironment()

const app = express()

// Trust proxy for accurate IP addresses
app.set("trust proxy", 1)

// Enhanced security headers with Helmet
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'"],
				imgSrc: ["'self'", "data:", "https:"],
				connectSrc: ["'self'"],
				fontSrc: ["'self'"],
				objectSrc: ["'none'"],
				mediaSrc: ["'self'"],
				frameSrc: ["'none'"],
			},
		},
		crossOriginEmbedderPolicy: false,
	}),
)

// Basic middleware configuration
app.use(
	express.json({
		limit: "10mb",
		verify: (req, res, buf) => {
			// Store raw body for webhook verification if needed
			req.rawBody = buf
		},
	}),
)
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(cookieParser())

// Enhanced CORS configuration
const corsOptions = {
	origin: (origin, callback) => {
		// Allow requests with no origin (mobile apps, postman, etc.)
		if (!origin) return callback(null, true)

		if (config.allowedOrigins.includes(origin)) {
			return callback(null, true)
		}

		return callback(new Error("Not allowed by CORS"))
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: [
		"Origin",
		"X-Requested-With",
		"Content-Type",
		"Accept",
		"Authorization",
		"X-CSRF-Token",
	],
	optionsSuccessStatus: 200,
	maxAge: 86400, // 24 hours
}

app.use(cors(corsOptions))

// Apply rate limiting
app.use(apiRateLimit)

// Health check endpoint with enhanced information
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "success",
		message: "Server is running",
		timestamp: new Date().toISOString(),
		environment: config.nodeEnv,
		version: "1.0.0",
		uptime: process.uptime(),
		memory: process.memoryUsage(),
	})
})

// CSRF token endpoint
app.get("/api/csrf-token", (req, res) => {
	const token = generateCSRFToken()
	res.json({
		status: "success",
		message: "CSRF token generated",
		data: { csrfToken: token },
	})
})

// API Routes configuration
app.use("/api/auth", authenticationRoutes)
app.use("/api/posts", postRoute)
app.use("/api/interactions", interactionRoute)
app.use("/api/profile", profileRoute)
app.use("/api/tags", tagRoute)

// Home route - display all published posts with optional authentication
app.get("/", optionalAuth, getAllPostsController)

// Enhanced API Documentation endpoint
app.get("/api", (req, res) => {
	res.status(200).json({
		status: "success",
		message: "Blog API v1.0",
		version: "1.0.0",
		documentation: {
			endpoints: {
				auth: {
					path: "/api/auth",
					description: "Authentication endpoints",
					methods: ["POST"],
				},
				posts: {
					path: "/api/posts",
					description: "Blog post management",
					methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
				},
				interactions: {
					path: "/api/interactions",
					description: "Likes and comments",
					methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
				},
				profile: {
					path: "/api/profile",
					description: "User profile management",
					methods: ["GET", "PUT", "PATCH"],
				},
				tags: {
					path: "/api/tags",
					description: "Tag management",
					methods: ["GET", "POST", "DELETE"],
				},
			},
			authentication: "JWT tokens via HTTP-only cookies",
			rateLimit: {
				window: "15 minutes",
				maxRequests: config.rateLimitMaxRequests,
			},
		},
		links: {
			health: "/health",
			csrfToken: "/api/csrf-token",
		},
	})
})

// 404 handler specifically for API routes
app.use("/api", (req, res) => {
	res.status(404).json({
		status: "error",
		message: "API endpoint not found",
		requestedPath: req.path,
		method: req.method,
		availableEndpoints: [
			"/api/auth",
			"/api/posts",
			"/api/interactions",
			"/api/profile",
			"/api/tags",
		],
		documentation: "/api",
	})
})

// General 404 handler for all other routes
app.use((req, res) => {
	res.status(404).json({
		status: "error",
		message: "Route not found",
		requestedPath: req.path,
		method: req.method,
		suggestion: "Check the API documentation at /api",
	})
})

// Enhanced error handling middleware
app.use((err, req, res, next) => {
	// Log error details
	console.error("Application error:", {
		message: err.message,
		stack: config.nodeEnv === "development" ? err.stack : undefined,
		url: req.url,
		method: req.method,
		ip: req.ip,
		userAgent: req.get("User-Agent"),
		timestamp: new Date().toISOString(),
	})

	// Handle specific error types
	if (err.type === "entity.parse.failed") {
		return res.status(400).json({
			status: "error",
			message: "Invalid JSON in request body",
		})
	}

	if (err.message === "Not allowed by CORS") {
		return res.status(403).json({
			status: "error",
			message: "CORS policy violation",
		})
	}

	if (err.code === "LIMIT_FILE_SIZE") {
		return res.status(413).json({
			status: "error",
			message: "Request entity too large",
		})
	}

	// Default error response
	const statusCode = err.status || err.statusCode || 500
	const response = {
		status: "error",
		message: config.nodeEnv === "production" ? "Internal server error" : err.message,
	}

	if (config.nodeEnv === "development") {
		response.stack = err.stack
		response.details = {
			code: err.code,
			errno: err.errno,
			syscall: err.syscall,
		}
	}

	res.status(statusCode).json(response)
})

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
	console.log(`\n🔄 Received ${signal}, shutting down gracefully...`)

	try {
		// Cleanup expired tokens before shutdown
		await cleanupExpiredRefreshTokens()
		console.log("✅ Cleanup completed")
	} catch (error) {
		console.error("❌ Cleanup error:", error)
	}

	process.exit(0)
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
	console.error("Uncaught Exception:", error)
	process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason)
})

// Periodic cleanup of expired tokens (every hour)
if (config.nodeEnv === "production") {
	setInterval(async () => {
		try {
			await cleanupExpiredRefreshTokens()
		} catch (error) {
			console.error("Periodic cleanup error:", error)
		}
	}, 60 * 60 * 1000) // 1 hour
}

// Start server
const server = app.listen(config.port, () => {
	console.log(`🚀 Server running on http://localhost:${config.port}`)
	console.log(`📊 Health check: http://localhost:${config.port}/health`)
	console.log(`📖 API info: http://localhost:${config.port}/api`)
	console.log(`🌍 Environment: ${config.nodeEnv}`)
	console.log(`🔒 CORS origins: ${config.allowedOrigins.join(", ")}`)
	console.log(
		`⚡ Rate limit: ${config.rateLimitMaxRequests} requests per ${
			config.rateLimitWindowMs / 1000 / 60
		} minutes`,
	)
})

// Handle server errors
server.on("error", (error) => {
	if (error.code === "EADDRINUSE") {
		console.error(`❌ Port ${config.port} is already in use`)
	} else {
		console.error("❌ Server error:", error)
	}
	process.exit(1)
})

export default app
