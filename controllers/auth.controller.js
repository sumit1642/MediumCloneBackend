// controllers/auth.controller.js
import {
	createNewUserAccount,
	authenticateUserLogin,
	generateNewAccessToken,
	removeUserSession,
	validateTokenAndUser,
} from "../services/auth.service.js"
import { createSecureCookieConfig } from "../utils/security.js"
import { config } from "../config/env.js"

// Enhanced user registration controller
export const registerNewUser = async (req, res) => {
	try {
		const { name, email, password, passwordWarning } = req.body

		const newUserData = await createNewUserAccount({ name, email, password })

		const response = {
			status: "success",
			message: "User registered successfully",
			data: { user: newUserData },
		}

		// Include password strength warning if applicable
		if (passwordWarning) {
			response.warning = passwordWarning
		}

		return res.status(201).json(response)
	} catch (registrationError) {
		console.error("User registration error:", registrationError)

		// Handle specific registration errors
		if (registrationError.message === "User already exists") {
			return res.status(409).json({
				status: "error",
				message: "An account with this email already exists",
			})
		}

		if (registrationError.message.includes("Password")) {
			return res.status(400).json({
				status: "error",
				message: registrationError.message,
			})
		}

		// Handle database constraint errors
		if (registrationError.code === "P2002") {
			return res.status(409).json({
				status: "error",
				message: "An account with this email already exists",
			})
		}

		return res.status(500).json({
			status: "error",
			message: "Registration failed. Please try again.",
		})
	}
}

// Enhanced user login controller
export const loginUser = async (req, res) => {
	try {
		const userRecord = req.foundUserRecord
		const { password } = req.body

		const authenticationResult = await authenticateUserLogin(userRecord, password)

		// Set secure authentication cookies
		const accessTokenConfig = createSecureCookieConfig(15 * 60 * 1000) // 15 minutes
		const refreshTokenConfig = createSecureCookieConfig(config.refreshTokenExpiry)

		res.cookie("accessToken", authenticationResult.accessToken, accessTokenConfig)
		res.cookie("refreshToken", authenticationResult.refreshToken, refreshTokenConfig)

		return res.status(200).json({
			status: "success",
			message: "Logged in successfully",
			data: {
				user: authenticationResult.user,
				sessionInfo: {
					expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
				},
			},
		})
	} catch (loginError) {
		console.error("User login error:", loginError)

		if (loginError.message === "Invalid credentials") {
			return res.status(401).json({
				status: "error",
				message: "Invalid email or password",
			})
		}

		return res.status(500).json({
			status: "error",
			message: "Login failed. Please try again.",
		})
	}
}

// Enhanced token refresh controller
export const refreshUserToken = async (req, res) => {
	try {
		const currentRefreshToken = req.cookies.refreshToken

		if (!currentRefreshToken) {
			return res.status(401).json({
				status: "error",
				message: "Refresh token required",
				code: "TOKEN_MISSING",
			})
		}

		const tokenRefreshResult = await generateNewAccessToken(currentRefreshToken)

		// Set new secure authentication cookies
		const accessTokenConfig = createSecureCookieConfig(15 * 60 * 1000)
		const refreshTokenConfig = createSecureCookieConfig(config.refreshTokenExpiry)

		res.cookie("accessToken", tokenRefreshResult.accessToken, accessTokenConfig)
		res.cookie("refreshToken", tokenRefreshResult.refreshToken, refreshTokenConfig)

		return res.status(200).json({
			status: "success",
			message: "Token refreshed successfully",
			data: {
				user: tokenRefreshResult.user,
				sessionInfo: {
					expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
				},
			},
		})
	} catch (tokenRefreshError) {
		console.error("Token refresh error:", tokenRefreshError)

		// Clear authentication cookies on any refresh failure
		res.clearCookie("accessToken", { path: "/" })
		res.clearCookie("refreshToken", { path: "/" })

		if (tokenRefreshError.message === "Invalid refresh token") {
			return res.status(401).json({
				status: "error",
				message: "Invalid refresh token. Please login again.",
				code: "TOKEN_INVALID",
			})
		}

		if (tokenRefreshError.message === "Refresh token expired") {
			return res.status(401).json({
				status: "error",
				message: "Session expired. Please login again.",
				code: "TOKEN_EXPIRED",
			})
		}

		if (tokenRefreshError.message === "User not found") {
			return res.status(401).json({
				status: "error",
				message: "User account no longer exists. Please login again.",
				code: "USER_NOT_FOUND",
			})
		}

		return res.status(401).json({
			status: "error",
			message: "Token refresh failed. Please login again.",
			code: "REFRESH_FAILED",
		})
	}
}

// Enhanced logout controller
export const logoutCurrentUser = async (req, res) => {
	try {
		const currentRefreshToken = req.cookies.refreshToken

		// Remove refresh token from database
		await removeUserSession(currentRefreshToken)

		// Clear authentication cookies
		res.clearCookie("accessToken", { path: "/" })
		res.clearCookie("refreshToken", { path: "/" })

		return res.status(200).json({
			status: "success",
			message: "Logged out successfully",
		})
	} catch (logoutError) {
		console.error("User logout error:", logoutError)

		// Always clear cookies even if there's an error
		res.clearCookie("accessToken", { path: "/" })
		res.clearCookie("refreshToken", { path: "/" })

		return res.status(200).json({
			status: "success",
			message: "Logged out successfully",
		})
	}
}

// Validate current session controller
export const validateSession = async (req, res) => {
	try {
		const accessToken = req.cookies?.accessToken

		if (!accessToken) {
			return res.status(401).json({
				status: "error",
				message: "No active session",
				code: "NO_SESSION",
			})
		}

		const validation = await validateTokenAndUser(accessToken)

		return res.status(200).json({
			status: "success",
			message: "Session is valid",
			data: {
				user: validation.user,
				sessionInfo: {
					issuedAt: new Date(validation.decoded.iat * 1000).toISOString(),
					expiresAt: new Date(validation.decoded.exp * 1000).toISOString(),
				},
			},
		})
	} catch (sessionError) {
		console.error("Session validation error:", sessionError)

		// Clear invalid cookies
		res.clearCookie("accessToken", { path: "/" })

		if (sessionError.name === "TokenExpiredError") {
			return res.status(401).json({
				status: "error",
				message: "Session expired",
				code: "SESSION_EXPIRED",
			})
		}

		if (sessionError.message === "User no longer exists") {
			res.clearCookie("refreshToken", { path: "/" })
			return res.status(401).json({
				status: "error",
				message: "User account no longer exists",
				code: "USER_NOT_FOUND",
			})
		}

		return res.status(401).json({
			status: "error",
			message: "Invalid session",
			code: "SESSION_INVALID",
		})
	}
}

// Get current user info controller
export const getCurrentUser = async (req, res) => {
	try {
		const userId = req.user?.userId

		if (!userId) {
			return res.status(401).json({
				status: "error",
				message: "Authentication required",
			})
		}

		// User info is already validated in middleware
		return res.status(200).json({
			status: "success",
			message: "User information retrieved successfully",
			data: {
				user: {
					id: req.user.userId,
					name: req.user.name,
					email: req.user.email,
				},
			},
		})
	} catch (error) {
		console.error("Get current user error:", error)
		return res.status(500).json({
			status: "error",
			message: "Failed to retrieve user information",
		})
	}
}
