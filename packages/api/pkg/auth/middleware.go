package auth

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims represents JWT claims
type Claims struct {
	UserID uuid.UUID `json:"sub"`
	Email  string    `json:"email"`
	Role   string    `json:"role"`
	Type   string    `json:"typ"`
	jwt.RegisteredClaims
}

// SecretKey holds the JWT secret
var SecretKey string

// Init initializes the auth package with a secret key
func Init(secret string) {
	SecretKey = secret
}

// JWTMiddleware creates a middleware that validates JWT tokens
func JWTMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from cookie or Authorization header
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			tokenString, _ = c.Request.Cookie("access_token")
		}
		
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}
		
		// Remove "Bearer " prefix
		if strings.HasPrefix(tokenString, "Bearer ") {
			tokenString = strings.TrimPrefix(tokenString, "Bearer ")
		}
		
		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			return []byte(SecretKey), nil
		})
		
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}
		
		// Extract claims
		claims, ok := token.Claims.(*Claims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}
		
		// Check if token type is 'access'
		if claims.Type != "access" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token type"})
			c.Abort()
			return
		}
		
		// Store claims in context
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		
		c.Next()
	}
}

// RequireRole creates a middleware that checks if user has required role
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			c.Abort()
			return
		}
		
		role := userRole.(string)
		for _, required := range roles {
			if role == required {
				c.Next()
				return
			}
		}
		
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

// RequireInstructor creates a middleware for instructor-only endpoints
func RequireInstructor() gin.HandlerFunc {
	return RequireRole("instructor", "admin")
}

// RequireAdmin creates a middleware for admin-only endpoints
func RequireAdmin() gin.HandlerFunc {
	return RequireRole("admin")
}

// GenerateToken generates a JWT token for a user
func GenerateToken(userID uuid.UUID, email, role string, expiresIn time.Duration) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		Type:   "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiresIn)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "lms",
		},
	}
	
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(SecretKey))
}

// ValidateAccessToken validates an access token and returns claims
func ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(SecretKey), nil
	})
	
	if err != nil {
		return nil, err
	}
	
	if !token.Valid {
		return nil, jwt.ErrTokenInvalid
	}
	
	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, jwt.ErrTokenInvalidClaims
	}
	
	if claims.Type != "access" {
		return nil, jwt.ErrTokenInvalidType
	}
	
	return claims, nil
}