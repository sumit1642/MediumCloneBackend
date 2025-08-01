# Blog API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
The API uses JWT tokens stored in HTTP-only cookies:
- `accessToken`: 15 minutes expiry
- `refreshToken`: 7 days expiry

## Standard Response Format
```json
{
  "status": "success" | "error",
  "message": "Response message",
  "data": {} // Present on success responses
}
```

---

## Authentication Routes (`/api/auth`)

### POST `/api/auth/register`
Creates a new user account with email, password, and name.
Redirects authenticated users to home page.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (201):**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**Error Responses:**
- `400`: Validation errors (missing fields, invalid email, weak password)
- `409`: User already exists
- `500`: Registration failed

### POST `/api/auth/login`
Authenticates user with email and password, sets authentication cookies.
Redirects authenticated users to home page.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Logged in successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**Error Responses:**
- `400`: Missing email or password
- `401`: Invalid credentials
- `500`: Login failed

### POST `/api/auth/refresh`
Generates new access token using refresh token from cookies.
Rotates both access and refresh tokens.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**Error Responses:**
- `401`: Missing or invalid refresh token
- `401`: Token expired

### POST `/api/auth/logout`
Clears authentication cookies and removes refresh token from database.
Always returns success even if token doesn't exist.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

## Posts Routes (`/api/posts`)

### GET `/api/posts`
Retrieves all published posts with optional authentication for enhanced features.
Query parameter `published=false` shows drafts (only for authenticated users).

**Query Parameters:**
- `published`: "true" (default) | "false"

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Posts fetched successfully",
  "data": {
    "posts": [
      {
        "id": 1,
        "title": "My First Post",
        "content": "This is the content...",
        "published": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "author": {
          "id": 1,
          "name": "John Doe",
          "email": "john@example.com"
        },
        "commentsCount": 5,
        "likesCount": 10,
        "isLikedByUser": false,
        "tags": [
          {
            "id": 1,
            "name": "javascript"
          }
        ]
      }
    ]
  }
}
```

### GET `/api/posts/:postId`
Retrieves a specific post by ID with comments included.
Shows draft posts only to their authors.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Post fetched successfully",
  "data": {
    "post": {
      "id": 1,
      "title": "My First Post",
      "content": "This is the content...",
      "published": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      },
      "commentsCount": 2,
      "likesCount": 5,
      "isLikedByUser": true,
      "tags": [],
      "comments": [
        {
          "id": 1,
          "content": "Great post!",
          "createdAt": "2024-01-01T00:00:00.000Z",
          "author": {
            "id": 2,
            "name": "Jane Smith"
          }
        }
      ]
    }
  }
}
```

**Error Responses:**
- `400`: Invalid post ID
- `404`: Post not found

### POST `/api/posts` 🔒
Creates a new post for the authenticated user.
Requires authentication and validates title uniqueness per user.

**Request Body:**
```json
{
  "title": "My New Post",
  "content": "Post content here...",
  "published": false
}
```

**Success Response (201):**
```json
{
  "status": "success",
  "message": "Post created successfully",
  "data": {
    "post": {
      "id": 2,
      "title": "My New Post",
      "content": "Post content here...",
      "published": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      },
      "commentsCount": 0,
      "likesCount": 0,
      "isLikedByUser": false,
      "tags": []
    }
  }
}
```

**Error Responses:**
- `400`: Missing title or content
- `401`: Authentication required
- `409`: Title already exists for this user

### PUT/PATCH `/api/posts/:postId` 🔒
Updates an existing post owned by the authenticated user.
Allows partial updates of title, content, and published status.

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "published": true
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Post updated successfully",
  "data": {
    "post": {
      "id": 1,
      "title": "Updated Title",
      "content": "Updated content...",
      "published": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T01:00:00.000Z",
      "author": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      },
      "commentsCount": 0,
      "likesCount": 0,
      "isLikedByUser": false,
      "tags": []
    }
  }
}
```

**Error Responses:**
- `400`: Invalid post ID or no update data
- `401`: Authentication required
- `403`: Can only update own posts
- `404`: Post not found
- `409`: Title already exists

### DELETE `/api/posts/:postId` 🔒
Deletes a post owned by the authenticated user.
Cascades to delete all related comments, likes, and tags.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Post deleted successfully"
}
```

