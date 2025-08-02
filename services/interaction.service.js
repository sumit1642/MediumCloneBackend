// services/interaction.service.js
import { prisma } from "../utils/prisma.js"

// Toggle like with improved consistency and race condition handling
export const toggleLike = async (userId, postId) => {
	const result = await prisma.$transaction(
		async (tx) => {
			try {
				// Check if post exists
				const post = await tx.post.findUnique({
					where: { id: postId },
					include: {
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

				// Check current like status
				const existingLike = await tx.like.findUnique({
					where: {
						userId_postId: {
							userId,
							postId,
						},
					},
				})

				let isLiked
				let message

				if (existingLike) {
					// Unlike the post
					await tx.like.delete({
						where: {
							userId_postId: {
								userId,
								postId,
							},
						},
					})

					// Remove user liked tags for this post's tags
					if (post.tags.length > 0) {
						await tx.userLikedTag.deleteMany({
							where: {
								userId,
								tagId: {
									in: post.tags.map((pt) => pt.tag.id),
								},
							},
						})
					}

					isLiked = false
					message = "Post unliked successfully"
				} else {
					// Like the post
					await tx.like.create({
						data: {
							userId,
							postId,
						},
					})

					// Add user liked tags for this post's tags
					if (post.tags.length > 0) {
						for (const postTag of post.tags) {
							await tx.userLikedTag.upsert({
								where: {
									userId_tagId: {
										userId,
										tagId: postTag.tag.id,
									},
								},
								update: {}, // Do nothing if already exists
								create: {
									userId,
									tagId: postTag.tag.id,
								},
							})
						}
					}

					isLiked = true
					message = "Post liked successfully"
				}

				// Get updated like count with proper counting
				const likeCount = await tx.like.count({
					where: { postId },
				})

				return {
					isLiked,
					likeCount,
					message,
					postId,
					userId,
				}
			} catch (error) {
				console.error("Toggle like transaction error:", error)
				throw error
			}
		},
		{
			maxWait: 5000,
			timeout: 10000,
		},
	)

	return result
}

// Add comment with enhanced validation and error handling
export const addComment = async (userId, postId, content) => {
	try {
		// Check if post exists and is accessible
		const post = await prisma.post.findUnique({
			where: { id: postId },
			select: {
				id: true,
				published: true,
				authorId: true,
			},
		})

		if (!post) {
			throw new Error("Post not found")
		}

		// Check if user can comment on this post
		if (!post.published && post.authorId !== userId) {
			throw new Error("Cannot comment on unpublished posts")
		}

		// Create comment with user info
		const comment = await prisma.comment.create({
			data: {
				content,
				postId,
				authorId: userId,
			},
			include: {
				author: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		})

		return comment
	} catch (error) {
		console.error("Add comment error:", error)
		throw error
	}
}

// Get comments with improved pagination and sorting
export const getComments = async (postId, options = {}) => {
	try {
		const { page = 1, limit = 10, sortOrder = "desc" } = options
		const skip = (page - 1) * limit

		// Check if post exists
		const post = await prisma.post.findUnique({
			where: { id: postId },
			select: {
				id: true,
				published: true,
			},
		})

		if (!post) {
			throw new Error("Post not found")
		}

		// Get comments with pagination
		const [comments, totalCount] = await Promise.all([
			prisma.comment.findMany({
				where: { postId },
				orderBy: { createdAt: sortOrder === "asc" ? "asc" : "desc" },
				skip,
				take: limit,
				include: {
					author: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			}),
			prisma.comment.count({
				where: { postId },
			}),
		])

		return {
			comments,
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
		console.error("Get comments error:", error)
		throw error
	}
}

// Delete comment with proper authorization
export const deleteComment = async (userId, commentId) => {
	await prisma.$transaction(async (tx) => {
		try {
			// Check if comment exists and get its details
			const comment = await tx.comment.findUnique({
				where: { id: commentId },
				include: {
					post: {
						select: {
							authorId: true,
						},
					},
				},
			})

			if (!comment) {
				throw new Error("Comment not found")
			}

			// Check authorization: user can delete their own comment or post author can delete any comment
			if (comment.authorId !== userId && comment.post.authorId !== userId) {
				throw new Error("Unauthorized")
			}

			// Delete comment
			await tx.comment.delete({
				where: { id: commentId },
			})
		} catch (error) {
			console.error("Delete comment transaction error:", error)
			throw error
		}
	})
}

// Update comment with proper validation
export const updateComment = async (userId, commentId, content) => {
	try {
		// Check if comment exists and user owns it
		const existingComment = await prisma.comment.findUnique({
			where: { id: commentId },
			select: {
				id: true,
				authorId: true,
				updatedAt: true,
			},
		})

		if (!existingComment) {
			throw new Error("Comment not found")
		}

		if (existingComment.authorId !== userId) {
			throw new Error("Unauthorized")
		}

		// Update comment
		const comment = await prisma.comment.update({
			where: {
				id: commentId,
				// Prevent race conditions
				updatedAt: existingComment.updatedAt,
			},
			data: {
				content,
				updatedAt: new Date(),
			},
			include: {
				author: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		})

		return comment
	} catch (error) {
		if (error.code === "P2025") {
			throw new Error(
				"Comment was modified by another process. Please refresh and try again.",
			)
		}
		console.error("Update comment error:", error)
		throw error
	}
}

// Get user's like activity with pagination
export const getUserLikeActivity = async (userId, options = {}) => {
	try {
		const { page = 1, limit = 10 } = options
		const skip = (page - 1) * limit

		const [likedPosts, totalCount] = await Promise.all([
			prisma.like.findMany({
				where: { userId },
				orderBy: { post: { createdAt: "desc" } },
				skip,
				take: limit,
				include: {
					post: {
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
					},
				},
			}),
			prisma.like.count({
				where: { userId },
			}),
		])

		const formattedPosts = likedPosts.map((like) => ({
			id: like.post.id,
			title: like.post.title,
			content: like.post.content,
			published: like.post.published,
			createdAt: like.post.createdAt,
			updatedAt: like.post.updatedAt,
			author: like.post.author,
			commentsCount: like.post._count.comments,
			likesCount: like.post._count.likes,
			isLikedByUser: true,
			tags: like.post.tags.map((pt) => pt.tag),
		}))

		return {
			likedPosts: formattedPosts,
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
		console.error("Get user like activity error:", error)
		throw error
	}
}

// Get user's comment activity
export const getUserCommentActivity = async (userId, options = {}) => {
	try {
		const { page = 1, limit = 10 } = options
		const skip = (page - 1) * limit

		const [comments, totalCount] = await Promise.all([
			prisma.comment.findMany({
				where: { authorId: userId },
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					post: {
						select: {
							id: true,
							title: true,
							published: true,
							author: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
					author: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			}),
			prisma.comment.count({
				where: { authorId: userId },
			}),
		])

		return {
			comments,
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
		console.error("Get user comment activity error:", error)
		throw error
	}
}

// Get interaction statistics
export const getInteractionStats = async (userId, postId = null) => {
	try {
		if (postId) {
			// Stats for specific post
			const [likesCount, commentsCount, isLikedByUser] = await Promise.all([
				prisma.like.count({ where: { postId } }),
				prisma.comment.count({ where: { postId } }),
				userId
					? prisma.like
							.findUnique({
								where: { userId_postId: { userId, postId } },
							})
							.then((like) => !!like)
					: false,
			])

			return {
				postId,
				likesCount,
				commentsCount,
				isLikedByUser,
			}
		} else {
			// Stats for user
			const [totalLikes, totalComments, postsCount] = await Promise.all([
				prisma.like.count({ where: { userId } }),
				prisma.comment.count({ where: { authorId: userId } }),
				prisma.post.count({ where: { authorId: userId } }),
			])

			return {
				userId,
				totalLikes,
				totalComments,
				postsCount,
			}
		}
	} catch (error) {
		console.error("Get interaction stats error:", error)
		throw error
	}
}
