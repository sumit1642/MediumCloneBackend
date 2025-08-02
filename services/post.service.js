// services/post.service.js
import { prisma } from "../utils/prisma.js"

// Enhanced post formatting with consistent data structure
const formatPost = (post, userId = null) => ({
	id: post.id,
	title: post.title,
	content: post.content,
	published: post.published,
	createdAt: post.createdAt,
	updatedAt: post.updatedAt,
	author: post.author,
	commentsCount: post._count?.comments || post.comments?.length || 0,
	likesCount: post._count?.likes || post.likes?.length || 0,
	isLikedByUser: userId ? post.likes?.some((like) => like.userId === userId) || false : false,
	tags: post.tags?.map((pt) => pt.tag) || [],
})

// Create post with enhanced error handling and validation
export const createPost = async ({ title, content, published, userId }) => {
	const postData = await prisma.$transaction(async (tx) => {
		try {
			// Check for duplicate title per user with case-insensitive comparison
			const existingPost = await tx.post.findFirst({
				where: {
					title: {
						equals: title,
						mode: "insensitive",
					},
					authorId: userId,
				},
			})

			if (existingPost) {
				throw new Error("Title already exists")
			}

			// Create post with optimized includes
			const post = await tx.post.create({
				data: {
					title,
					content,
					published,
					authorId: userId,
				},
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: {
						select: { userId: true },
						where: userId ? { userId } : undefined,
					},
					tags: {
						include: {
							tag: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			})

			return formatPost(post, userId)
		} catch (error) {
			console.error("Create post transaction error:", error)
			throw error
		}
	})

	return postData
}

// Get all posts with optimized queries and consistent pagination
export const getAllPosts = async ({ published, userId, page = 1, limit = 10 }) => {
	try {
		const whereClause = {}
		const skip = (page - 1) * limit

		if (published !== undefined) {
			whereClause.published = published
		}

		// Use Promise.all for concurrent queries
		const [posts, totalCount] = await Promise.all([
			prisma.post.findMany({
				where: whereClause,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: userId
						? {
								select: { userId: true },
								where: { userId },
						  }
						: {
								select: { userId: true },
						  },
					tags: {
						include: {
							tag: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			}),
			prisma.post.count({ where: whereClause }),
		])

		return {
			posts: posts.map((post) => formatPost(post, userId)),
			pagination: {
				page,
				limit,
				total: totalCount,
				pages: Math.ceil(totalCount / limit),
				hasNext: page < Math.ceil(totalCount / limit),
				hasPrev: page > 1,
			},
		}
	} catch (error) {
		console.error("Get all posts error:", error)
		throw error
	}
}

// Get post by ID with enhanced error handling
export const getPostById = async (postId, userId) => {
	try {
		const post = await prisma.post.findUnique({
			where: { id: postId },
			include: {
				author: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				comments: {
					include: {
						author: {
							select: {
								id: true,
								name: true,
							},
						},
					},
					orderBy: {
						createdAt: "desc",
					},
				},
				_count: {
					select: {
						comments: true,
						likes: true,
					},
				},
				likes: userId
					? {
							select: { userId: true },
							where: { userId },
					  }
					: {
							select: { userId: true },
					  },
				tags: {
					include: {
						tag: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		})

		if (!post) {
			throw new Error("Post not found")
		}

		// Check if user can view unpublished post
		if (!post.published && (!userId || post.authorId !== userId)) {
			throw new Error("Post not found")
		}

		return {
			...formatPost(post, userId),
			comments: post.comments,
		}
	} catch (error) {
		console.error("Get post by ID error:", error)
		throw error
	}
}

// Update post with race condition prevention
export const updatePost = async (postId, userId, updateData) => {
	const updatedPost = await prisma.$transaction(async (tx) => {
		try {
			// Check if post exists and user owns it
			const existingPost = await tx.post.findUnique({
				where: { id: postId },
				select: {
					id: true,
					title: true,
					authorId: true,
					updatedAt: true,
				},
			})

			if (!existingPost) {
				throw new Error("Post not found")
			}

			if (existingPost.authorId !== userId) {
				throw new Error("Unauthorized")
			}

			// Check for duplicate title if title is being updated
			if (updateData.title && updateData.title !== existingPost.title) {
				const duplicatePost = await tx.post.findFirst({
					where: {
						title: {
							equals: updateData.title,
							mode: "insensitive",
						},
						authorId: userId,
						NOT: { id: postId },
					},
				})

				if (duplicatePost) {
					throw new Error("Title already exists")
				}
			}

			// Update post with optimistic locking simulation
			const post = await tx.post.update({
				where: {
					id: postId,
					// Add updatedAt check to prevent race conditions
					updatedAt: existingPost.updatedAt,
				},
				data: {
					...updateData,
					updatedAt: new Date(),
				},
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: {
						select: { userId: true },
						where: { userId },
					},
					tags: {
						include: {
							tag: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			})

			return formatPost(post, userId)
		} catch (error) {
			if (error.code === "P2025") {
				throw new Error(
					"Post was modified by another process. Please refresh and try again.",
				)
			}
			throw error
		}
	})

	return updatedPost
}

// Delete post with cascade cleanup
export const deletePost = async (postId, userId) => {
	await prisma.$transaction(async (tx) => {
		try {
			// Check if post exists and user owns it
			const post = await tx.post.findUnique({
				where: { id: postId },
				select: {
					id: true,
					authorId: true,
				},
			})

			if (!post) {
				throw new Error("Post not found")
			}

			if (post.authorId !== userId) {
				throw new Error("Unauthorized")
			}

			// Delete post (cascade will handle related records due to schema)
			await tx.post.delete({
				where: { id: postId },
			})

			// Clean up any orphaned UserLikedTag entries
			// This handles the case where tags become unused after post deletion
			const orphanedTags = await tx.tag.findMany({
				where: {
					posts: {
						none: {},
					},
				},
				select: { id: true },
			})

			if (orphanedTags.length > 0) {
				await tx.userLikedTag.deleteMany({
					where: {
						tagId: {
							in: orphanedTags.map((tag) => tag.id),
						},
					},
				})
			}
		} catch (error) {
			console.error("Delete post transaction error:", error)
			throw error
		}
	})
}

// Get user posts with enhanced filtering
export const getUserPosts = async (targetUserId, requestingUserId, options = {}) => {
	try {
		const { page = 1, limit = 10, published } = options
		const skip = (page - 1) * limit

		// Check if target user exists
		const targetUser = await prisma.user.findUnique({
			where: { id: targetUserId },
			select: { id: true, name: true },
		})

		if (!targetUser) {
			throw new Error("User not found")
		}

		const whereClause = {
			authorId: targetUserId,
		}

		// If requesting user is not the post author, only show published posts
		if (requestingUserId !== targetUserId) {
			whereClause.published = true
		} else if (published !== undefined) {
			whereClause.published = published
		}

		const [posts, totalCount] = await Promise.all([
			prisma.post.findMany({
				where: whereClause,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: requestingUserId
						? {
								select: { userId: true },
								where: { userId: requestingUserId },
						  }
						: {
								select: { userId: true },
						  },
					tags: {
						include: {
							tag: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			}),
			prisma.post.count({ where: whereClause }),
		])

		return {
			posts: posts.map((post) => formatPost(post, requestingUserId)),
			user: targetUser,
			pagination: {
				page,
				limit,
				total: totalCount,
				pages: Math.ceil(totalCount / limit),
				hasNext: page < Math.ceil(totalCount / limit),
				hasPrev: page > 1,
			},
		}
	} catch (error) {
		console.error("Get user posts error:", error)
		throw error
	}
}

// Get my posts with enhanced filtering and sorting
export const getMyPosts = async (userId, options = {}) => {
	try {
		const {
			page = 1,
			limit = 10,
			published,
			sortBy = "createdAt",
			sortOrder = "desc",
		} = options
		const skip = (page - 1) * limit

		const whereClause = {
			authorId: userId,
		}

		if (published !== undefined) {
			whereClause.published = published
		}

		// Validate sort parameters
		const validSortFields = ["createdAt", "updatedAt", "title"]
		const validSortOrders = ["asc", "desc"]

		const orderBy = {}
		orderBy[validSortFields.includes(sortBy) ? sortBy : "createdAt"] = validSortOrders.includes(
			sortOrder,
		)
			? sortOrder
			: "desc"

		const [posts, totalCount] = await Promise.all([
			prisma.post.findMany({
				where: whereClause,
				orderBy,
				skip,
				take: limit,
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: {
						select: { userId: true },
						where: { userId },
					},
					tags: {
						include: {
							tag: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			}),
			prisma.post.count({ where: whereClause }),
		])

		return {
			posts: posts.map((post) => formatPost(post, userId)),
			pagination: {
				page,
				limit,
				total: totalCount,
				pages: Math.ceil(totalCount / limit),
				hasNext: page < Math.ceil(totalCount / limit),
				hasPrev: page > 1,
			},
		}
	} catch (error) {
		console.error("Get my posts error:", error)
		throw error
	}
}

// Get posts with enhanced search and filtering
export const searchPosts = async (searchParams, userId) => {
	try {
		const {
			query,
			tags,
			authorId,
			published = true,
			page = 1,
			limit = 10,
			sortBy = "createdAt",
			sortOrder = "desc",
		} = searchParams

		const skip = (page - 1) * limit
		const whereClause = { published }

		// Text search in title and content
		if (query) {
			whereClause.OR = [
				{
					title: {
						contains: query,
						mode: "insensitive",
					},
				},
				{
					content: {
						contains: query,
						mode: "insensitive",
					},
				},
			]
		}

		// Filter by author
		if (authorId) {
			whereClause.authorId = authorId
		}

		// Filter by tags
		if (tags && tags.length > 0) {
			whereClause.tags = {
				some: {
					tag: {
						name: {
							in: tags,
						},
					},
				},
			}
		}

		// Validate sort parameters
		const validSortFields = ["createdAt", "updatedAt", "title"]
		const validSortOrders = ["asc", "desc"]

		const orderBy = {}
		orderBy[validSortFields.includes(sortBy) ? sortBy : "createdAt"] = validSortOrders.includes(
			sortOrder,
		)
			? sortOrder
			: "desc"

		const [posts, totalCount] = await Promise.all([
			prisma.post.findMany({
				where: whereClause,
				orderBy,
				skip,
				take: limit,
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: userId
						? {
								select: { userId: true },
								where: { userId },
						  }
						: {
								select: { userId: true },
						  },
					tags: {
						include: {
							tag: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			}),
			prisma.post.count({ where: whereClause }),
		])

		return {
			posts: posts.map((post) => formatPost(post, userId)),
			pagination: {
				page,
				limit,
				total: totalCount,
				pages: Math.ceil(totalCount / limit),
				hasNext: page < Math.ceil(totalCount / limit),
				hasPrev: page > 1,
			},
			searchParams,
		}
	} catch (error) {
		console.error("Search posts error:", error)
		throw error
	}
}

// Get trending posts based on likes and comments
export const getTrendingPosts = async (userId, options = {}) => {
	try {
		const { page = 1, limit = 10, timeframe = "week" } = options
		const skip = (page - 1) * limit

		// Calculate timeframe for trending
		const timeframeMap = {
			day: 1,
			week: 7,
			month: 30,
			year: 365,
		}

		const daysAgo = timeframeMap[timeframe] || 7
		const dateThreshold = new Date()
		dateThreshold.setDate(dateThreshold.getDate() - daysAgo)

		const whereClause = {
			published: true,
			createdAt: {
				gte: dateThreshold,
			},
		}

		const [posts, totalCount] = await Promise.all([
			prisma.post.findMany({
				where: whereClause,
				orderBy: [
					{ likes: { _count: "desc" } },
					{ comments: { _count: "desc" } },
					{ createdAt: "desc" },
				],
				skip,
				take: limit,
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: userId
						? {
								select: { userId: true },
								where: { userId },
						  }
						: {
								select: { userId: true },
						  },
					tags: {
						include: {
							tag: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			}),
			prisma.post.count({ where: whereClause }),
		])

		return {
			posts: posts.map((post) => formatPost(post, userId)),
			pagination: {
				page,
				limit,
				total: totalCount,
				pages: Math.ceil(totalCount / limit),
				hasNext: page < Math.ceil(totalCount / limit),
				hasPrev: page > 1,
			},
			timeframe,
		}
	} catch (error) {
		console.error("Get trending posts error:", error)
		throw error
	}
}

// Get post statistics for dashboard
export const getPostStatistics = async (userId) => {
	try {
		const [totalPosts, publishedPosts, draftPosts, totalLikes, totalComments, recentPosts] =
			await Promise.all([
				prisma.post.count({
					where: { authorId: userId },
				}),
				prisma.post.count({
					where: { authorId: userId, published: true },
				}),
				prisma.post.count({
					where: { authorId: userId, published: false },
				}),
				prisma.like.count({
					where: {
						post: { authorId: userId },
					},
				}),
				prisma.comment.count({
					where: {
						post: { authorId: userId },
					},
				}),
				prisma.post.findMany({
					where: { authorId: userId },
					orderBy: { createdAt: "desc" },
					take: 5,
					select: {
						id: true,
						title: true,
						published: true,
						createdAt: true,
						_count: {
							select: {
								likes: true,
								comments: true,
							},
						},
					},
				}),
			])

		return {
			totalPosts,
			publishedPosts,
			draftPosts,
			totalLikes,
			totalComments,
			recentPosts,
		}
	} catch (error) {
		console.error("Get post statistics error:", error)
		throw error
	}
}

// Get posts by multiple IDs (useful for batch operations)
export const getPostsByIds = async (postIds, userId) => {
	try {
		const posts = await prisma.post.findMany({
			where: {
				id: { in: postIds },
				published: true,
			},
			include: {
				author: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				_count: {
					select: {
						comments: true,
						likes: true,
					},
				},
				likes: userId
					? {
							select: { userId: true },
							where: { userId },
					  }
					: {
							select: { userId: true },
					  },
				tags: {
					include: {
						tag: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		})

		return posts.map((post) => formatPost(post, userId))
	} catch (error) {
		console.error("Get posts by IDs error:", error)
		throw error
	}
}

// Bulk update post status (publish/unpublish)
export const bulkUpdatePostStatus = async (postIds, userId, published) => {
	try {
		const result = await prisma.$transaction(async (tx) => {
			// Verify all posts belong to the user
			const posts = await tx.post.findMany({
				where: {
					id: { in: postIds },
					authorId: userId,
				},
				select: { id: true },
			})

			if (posts.length !== postIds.length) {
				throw new Error("Some posts not found or unauthorized")
			}

			// Update all posts
			const updatedPosts = await tx.post.updateMany({
				where: {
					id: { in: postIds },
					authorId: userId,
				},
				data: {
					published,
					updatedAt: new Date(),
				},
			})

			return updatedPosts
		})

		return result
	} catch (error) {
		console.error("Bulk update post status error:", error)
		throw error
	}
}

// Get related posts based on tags
export const getRelatedPosts = async (postId, userId, limit = 5) => {
	try {
		// Get the current post's tags
		const currentPost = await prisma.post.findUnique({
			where: { id: postId },
			include: {
				tags: {
					select: { tagId: true },
				},
			},
		})

		if (!currentPost) {
			throw new Error("Post not found")
		}

		const tagIds = currentPost.tags.map((t) => t.tagId)

		if (tagIds.length === 0) {
			// If no tags, return recent posts from the same author
			const posts = await prisma.post.findMany({
				where: {
					authorId: currentPost.authorId,
					published: true,
					NOT: { id: postId },
				},
				orderBy: { createdAt: "desc" },
				take: limit,
				include: {
					author: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					_count: {
						select: {
							comments: true,
							likes: true,
						},
					},
					likes: userId
						? {
								select: { userId: true },
								where: { userId },
						  }
						: {
								select: { userId: true },
						  },
					tags: {
						include: {
							tag: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			})

			return posts.map((post) => formatPost(post, userId))
		}

		// Find posts with similar tags
		const relatedPosts = await prisma.post.findMany({
			where: {
				published: true,
				NOT: { id: postId },
				tags: {
					some: {
						tagId: { in: tagIds },
					},
				},
			},
			orderBy: [{ createdAt: "desc" }],
			take: limit,
			include: {
				author: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				_count: {
					select: {
						comments: true,
						likes: true,
					},
				},
				likes: userId
					? {
							select: { userId: true },
							where: { userId },
					  }
					: {
							select: { userId: true },
					  },
				tags: {
					include: {
						tag: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		})

		return relatedPosts.map((post) => formatPost(post, userId))
	} catch (error) {
		console.error("Get related posts error:", error)
		throw error
	}
}
