// services/auth.service.js
import bcrypt from "bcryptjs"
import { prisma } from "../utils/prisma.js"
import jwt from "jsonwebtoken"
import { generateSecureToken } from "../utils/security.js"
import { config } from "../config/env.js"

// Create new user account service function
export const createNewUserAccount = async ({ name, email, password }) => {
	const transaction = await prisma.$transaction(
		async (tx) => {
			try {
				// Double-check if user already exists (with transaction safety)
				const existingUserRecord = await tx.user.findUnique({
					where: { email },
				})

				if (existingUserRecord) {
					throw new Error("User already exists")
				}

				// Hash password with strong salt rounds for security
				const hashedUserPassword = await bcrypt.hash(password, 12)

				// Create new user with associated profile in single transaction
				const newUserRecord = await tx.user.create({
					data: {
						name,
						email,
						password: hashedUserPassword,
						profile: {
							create: {
								bio: "", // Initialize with empty bio
							},
						},
					},
					select: {
						id: true,
						name: true,
						email: true,
					},
				})

				return newUserRecord
			} catch (error) {
				console.error("User registration transaction error:", error)
				throw error
			}
		},
		{
			maxWait: 5000, // 5 seconds
			timeout: 10000, // 10 seconds
		},
	)

	return transaction
}

// Authenticate user login service function
export const authenticateUserLogin = async (userRecord, providedPassword) => {
	try {
		// Verify password against stored hash
		const isPasswordValid = await bcrypt.compare(providedPassword, userRecord.password)
		if (!isPasswordValid) {
			throw new Error("Invalid credentials")
		}

		// Use transaction for token cleanup and creation
		const authResult = await prisma.$transaction(async (tx) => {
			// Clean up expired refresh tokens for this user
			await tx.refreshToken.deleteMany({
				where: {
					userId: userRecord.id,
					expiresAt: {
						lt: new Date(),
					},
				},
			})

			// Create JWT access token with user information
			const accessTokenPayload = {
				userId: userRecord.id,
				email: userRecord.email,
				name: userRecord.name,
				iat: Math.floor(Date.now() / 1000),
			}

			const newAccessToken = jwt.sign(accessTokenPayload, config.jwtSecret, {
				expiresIn: config.accessTokenExpiry,
			})

			// Generate secure refresh token
			const refreshTokenValue = generateSecureToken()
			const refreshTokenExpiryDate = new Date(Date.now() + config.refreshTokenExpiry)

			// Store refresh token in database
			await tx.refreshToken.create({
				data: {
					token: refreshTokenValue,
					userId: userRecord.id,
					expiresAt: refreshTokenExpiryDate,
				},
			})

			return {
				accessToken: newAccessToken,
				refreshToken: refreshTokenValue,
				user: {
					id: userRecord.id,
					name: userRecord.name,
					email: userRecord.email,
				},
			}
		})

		return authResult
	} catch (error) {
		console.error("User login service error:", error)
		throw error
	}
}

// Generate new access token using refresh token service function
export const generateNewAccessToken = async (currentRefreshToken) => {
	try {
		if (!currentRefreshToken) {
			throw new Error("Refresh token is required")
		}

		const tokenResult = await prisma.$transaction(async (tx) => {
			// Find and validate refresh token
			const refreshTokenRecord = await tx.refreshToken.findUnique({
				where: { token: currentRefreshToken },
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			})

			if (!refreshTokenRecord) {
				throw new Error("Invalid refresh token")
			}

			// Check if refresh token has expired
			if (refreshTokenRecord.expiresAt < new Date()) {
				// Clean up expired token
				await tx.refreshToken.delete({
					where: { token: currentRefreshToken },
				})
				throw new Error("Refresh token expired")
			}

			// Verify user still exists
			if (!refreshTokenRecord.user) {
				// Clean up orphaned token
				await tx.refreshToken.delete({
					where: { token: currentRefreshToken },
				})
				throw new Error("User not found")
			}

			// Create new access token
			const newAccessTokenPayload = {
				userId: refreshTokenRecord.user.id,
				email: refreshTokenRecord.user.email,
				name: refreshTokenRecord.user.name,
				iat: Math.floor(Date.now() / 1000),
			}

			const newAccessToken = jwt.sign(newAccessTokenPayload, config.jwtSecret, {
				expiresIn: config.accessTokenExpiry,
			})

			// Generate new refresh token for rotation security
			const newRefreshTokenValue = generateSecureToken()
			const newRefreshTokenExpiryDate = new Date(Date.now() + config.refreshTokenExpiry)

			// Remove old refresh token and create new one atomically
			await tx.refreshToken.delete({
				where: { token: currentRefreshToken },
			})

			await tx.refreshToken.create({
				data: {
					token: newRefreshTokenValue,
					userId: refreshTokenRecord.user.id,
					expiresAt: newRefreshTokenExpiryDate,
				},
			})

			return {
				accessToken: newAccessToken,
				refreshToken: newRefreshTokenValue,
				user: {
					id: refreshTokenRecord.user.id,
					name: refreshTokenRecord.user.name,
					email: refreshTokenRecord.user.email,
				},
			}
		})

		return tokenResult
	} catch (error) {
		console.error("Token refresh service error:", error)
		throw error
	}
}

