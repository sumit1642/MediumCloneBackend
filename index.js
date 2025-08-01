// index.js
import express from "express"
import cookieParser from "cookie-parser"
import { authenticationRoutes } from "./routes/auth.routes.js"
import { postRoute } from "./routes/post.routes.js"
import { interactionRoute } from "./routes/interaction.routes.js"
import { profileRoute } from "./routes/profile.routes.js"
import { tagRoute } from "./routes/tag.routes.js"
import { getAllPostsController } from "./controllers/post.controller.js"
import { optionalAuth } from "./middleware/posts.middleware.js"

const app = express()

// Security headers middleware - protect against common vulnerabilities
app.use((req, res, next) => {
	res.setHeader("X-Content-Type-Options", "nosniff")
	res.setHeader("X-Frame-Options", "DENY")
	res.setHeader("X-XSS-Protection", "1; mode=block")
	next()
})

// Basic middleware configuration
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(cookieParser())

// CORS configuration for cross-origin requests
const corsConfigurationOptions = {
	origin:
		process.env.NODE_ENV === "production"
			? process.env.ALLOWED_ORIGINS?.split(",") || false
			: "http://localhost:3001",
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
	optionsSuccessStatus: 200,
}

// Apply CORS middleware manually for better control
app.use((req, res, next) => {
	const requestOrigin = req.headers.origin

	// Handle production origins
	if (process.env.NODE_ENV === "production") {
		const allowedOriginsList = process.env.ALLOWED_ORIGINS?.split(",") || []
		if (allowedOriginsList.includes(requestOrigin)) {
			res.header("Access-Control-Allow-Origin", requestOrigin)
		}
	} else {
		// Development mode - allow configured origin
		res.header("Access-Control-Allow-Origin", corsConfigurationOptions.origin)
	}

	res.header("Access-Control-Allow-Credentials", "true")
	res.header("Access-Control-Allow-Headers", corsConfigurationOptions.allowedHeaders.join(", "))
	res.header("Access-Control-Allow-Methods", corsConfigurationOptions.methods.join(", "))

	// Handle preflight OPTIONS requests
	if (req.method === "OPTIONS") {
		return res.status(200).end()
	}
	next()
})

// Health check endpoint - verify server status
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "success",
		message: "Server is running",
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV || "development",
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

// API Documentation endpoint
app.get("/api", (req, res) => {
	res.status(200).json({
		status: "success",
		message: "Blog API v1.0",
		endpoints: {
			auth: "/api/auth",
			posts: "/api/posts",
			interactions: "/api/interactions",
			profile: "/api/profile",
			tags: "/api/tags",
		},
		docs: "Visit /api/docs for detailed documentation",
	})
})

// 404 handler specifically for API routes
app.use("/api", (req, res) => {
	res.status(404).json({
		status: "error",
		message: "API endpoint not found",
		availableEndpoints: [
			"/api/auth",
			"/api/posts",
			"/api/interactions",
			"/api/profile",
			"/api/tags",
		],
	})
})

// General 404 handler for all other routes
app.use((req, res) => {
	res.status(404).json({
		status: "error",
		message: "Route not found",
	})
})

// Enhanced error handling middleware
app.use((err, req, res, next) => {
	console.error("Unhandled application error:", {
		message: err.message,
		stack: err.stack,
		url: req.url,
		method: req.method,
		timestamp: new Date().toISOString(),
	})

	// Don't expose internal errors in production environment
	if (process.env.NODE_ENV === "production") {
		res.status(err.status || 500).json({
			status: "error",
			message: "Internal server error",
		})
	} else {
		res.status(err.status || 500).json({
			status: "error",
			message: err.message,
			stack: err.stack,
		})
	}
})

// Graceful shutdown handlers
const handleGracefulShutdown = (signalName) => {
	console.log(`\n🔄 Received ${signalName}, shutting down gracefully...`)
	process.exit(0)
}

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"))
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"))

// Start server
const SERVER_PORT = process.env.PORT || 3000

app.listen(SERVER_PORT, () => {
	console.log(`🚀 Server running on http://localhost:${SERVER_PORT}`)
	console.log(`📊 Health check: http://localhost:${SERVER_PORT}/health`)
	console.log(`📖 API info: http://localhost:${SERVER_PORT}/api`)
	console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
})
