# Blog API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
JWT tokens stored in HTTP-only cookies:
- `accessToken`: 15 minutes expiry
- `refreshToken`: 7 days expiry

---

## Authentication Routes (`/api/auth`)

### POST `/api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response:** 201
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

**Error Responses:** 400, 409, 500
```json
{
  "status": "error",
  "message": "Error description"
}
```

### POST `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response:** 200
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

**Error Responses:** 400, 401, 500
```json
{
  "status": "error",
  "message": "Error description"
}
```

### POST `/api/auth/refresh`

**Success Response:** 200
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

**Error Responses:** 401
```json
{
  "status": "error",
  "message": "Error description"
}
```

### POST `/api/auth/logout`

**Success Response:** 200
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

## Posts Routes (`/api/posts`)

### GET `/api/posts`

**Query Parameters:**
- `published`: "true" (default) | "false"

**Success Response:** 200
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

**Success Response:** 200
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
      "tags": [
        {
          "id": 1,
          "name": "javascript"
        }
      ],
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

**Error Responses:** 400, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### POST `/api/posts` 🔒

**Request Body:**
```json
{
  "title": "My New Post",
  "content": "Post content here...",
  "published": false
}
```

**Success Response:** 201
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

**Error Responses:** 400, 401, 409
```json
{
  "status": "error",
  "message": "Error description"
}
```

### PUT/PATCH `/api/posts/:postId` 🔒

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "published": true
}
```

**Success Response:** 200
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

**Error Responses:** 400, 401, 403, 404, 409
```json
{
  "status": "error",
  "message": "Error description"
}
```

### DELETE `/api/posts/:postId` 🔒

**Success Response:** 200
```json
{
  "status": "success",
  "message": "Post deleted successfully"
}
```

**Error Responses:** 400, 401, 403, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### GET `/api/posts/user/:userId`

**Success Response:** 200
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

**Error Responses:** 400, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### GET `/api/posts/my/posts` 🔒

**Success Response:** 200
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

**Error Responses:** 401
```json
{
  "status": "error",
  "message": "Error description"
}
```

---

## Interactions Routes (`/api/interactions`)

### POST `/api/interactions/posts/:postId/like` 🔒

*User clicks like button - no page change needed, updates like count and button state*

**Success Response:** 200
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

**Error Responses:** 400, 401, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### GET `/api/interactions/posts/:postId/comments`

*Get comments for post display - no user action needed*

**Success Response:** 200
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

**Error Responses:** 400, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### POST `/api/interactions/posts/:postId/comments` 🔒

*User submits comment form - no page change, updates comment list*

**Request Body:**
```json
{
  "content": "This is my comment on the post."
}
```

**Success Response:** 201
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

**Error Responses:** 400, 401, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### PUT/PATCH `/api/interactions/comments/:commentId` 🔒

*User clicks edit comment button - no page change, updates comment inline*

**Request Body:**
```json
{
  "content": "Updated comment content."
}
```

**Success Response:** 200
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

**Error Responses:** 400, 401, 403, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### DELETE `/api/interactions/comments/:commentId` 🔒

*User clicks delete comment button - no page change, removes comment from list*

**Success Response:** 200
```json
{
  "status": "success",
  "message": "Comment deleted successfully"
}
```

**Error Responses:** 400, 401, 403, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

---

## Profile Routes (`/api/profile`)

### GET `/api/profile` 🔒

**Success Response:** 200
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

**Error Responses:** 401, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### PUT/PATCH `/api/profile` 🔒

**Request Body:**
```json
{
  "name": "John Smith",
  "bio": "Updated bio description."
}
```

**Success Response:** 200
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

**Error Responses:** 400, 401, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

---

## Tags Routes (`/api/tags`)

### GET `/api/tags`

**Success Response:** 200
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

**Success Response:** 200
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

**Error Responses:** 400, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### POST `/api/tags/posts/:postId` 🔒

**Request Body:**
```json
{
  "tagName": "nodejs"
}
```

**Success Response:** 201
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

**Error Responses:** 400, 401, 403, 404, 409
```json
{
  "status": "error",
  "message": "Error description"
}
```

### DELETE `/api/tags/posts/:postId/:tagId` 🔒

**Success Response:** 200
```json
{
  "status": "success",
  "message": "Tag removed from post successfully"
}
```

**Error Responses:** 400, 401, 403, 404
```json
{
  "status": "error",
  "message": "Error description"
}
```

### GET `/api/tags/liked` 🔒

**Success Response:** 200
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

**Error Responses:** 401
```json
{
  "status": "error",
  "message": "Error description"
}
```

---

## Additional Routes

### GET `/`

**Success Response:** 200
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

### GET `/health`

**Success Response:** 200
```json
{
  "status": "success",
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "development"
}
```

### GET `/api`

**Success Response:** 200
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

## Backend Automatic Handling

### JWT & Cookies
- Automatic JWT token generation and verification
- HTTP-only cookie setting and clearing
- Token rotation on refresh (new access + refresh tokens)
- Expired token cleanup from database
- Secure cookie configuration (httpOnly, secure, sameSite)

### Authentication
- Password hashing with bcrypt (12 salt rounds)
- User session management
- Automatic redirect for authenticated users on auth routes
- Optional authentication middleware for public routes

### Data Processing
- Input sanitization (XSS prevention)
- Email format validation and normalization
- Tag name transformation (lowercase, hyphen replacement)
- Duplicate title validation per user
- Foreign key constraint handling

### Database Operations
- Transaction handling for data consistency
- Cascade deletions (posts → comments, likes, tags)
- Automatic timestamp management (createdAt, updatedAt)
- User liked tags management on post likes/unlikes
- Profile creation on user registration

### Security
- CORS configuration
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Request body size limits
- Error handling without sensitive data exposure

### Validation
- Post content length limits
- Comment content validation
- Tag name format validation (alphanumeric + hyphens)
- User authorization checks for resource ownership

---

🔒 = Requires Authentication