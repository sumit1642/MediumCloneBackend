// middleware/posts.middleware.js
import jwt from "jsonwebtoken"
import { sanitizeInput, validateInputLength } from "../utils/security.js"
import { config } from "../config/env.js"
import { prisma } from "../utils/prisma.js"

// Required authentication with proper error handling
export const requireAuth = async (req, res, next) => {
	try {
		const accessToken = req.cookies?.accessToken

		if (!accessToken) {
			return res.status(401).json({
				status: "error",
				message: "Access token required. Please login.",
				code: "TOKEN_MISSING",
			})
		}

		try {
			const decoded = jwt.verify(accessToken, config.jwtSecret)

			// Verify user still exists
			const user = await prisma.user.findUnique({
				where: { id: decoded.userId },
				select: { id: true, name: true, email: true },
			})

			if (!user) {
				// Clear invalid cookies
				res.clearCookie("accessToken", { path: "/" })
				res.clearCookie("refreshToken", { path: "/" })

				return res.status(401).json({
					status: "error",
					message: "User account no longer exists. Please login again.",
					code: "USER_NOT_FOUND",
				})
			}

			req.user = { ...decoded, userExists: true }
			next()
		} catch (jwtError) {
			console.error("JWT verification error:", jwtError)

			// Clear potentially corrupted cookies
			res.clearCookie("accessToken", { path: "/" })

			if (jwtError.name === "TokenExpiredError") {
				return res.status(401).json({
					status: "error",
					message: "Access token expired. Please refresh your token.",
					code: "TOKEN_EXPIRED",
				})
			}

			if (jwtError.name === "JsonWebTokenError") {
				return res.status(401).json({
					status: "error",
					message: "Invalid access token. Please login again.",
					code: "TOKEN_INVALID",
				})
			}

			return res.status(401).json({
				status: "error",
				message: "Authentication failed. Please login again.",
				code: "AUTH_FAILED",
			})
		}
	} catch (error) {
		console.error("Auth middleware error:", error)
		return res.status(500).json({
			status: "error",
			message: "Authentication service unavailable",
		})
	}
}

// Optional authentication with graceful error handling
export const optionalAuth = async (req, res, next) => {
	try {
		const accessToken = req.cookies?.accessToken

		if (accessToken) {
			try {
				const decoded = jwt.verify(accessToken, config.jwtSecret)

				// Verify user still exists (non-blocking)
				const user = await prisma.user.findUnique({
					where: { id: decoded.userId },
					select: { id: true, name: true, email: true },
				})

				if (user) {
					req.user = { ...decoded, userExists: true }
				} else {
					// User doesn't exist, clear cookies silently
					res.clearCookie("accessToken", { path: "/" })
					res.clearCookie("refreshToken", { path: "/" })
				}
			} catch (jwtError) {
				// Silently handle token errors in optional auth
				console.log("Optional auth token error:", jwtError.message)

				// Clear potentially invalid cookies
				if (jwtError.name !== "TokenExpiredError") {
					res.clearCookie("accessToken", { path: "/" })
				}
			}
		}

		next()
	} catch (error) {
		// Don't fail the request, just continue without auth
		console.log("Optional auth error:", error.message)
		next()
	}
}

// Enhanced post data validation
export const validatePostData = async (req, res, next) => {
	try {
		const { title, content, published } = req.body
		const validationErrors = []

		// Title validation
		if (title !== undefined) {
			const titleValidation = validateInputLength(title, "Title", 1, 50)
			if (!titleValidation.isValid) {
				validationErrors.push(titleValidation.message)
			} else {
				req.body.title = titleValidation.sanitized
			}
		}

		// Content validation
		if (content !== undefined) {
			const contentValidation = validateInputLength(
				content,
				"Content",
				1,
				config.maxContentLength,
			)
			if (!contentValidation.isValid) {
				validationErrors.push(contentValidation.message)
			} else {
				req.body.content = contentValidation.sanitized
			}
		}

		// Published validation
		if (published !== undefined) {
			if (typeof published !== "boolean" && published !== "true" && published !== "false") {
				validationErrors.push("Published must be a boolean value")
			} else {
				req.body.published = Boolean(published)
			}
		}

		if (validationErrors.length > 0) {
			return res.status(400).json({
				status: "error",
				message: "Validation failed",
				errors: validationErrors,
			})
		}

		next()
	} catch (error) {
		console.error("Post validation error:", error)
		return res.status(500).json({
			status: "error",
			message: "Validation service unavailable",
		})
	}
}

