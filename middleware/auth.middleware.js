// middleware/auth.middleware.js
import { prisma } from "../utils/prisma.js"
import jwt from "jsonwebtoken"
import {
	sanitizeInput,
	validateEmailFormat,
	validatePasswordStrength,
	validateInputLength,
	validateCSRFToken,
} from "../utils/security.js"
import { config } from "../config/env.js"

// Middleware to redirect authenticated users away from auth pages
export const redirectIfAuthenticated = async (req, res, next) => {
	try {
		const userAccessToken = req.cookies?.accessToken

		if (!userAccessToken) {
			return next()
		}

		try {
			const decodedTokenPayload = jwt.verify(userAccessToken, config.jwtSecret)

			// Verify user still exists in database
			const user = await prisma.user.findUnique({
				where: { id: decodedTokenPayload.userId },
				select: { id: true, name: true, email: true },
			})

			if (!user) {
				// User no longer exists, clear cookies
				res.clearCookie("accessToken", { path: "/" })
				res.clearCookie("refreshToken", { path: "/" })
				return next()
			}

			return res.status(302).json({
				status: "redirect",
				message: "Already authenticated",
				redirectUrl: "/",
				data: { user },
			})
		} catch (tokenVerificationError) {
			// Token is invalid/expired, clear it and allow access
			res.clearCookie("accessToken", { path: "/" })
			res.clearCookie("refreshToken", { path: "/" })
			return next()
		}
	} catch (unexpectedError) {
		console.error("Redirect if authenticated middleware error:", unexpectedError)
		return next()
	}
}

// CSRF protection middleware
export const validateCSRF = (req, res, next) => {
	// Skip CSRF for GET requests and health checks
	if (req.method === "GET" || req.path === "/health") {
		return next()
	}

	const csrfToken = req.headers["x-csrf-token"] || req.body.csrfToken

	if (!validateCSRFToken(csrfToken)) {
		return res.status(403).json({
			status: "error",
			message: "Invalid or missing CSRF token",
		})
	}

	next()
}

// Enhanced registration validation middleware
export const validateRegistrationData = async (req, res, next) => {
	try {
		const { name, email, password } = req.body

		// Validate name
		const nameValidation = validateInputLength(name, "Name", 2, 50)
		if (!nameValidation.isValid) {
			return res.status(400).json({
				status: "error",
				message: nameValidation.message,
			})
		}

		// Validate email
		if (!email || !email.trim()) {
			return res.status(400).json({
				status: "error",
				message: "Email is required",
			})
		}

		const sanitizedEmail = email.trim().toLowerCase()
		if (!validateEmailFormat(sanitizedEmail)) {
			return res.status(400).json({
				status: "error",
				message: "Please provide a valid email address",
			})
		}

		// Validate password
		const passwordValidation = validatePasswordStrength(password)
		if (!passwordValidation.isValid) {
			return res.status(400).json({
				status: "error",
				message: passwordValidation.message,
			})
		}

		// Check for existing user with proper error handling
		try {
			const existingUser = await prisma.user.findUnique({
				where: { email: sanitizedEmail },
			})

			if (existingUser) {
				return res.status(409).json({
					status: "error",
					message: "User with this email already exists",
				})
			}
		} catch (dbError) {
			console.error("Database error during registration validation:", dbError)
			return res.status(500).json({
				status: "error",
				message: "Unable to validate user data",
			})
		}

		// Prepare sanitized data
		req.body = {
			name: nameValidation.sanitized,
			email: sanitizedEmail,
			password: password, // Keep original for hashing
			...(passwordValidation.isWeak && { passwordWarning: passwordValidation.message }),
		}

		next()
	} catch (error) {
		console.error("Registration validation error:", error)
		return res.status(500).json({
			status: "error",
			message: "Validation failed",
		})
	}
}

// Enhanced login validation middleware
export const validateLoginCredentials = async (req, res, next) => {
	try {
		const { email, password } = req.body

		// Validate required fields
		if (!email || !email.trim()) {
			return res.status(400).json({
				status: "error",
				message: "Email is required",
			})
		}

		if (!password || !password.trim()) {
			return res.status(400).json({
				status: "error",
				message: "Password is required",
			})
		}

		// Validate email format
		const sanitizedEmail = email.trim().toLowerCase()
		if (!validateEmailFormat(sanitizedEmail)) {
			return res.status(400).json({
				status: "error",
				message: "Please provide a valid email address",
			})
		}

		// Find user with proper error handling
		try {
			const userRecord = await prisma.user.findUnique({
				where: { email: sanitizedEmail },
			})

			if (!userRecord) {
				// Don't reveal whether email exists or not
				return res.status(401).json({
					status: "error",
					message: "Invalid email or password",
				})
			}

			req.foundUserRecord = userRecord
			req.body.password = password
			next()
		} catch (dbError) {
			console.error("Database error during login validation:", dbError)
			return res.status(500).json({
				status: "error",
				message: "Unable to validate credentials",
			})
		}
	} catch (error) {
		console.error("Login validation error:", error)
		return res.status(500).json({
			status: "error",
			message: "Validation failed",
		})
	}
}

// Enhanced user existence check
export const checkUserExists = async (userId) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, name: true, email: true },
		})
		return user
	} catch (error) {
		console.error("User existence check error:", error)
		return null
	}
}

// JWT token validation with user existence check
export const validateJWTToken = async (token) => {
	try {
		const decoded = jwt.verify(token, config.jwtSecret)

		// Check if user still exists
		const user = await checkUserExists(decoded.userId)
		if (!user) {
			throw new Error("User no longer exists")
		}

		return { ...decoded, user }
	} catch (error) {
		throw error
	}
}

// Middleware to validate content length against database constraints
export const validateContentConstraints = (req, res, next) => {
	const { title, content, bio } = req.body
	const errors = []

	if (title !== undefined && title.length > 50) {
		errors.push("Title cannot exceed 50 characters (database constraint)")
	}

	if (content !== undefined && content.length > config.maxContentLength) {
		errors.push(`Content cannot exceed ${config.maxContentLength} characters`)
	}

	if (bio !== undefined && bio.length > config.maxBioLength) {
		errors.push(`Bio cannot exceed ${config.maxBioLength} characters`)
	}

	if (errors.length > 0) {
		return res.status(400).json({
			status: "error",
			message: "Content length validation failed",
			errors,
		})
	}

	next()
}