**Error Responses:**
- `400`: Invalid post ID
- `401`: Authentication required
- `403`: Can only delete own posts
- `404`: Post not found

### GET `/api/posts/user/:userId`
Retrieves all posts by a specific user.
Shows only published posts unless requesting user is the author.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "User posts fetched successfully",
  "data": {
    "posts": [
      {
        "id": 1,
        "title": "User's Post",
        "content": "Content...",
        "published": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "author": {
          "id": 2,
          "name": "Jane Smith",
          "email": "jane@example.com"
        },
        "commentsCount": 3,
        "likesCount": 7,
        "isLikedByUser": false,
        "tags": []
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid user ID
- `404`: User not found

### GET `/api/posts/my/posts` 🔒
Retrieves all posts owned by the authenticated user.
Shows both published and draft posts.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Your posts fetched successfully",
  "data": {
    "posts": [
      {
        "id": 1,
        "title": "My Draft Post",
        "content": "Draft content...",
        "published": false,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "author": {
          "id": 1,
          "name": "John Doe",
          "email": "john@example.com"
        },
        "commentsCount": 0,
        "likesCount": 0,
        "isLikedByUser": false,
        "tags": []
      }
    ]
  }
}
```

**Error Responses:**
- `401`: Authentication required

---

## Interactions Routes (`/api/interactions`)

### POST `/api/interactions/posts/:postId/like` 🔒
Toggles like status for a post by the authenticated user.
Also manages user's liked tags based on post tags.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Post liked successfully",
  "data": {
    "isLiked": true,
    "likeCount": 11
  }
}
```

**Error Responses:**
- `400`: Invalid post ID
- `401`: Authentication required
- `404`: Post not found

### GET `/api/interactions/posts/:postId/comments`
Retrieves all comments for a specific post.
Public endpoint accessible without authentication.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Comments fetched successfully",
  "data": {
    "comments": [
      {
        "id": 1,
        "content": "Great post!",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "author": {
          "id": 2,
          "name": "Jane Smith"
        }
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid post ID
- `404`: Post not found

### POST `/api/interactions/posts/:postId/comments` 🔒
Adds a new comment to a post by the authenticated user.
Validates comment content length and sanitizes input.

**Request Body:**
```json
{
  "content": "This is my comment on the post."
}
```

**Success Response (201):**
```json
{
  "status": "success",
  "message": "Comment added successfully",
  "data": {
    "comment": {
      "id": 2,
      "content": "This is my comment on the post.",
      "createdAt": "2024-01-01T01:00:00.000Z",
      "author": {
        "id": 1,
        "name": "John Doe"
      }
    }
  }
}
```

**Error Responses:**
- `400`: Invalid post ID or missing content
- `401`: Authentication required
- `404`: Post not found

### PUT/PATCH `/api/interactions/comments/:commentId` 🔒
Updates a comment owned by the authenticated user.
Validates content and ensures user ownership.

**Request Body:**
```json
{
  "content": "Updated comment content."
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Comment updated successfully",
  "data": {
    "comment": {
      "id": 1,
      "content": "Updated comment content.",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "id": 1,
        "name": "John Doe"
      }
    }
  }
}
```

**Error Responses:**
- `400`: Invalid comment ID or missing content
- `401`: Authentication required
- `403`: Can only update own comments
- `404`: Comment not found

### DELETE `/api/interactions/comments/:commentId` 🔒
Deletes a comment owned by the authenticated user.
Permanently removes the comment from the database.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Comment deleted successfully"
}
```

**Error Responses:**
- `400`: Invalid comment ID
- `401`: Authentication required
- `403`: Can only delete own comments
- `404`: Comment not found

---

## Profile Routes (`/api/profile`)

### GET `/api/profile` 🔒
Retrieves the authenticated user's profile information.
Returns user details and bio from profile table.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Profile fetched successfully",
  "data": {
    "profile": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "bio": "Software developer passionate about web technologies."
    }
  }
}
```

**Error Responses:**
- `401`: Authentication required
- `404`: User not found

### PUT/PATCH `/api/profile` 🔒
Updates the authenticated user's profile information.
Allows updating name and bio with validation.

**Request Body:**
```json
{
  "name": "John Smith",
  "bio": "Updated bio description."
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "profile": {
      "id": 1,
      "name": "John Smith",
      "email": "john@example.com",
      "bio": "Updated bio description."
    }
  }
}
```

**Error Responses:**
- `400`: No update data or name too short
- `401`: Authentication required
- `404`: User not found

---

## Tags Routes (`/api/tags`)

### GET `/api/tags`
Retrieves all available tags with post counts.
Public endpoint showing tag usage statistics.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Tags fetched successfully",
  "data": {
    "tags": [
      {
        "id": 1,
        "name": "javascript",
        "postsCount": 15
      },
      {
        "id": 2,
        "name": "react",
        "postsCount": 8
      }
    ]
  }
}
```

### GET `/api/tags/:tagId/posts`
Retrieves all published posts associated with a specific tag.
Shows posts with like status for authenticated users.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Posts fetched successfully",
  "data": {
    "posts": [
      {
        "id": 1,
        "title": "JavaScript Basics",
        "content": "Learning JavaScript...",
        "published": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "author": {
          "id": 1,
          "name": "John Doe",
          "email": "john@example.com"
        },
        "commentsCount": 3,
        "likesCount": 7,
        "isLikedByUser": false,
        "tags": [
          {
            "id": 1,
            "name": "javascript"
          }
        ]
      }
    ]
  }
}
```

**Error Responses:**
- `400`: Invalid tag ID
- `404`: Tag not found

### POST `/api/tags/posts/:postId` 🔒
Adds a tag to a post owned by the authenticated user.
Creates new tag if it doesn't exist.

**Request Body:**
```json
{
  "tagName": "nodejs"
}
```

**Success Response (201):**
```json
{
  "status": "success",
  "message": "Tag added to post successfully",
  "data": {
    "tag": {
      "id": 3,
      "name": "nodejs"
    }
  }
}
```

**Error Responses:**
- `400`: Invalid post ID, missing tag name, or invalid tag format
- `401`: Authentication required
- `403`: Can only add tags to own posts
- `404`: Post not found
- `409`: Tag already exists on this post

### DELETE `/api/tags/posts/:postId/:tagId` 🔒
Removes a tag from a post owned by the authenticated user.
Only removes the association, doesn't delete the tag itself.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Tag removed from post successfully"
}
```

**Error Responses:**
- `400`: Invalid post ID or tag ID
- `401`: Authentication required
- `403`: Can only remove tags from own posts
- `404`: Post not found or tag not found on this post

### GET `/api/tags/liked` 🔒
Retrieves tags that the authenticated user has liked through post interactions.
Shows tags from posts the user has liked.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Your liked tags fetched successfully",
  "data": {
    "tags": [
      {
        "id": 1,
        "name": "javascript",
        "postsCount": 15
      },
      {
        "id": 2,
        "name": "react",
        "postsCount": 8
      }
    ]
  }
}
```

**Error Responses:**
- `401`: Authentication required

---

## Additional Routes

### GET `/`
Home route displaying all published posts.
Uses optional authentication for enhanced features.

### GET `/health`
Health check endpoint for server status monitoring.
Returns server information and timestamp.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

### GET `/api`
API information endpoint with available endpoints.
Returns API version and endpoint documentation links.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Blog API v1.0",
  "endpoints": {
    "auth": "/api/auth",
    "posts": "/api/posts",
    "interactions": "/api/interactions",
    "profile": "/api/profile",
    "tags": "/api/tags"
  },
  "docs": "Visit /api/docs for detailed documentation"
}
```

---

## Error Handling

### Common Error Codes
- `400`: Bad Request - Invalid input or parameters
- `401`: Unauthorized - Authentication required or invalid token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `409`: Conflict - Resource already exists
- `500`: Internal Server Error - Server-side error

### Error Response Format
```json
{
  "status": "error",
  "message": "Error description"
}
```

---

## Notes

🔒 = Requires Authentication

- All timestamps are in ISO 8601 format
- Authentication tokens are managed via HTTP-only cookies
- Input sanitization is applied to prevent XSS attacks
- Rate limiting and CORS are configured for production use
- Database transactions ensure data consistency for complex operations