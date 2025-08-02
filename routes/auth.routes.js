// routes/auth.routes.js
import express from "express"
import {
	loginUser,
	refreshUserToken,
	registerNewUser,
	logoutCurrentUser,
	validateSession,
	getCurrentUser,
} from "../controllers/auth.controller.js"
import {
	validateLoginCredentials,
	validateRegistrationData,
	redirectIfAuthenticated,
	validateCSRF,
} from "../middleware/auth.middleware.js"
import { requireAuth } from "../middleware/posts.middleware.js"
import { authRateLimit } from "../utils/security.js"

export const authenticationRoutes = express.Router()

// Apply CSRF protection to state-changing operations
// Apply stricter rate limiting to auth endpoints

// User registration endpoint - creates new user account
authenticationRoutes.post(
	"/register",
	authRateLimit,
	redirectIfAuthenticated,
	validateCSRF,
	validateRegistrationData,
	registerNewUser,
)

// User login endpoint - authenticates existing user
authenticationRoutes.post(
	"/login",
	authRateLimit,
	redirectIfAuthenticated,
	validateCSRF,
	validateLoginCredentials,
	loginUser,
)

// Token refresh endpoint - generates new access token using refresh token
authenticationRoutes.post("/refresh", authRateLimit, refreshUserToken)

// User logout endpoint - clears authentication tokens
authenticationRoutes.post("/logout", validateCSRF, logoutCurrentUser)

// Session validation endpoint - checks if current session is valid
authenticationRoutes.get("/validate", validateSession)

// Get current user info - requires authentication
authenticationRoutes.get("/me", requireAuth, getCurrentUser)