// Enhanced comment data validation
export const validateCommentData = (req, res, next) => {
	try {
		const { content } = req.body

		const contentValidation = validateInputLength(content, "Comment content", 1, 500)
		if (!contentValidation.isValid) {
			return res.status(400).json({
				status: "error",
				message: contentValidation.message,
			})
		}

		req.body.content = contentValidation.sanitized
		next()
	} catch (error) {
		console.error("Comment validation error:", error)
		return res.status(500).json({
			status: "error",
			message: "Validation service unavailable",
		})
	}
}

// Enhanced tag data validation
export const validateTagData = (req, res, next) => {
	try {
		const { tagName } = req.body

		if (!tagName || !tagName.trim()) {
			return res.status(400).json({
				status: "error",
				message: "Tag name is required",
			})
		}

		const sanitizedTagName = sanitizeInput(tagName.trim()).toLowerCase()

		// Enhanced tag validation
		if (sanitizedTagName.length < 2) {
			return res.status(400).json({
				status: "error",
				message: "Tag name must be at least 2 characters long",
			})
		}

		if (sanitizedTagName.length > 20) {
			return res.status(400).json({
				status: "error",
				message: "Tag name cannot be longer than 20 characters",
			})
		}

		// More restrictive tag character validation
		if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(sanitizedTagName)) {
			return res.status(400).json({
				status: "error",
				message:
					"Tag name can only contain lowercase letters, numbers, and hyphens (not at start/end)",
			})
		}

		// Prevent reserved tag names
		const reservedTags = ["admin", "api", "system", "null", "undefined", "delete", "update"]
		if (reservedTags.includes(sanitizedTagName)) {
			return res.status(400).json({
				status: "error",
				message: "This tag name is reserved and cannot be used",
			})
		}

		req.body.tagName = sanitizedTagName
		next()
	} catch (error) {
		console.error("Tag validation error:", error)
		return res.status(500).json({
			status: "error",
			message: "Validation service unavailable",
		})
	}
}

// Profile data validation
export const validateProfileData = (req, res, next) => {
	try {
		const { name, bio } = req.body
		const validationErrors = []

		// Name validation
		if (name !== undefined) {
			const nameValidation = validateInputLength(name, "Name", 2, 50)
			if (!nameValidation.isValid) {
				validationErrors.push(nameValidation.message)
			} else {
				req.body.name = nameValidation.sanitized
			}
		}

		// Bio validation
		if (bio !== undefined) {
			const bioValidation = validateInputLength(bio, "Bio", 0, config.maxBioLength)
			if (!bioValidation.isValid) {
				validationErrors.push(bioValidation.message)
			} else {
				req.body.bio = bioValidation.sanitized
			}
		}

		if (validationErrors.length > 0) {
			return res.status(400).json({
				status: "error",
				message: "Validation failed",
				errors: validationErrors,
			})
		}

		next()
	} catch (error) {
		console.error("Profile validation error:", error)
		return res.status(500).json({
			status: "error",
			message: "Validation service unavailable",
		})
	}
}

// ID validation utility
export const validateId = (id, fieldName = "ID") => {
	const parsedId = parseInt(id)
	if (isNaN(parsedId) || parsedId <= 0) {
		return { isValid: false, message: `Invalid ${fieldName}` }
	}
	return { isValid: true, id: parsedId }
}

// Middleware to validate route parameters
export const validateRouteParams = (paramNames = []) => {
	return (req, res, next) => {
		const errors = []

		paramNames.forEach((paramName) => {
			const paramValue = req.params[paramName]
			const validation = validateId(paramValue, paramName)

			if (!validation.isValid) {
				errors.push(validation.message)
			} else {
				req.params[paramName] = validation.id
			}
		})

		if (errors.length > 0) {
			return res.status(400).json({
				status: "error",
				message: "Invalid route parameters",
				errors,
			})
		}

		next()
	}
}
