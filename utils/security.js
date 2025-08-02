// utils/security.js
import crypto from "crypto"
import DOMPurify from "isomorphic-dompurify"
import rateLimit from "express-rate-limit"
import { config } from "../config/env.js"

// Enhanced XSS sanitization
export const sanitizeInput = (input) => {
	if (typeof input !== "string") return input

	// Use DOMPurify for comprehensive XSS protection
	const sanitized = DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [], // Remove all HTML tags
		ALLOWED_ATTR: [], // Remove all attributes
		KEEP_CONTENT: true, // Keep text content
	})

	// Additional sanitization for potential XSS vectors
	return sanitized
		.replace(/javascript:/gi, "") // Remove javascript: protocols
		.replace(/data:/gi, "") // Remove data: protocols
		.replace(/vbscript:/gi, "") // Remove vbscript: protocols
		.replace(/on\w+\s*=/gi, "") // Remove event handlers
		.trim()
}

// CSRF token generation and validation
const csrfTokens = new Map()

export const generateCSRFToken = () => {
	const token = crypto.randomBytes(32).toString("hex")
	const timestamp = Date.now()

	// Store with timestamp for expiry
	csrfTokens.set(token, timestamp)

	// Clean up expired tokens (older than 1 hour)
	const oneHourAgo = timestamp - 60 * 60 * 1000
	for (const [storedToken, storedTimestamp] of csrfTokens.entries()) {
		if (storedTimestamp < oneHourAgo) {
			csrfTokens.delete(storedToken)
		}
	}

	return token
}

export const validateCSRFToken = (token) => {
	if (!token || !csrfTokens.has(token)) {
		return false
	}

	const timestamp = csrfTokens.get(token)
	const oneHourAgo = Date.now() - 60 * 60 * 1000

	if (timestamp < oneHourAgo) {
		csrfTokens.delete(token)
		return false
	}

	// Token is valid, remove it (one-time use)
	csrfTokens.delete(token)
	return true
}

// Rate limiting configurations
export const createRateLimit = (options = {}) => {
	return rateLimit({
		windowMs: options.windowMs || config.rateLimitWindowMs,
		max: options.max || config.rateLimitMaxRequests,
		message: {
			status: "error",
			message: "Too many requests, please try again later.",
			retryAfter: Math.ceil((options.windowMs || config.rateLimitWindowMs) / 1000),
		},
		standardHeaders: true,
		legacyHeaders: false,
		// Use a more robust key generator
		keyGenerator: (req) => {
			return req.ip + ":" + (req.user?.userId || "anonymous")
		},
		// Skip successful requests in some cases
		skipSuccessfulRequests: options.skipSuccessfulRequests || false,
		...options,
	})
}

// Specific rate limits for different endpoints
export const authRateLimit = createRateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // 5 attempts per window
	skipSuccessfulRequests: true,
})

export const apiRateLimit = createRateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // 100 requests per window
})

export const strictRateLimit = createRateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 10, // 10 requests per minute
})

// Enhanced email validation
export const validateEmailFormat = (email) => {
	if (!email || typeof email !== "string") return false

	const emailRegex =
		/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

	// Additional checks
	if (email.length > 254) return false // RFC 5322 limit
	if (email.includes("..")) return false // Consecutive dots
	if (email.startsWith(".") || email.endsWith(".")) return false

	return emailRegex.test(email)
}

// Password strength validation
export const validatePasswordStrength = (password) => {
	if (!password || typeof password !== "string") {
		return { isValid: false, message: "Password is required" }
	}

	if (password.length < 6) {
		return { isValid: false, message: "Password must be at least 6 characters long" }
	}

	if (password.length > 128) {
		return { isValid: false, message: "Password cannot be longer than 128 characters" }
	}

	// Check for at least one number and one letter for stronger passwords
	if (password.length >= 8) {
		const hasNumber = /\d/.test(password)
		const hasLetter = /[a-zA-Z]/.test(password)

		if (!hasNumber || !hasLetter) {
			return {
				isValid: true,
				message: "Password is valid but could be stronger with both letters and numbers",
				isWeak: true,
			}
		}
	}

	return { isValid: true, message: "Password is valid" }
}

// Input length validation with proper limits
export const validateInputLength = (input, fieldName, minLength = 0, maxLength = null) => {
	if (!input && minLength > 0) {
		return { isValid: false, message: `${fieldName} is required` }
	}

	if (!input) return { isValid: true }

	const trimmedInput = input.trim()

	if (trimmedInput.length < minLength) {
		return {
			isValid: false,
			message: `${fieldName} must be at least ${minLength} characters long`,
		}
	}

	if (maxLength && trimmedInput.length > maxLength) {
		return {
			isValid: false,
			message: `${fieldName} cannot be longer than ${maxLength} characters`,
		}
	}

	return { isValid: true, sanitized: sanitizeInput(trimmedInput) }
}

// Secure cookie configuration
export const createSecureCookieConfig = (maxAgeMs) => ({
	httpOnly: true,
	secure: config.nodeEnv === "production",
	sameSite: "strict",
	path: "/",
	maxAge: maxAgeMs,
	// Add additional security for production
	...(config.nodeEnv === "production" && {
		domain: process.env.COOKIE_DOMAIN,
		signed: true,
	}),
})

// Generate secure random tokens
export const generateSecureToken = (length = 40) => {
	return crypto.randomBytes(length).toString("hex")
}
