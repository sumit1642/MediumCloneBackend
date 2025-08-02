// utils/responses.js
// Standardized response utilities for consistent API responses

export const ResponseStatus = {
	SUCCESS: "success",
	ERROR: "error",
	WARNING: "warning",
}

export const ResponseCodes = {
	// Success codes
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,

	// Client error codes
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,

	// Server error codes
	INTERNAL_SERVER_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
}

// Base response structure
class ApiResponse {
	constructor(status, message, data = null, meta = null, errors = null) {
		this.status = status
		this.message = message
		this.timestamp = new Date().toISOString()

		if (data !== null) {
			this.data = data
		}

		if (meta !== null) {
			this.meta = meta
		}

		if (errors !== null) {
			this.errors = errors
		}
	}
}

// Success response builders
export const successResponse = (
	res,
	message,
	data = null,
	statusCode = ResponseCodes.OK,
	meta = null,
) => {
	const response = new ApiResponse(ResponseStatus.SUCCESS, message, data, meta)
	return res.status(statusCode).json(response)
}

export const createdResponse = (res, message, data = null, meta = null) => {
	return successResponse(res, message, data, ResponseCodes.CREATED, meta)
}

// Error response builders
export const errorResponse = (
	res,
	message,
	statusCode = ResponseCodes.INTERNAL_SERVER_ERROR,
	errors = null,
	meta = null,
) => {
	const response = new ApiResponse(ResponseStatus.ERROR, message, null, meta, errors)
	return res.status(statusCode).json(response)
}

export const badRequestResponse = (res, message, errors = null) => {
	return errorResponse(res, message, ResponseCodes.BAD_REQUEST, errors)
}

export const unauthorizedResponse = (res, message = "Authentication required", code = null) => {
	const meta = code ? { code } : null
	return errorResponse(res, message, ResponseCodes.UNAUTHORIZED, null, meta)
}

export const forbiddenResponse = (res, message = "Access forbidden") => {
	return errorResponse(res, message, ResponseCodes.FORBIDDEN)
}

export const notFoundResponse = (res, message = "Resource not found") => {
	return errorResponse(res, message, ResponseCodes.NOT_FOUND)
}

export const conflictResponse = (res, message = "Resource already exists") => {
	return errorResponse(res, message, ResponseCodes.CONFLICT)
}

export const validationErrorResponse = (res, message = "Validation failed", errors = []) => {
	return errorResponse(res, message, ResponseCodes.UNPROCESSABLE_ENTITY, errors)
}

export const rateLimitResponse = (res, message = "Too many requests", retryAfter = null) => {
	const meta = retryAfter ? { retryAfter } : null
	return errorResponse(res, message, ResponseCodes.TOO_MANY_REQUESTS, null, meta)
}

export const serverErrorResponse = (res, message = "Internal server error") => {
	return errorResponse(res, message, ResponseCodes.INTERNAL_SERVER_ERROR)
}

// Warning response builder
export const warningResponse = (
	res,
	message,
	data = null,
	warnings = [],
	statusCode = ResponseCodes.OK,
) => {
	const response = new ApiResponse(ResponseStatus.WARNING, message, data, null, warnings)
	return res.status(statusCode).json(response)
}

// Pagination utility
export const createPaginationMeta = (page, limit, total, hasNext = null, hasPrev = null) => {
	const pages = Math.ceil(total / limit)

	return {
		pagination: {
			page: parseInt(page),
			limit: parseInt(limit),
			total: parseInt(total),
			pages,
			hasNext: hasNext !== null ? hasNext : page < pages,
			hasPrev: hasPrev !== null ? hasPrev : page > 1,
		},
	}
}

// Enhanced success response with pagination
export const paginatedResponse = (res, message, data, page, limit, total) => {
	const meta = createPaginationMeta(page, limit, total)
	return successResponse(res, message, data, ResponseCodes.OK, meta)
}

// Response validation
export const validateResponseData = (data, requiredFields = []) => {
	if (!data || typeof data !== "object") {
		return { isValid: false, errors: ["Data must be an object"] }
	}

	const errors = []
	requiredFields.forEach((field) => {
		if (!(field in data)) {
			errors.push(`Missing required field: ${field}`)
		}
	})

	return { isValid: errors.length === 0, errors }
}

// Async response wrapper for controllers
export const asyncResponse = (controllerFn) => {
	return async (req, res, next) => {
		try {
			await controllerFn(req, res, next)
		} catch (error) {
			console.error("Controller error:", error)

			// Handle known error types
			if (error.message === "Validation failed") {
				return badRequestResponse(res, error.message, error.errors)
			}

			if (error.message === "Not found") {
				return notFoundResponse(res, error.message)
			}

			if (error.message === "Unauthorized") {
				return unauthorizedResponse(res, error.message)
			}

			if (error.message === "Forbidden") {
				return forbiddenResponse(res, error.message)
			}

			// Default to server error
			return serverErrorResponse(res, "An unexpected error occurred")
		}
	}
}

// Response transformation utilities
export const transformUser = (user) => ({
	id: user.id,
	name: user.name,
	email: user.email,
	createdAt: user.createdAt,
})

export const transformPost = (post, userId = null) => ({
	id: post.id,
	title: post.title,
	content: post.content,
	published: post.published,
	createdAt: post.createdAt,
	updatedAt: post.updatedAt,
	author: transformUser(post.author),
	commentsCount: post._count?.comments || post.comments?.length || 0,
	likesCount: post._count?.likes || post.likes?.length || 0,
	isLikedByUser: userId ? post.likes?.some((like) => like.userId === userId) || false : false,
	tags: post.tags?.map((pt) => pt.tag) || [],
})

export const transformComment = (comment) => ({
	id: comment.id,
	content: comment.content,
	createdAt: comment.createdAt,
	updatedAt: comment.updatedAt,
	author: {
		id: comment.author.id,
		name: comment.author.name,
	},
})

// Error code mapping for database errors
export const mapDatabaseError = (error) => {
	const errorMappings = {
		P2002: {
			message: "A record with this information already exists",
			status: ResponseCodes.CONFLICT,
		},
		P2025: { message: "Record not found", status: ResponseCodes.NOT_FOUND },
		P2003: { message: "Foreign key constraint failed", status: ResponseCodes.BAD_REQUEST },
		P2004: { message: "Database constraint failed", status: ResponseCodes.BAD_REQUEST },
	}

	return (
		errorMappings[error.code] || {
			message: "Database operation failed",
			status: ResponseCodes.INTERNAL_SERVER_ERROR,
		}
	)
}