// Remove user session (logout) service function
export const removeUserSession = async (currentRefreshToken) => {
	try {
		if (currentRefreshToken) {
			await prisma.refreshToken.delete({
				where: { token: currentRefreshToken },
			})
		}
	} catch (error) {
		// Token might not exist, continue with logout
		console.log("Refresh token cleanup during logout:", error.message)
	}
}

// Logout user from all devices service function
export const logoutUserFromAllDevices = async (userId) => {
	try {
		const deletedCount = await prisma.refreshToken.deleteMany({
			where: { userId },
		})

		console.log(`Logged out user ${userId} from ${deletedCount.count} devices`)
		return deletedCount.count
	} catch (error) {
		console.error("Logout from all devices error:", error)
		throw error
	}
}

// Clean up expired tokens utility
export const cleanupExpiredRefreshTokens = async () => {
	try {
		const deletedTokens = await prisma.refreshToken.deleteMany({
			where: {
				expiresAt: {
					lt: new Date(),
				},
			},
		})

		console.log(`🧹 Cleaned up ${deletedTokens.count} expired refresh tokens`)
		return deletedTokens.count
	} catch (error) {
		console.error("Token cleanup error:", error)
		throw error
	}
}

// Get user session information
export const getUserSessionInformation = async (userId) => {
	try {
		const [user, activeSessionsCount] = await Promise.all([
			prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					name: true,
					email: true,
				},
			}),
			prisma.refreshToken.count({
				where: {
					userId,
					expiresAt: {
						gt: new Date(),
					},
				},
			}),
		])

		if (!user) {
			throw new Error("User not found")
		}

		return {
			user,
			activeSessions: activeSessionsCount,
		}
	} catch (error) {
		console.error("Get user session info error:", error)
		throw error
	}
}

// Validate JWT token and check user existence
export const validateTokenAndUser = async (token) => {
	try {
		const decoded = jwt.verify(token, config.jwtSecret)

		const user = await prisma.user.findUnique({
			where: { id: decoded.userId },
			select: {
				id: true,
				name: true,
				email: true,
			},
		})

		if (!user) {
			throw new Error("User no longer exists")
		}

		return { decoded, user }
	} catch (error) {
		throw error
	}
}

// Check and clean up user's refresh tokens periodically
export const maintainUserTokens = async (userId) => {
	try {
		// Remove expired tokens for specific user
		const cleanedUp = await prisma.refreshToken.deleteMany({
			where: {
				userId,
				expiresAt: {
					lt: new Date(),
				},
			},
		})

		// Limit active sessions per user (optional security measure)
		const maxSessionsPerUser = 5
		const activeSessions = await prisma.refreshToken.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		})

		if (activeSessions.length > maxSessionsPerUser) {
			const tokensToRemove = activeSessions.slice(maxSessionsPerUser)
			await prisma.refreshToken.deleteMany({
				where: {
					id: {
						in: tokensToRemove.map((token) => token.id),
					},
				},
			})
		}

		return {
			expiredTokensRemoved: cleanedUp.count,
			activeSessionsCount: Math.min(activeSessions.length, maxSessionsPerUser),
		}
	} catch (error) {
		console.error("Token maintenance error:", error)
		throw error
	}
}
