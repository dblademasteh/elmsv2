package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v9"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Handler handles HTTP requests for user endpoints
type Handler struct {
	service Service
	repo    Repository
	redis   *redis.Client
}

// NewHandler creates a new user handler with injected services
func NewHandler(dbConn interface{}, redisClient *redis.Client) *Handler {
	var repo Repository
	
	switch db := dbConn.(type) {
	case *pgx.Conn:
		repo = NewRepository(db, redisClient)
	}
	
	service := NewService(repo, redisClient, getEnv("JWT_SECRET", "dev-secret-key"))
	
	return &Handler{
		service: service,
		repo:    repo,
		redis:   redisClient,
	}
}

// NewHandlerWithService creates a new user handler with injected service
func NewHandlerWithService(service Service) *Handler {
	return &Handler{
		service: service,
	}
}

// RegisterRequest represents the registration request body
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	FullName string `json:"full_name" binding:"required,min(2,max:255)"`
	Password string `json:"password" binding:"required,min(8,max:255)"`
	Role     string `json:"role" binding:"omitempty,oneof:student instructor"`
}

// Register handles user registration
func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
			"details": err.Error(),
		})
		return
	}
	
	role := req.Role
	if role == "" {
		role = RoleStudent
	}
	
	user, err := h.service.Register(c.Request.Context(), req.Email, req.FullName, req.Password, role)
	
	if err != nil {
		switch err {
		case ErrUserExists:
			c.JSON(http.StatusConflict, gin.H{"error": "User already exists with this email"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Registration failed"})
		}
		return
	}
	
	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"user":    user,
	})
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Login handles user login
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
			"details": err.Error(),
		})
		return
	}
	
	loginResp, err := h.service.Login(c.Request.Context(), req.Email, req.Password)
	
	if err != nil {
		switch err {
		case ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Login failed"})
		}
		return
	}
	
	// Set secure cookies
	c.SetCookie("access_token", loginResp.AccessToken, 15*60, "/", "", true, true)
	c.SetCookie("refresh_token", loginResp.RefreshToken, 7*24*60*60, "/", "", true, true)
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"user":    loginResp.User,
	})
}

// Logout handles user logout
func (h *Handler) Logout(c *gin.Context) {
	// Clear cookies
	c.SetCookie("access_token", "", -1, "/", "", true, true)
	c.SetCookie("refresh_token", "", -1, "/", "", true, true)
	
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// VerifyEmailRequest represents the email verification request
type VerifyEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

// VerifyEmail handles email verification
func (h *Handler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Verification token is required",
		})
		return
	}
	
	// In production: verify token from Redis/database
	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

// RequestPasswordResetRequest represents the password reset request
type RequestPasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// RequestPasswordReset handles password reset requests
func (h *Handler) RequestPasswordReset(c *gin.Context) {
	var req RequestPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
		})
		return
	}
	
	// In production: generate reset token, store in Redis, send email
	c.JSON(http.StatusOK, gin.H{
		"message": "If the email exists, a password reset link has been sent",
	})
}

// ResetPasswordRequest represents the reset password confirmation
type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min(8)"`
}

// ResetPassword handles password reset confirmation
func (h *Handler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
		})
		return
	}
	
	// In production: verify token, update password
	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}

// GetCurrentUser handles getting current user info
func (h *Handler) GetCurrentUser(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}
	
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	
	user, err := h.service.GetCurrentUser(c.Request.Context(), parsedID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// UpdateProfileRequest represents the profile update request
type UpdateProfileRequest struct {
	FullName  string `json:"full_name" binding:"required,min(2,max:255)"`
	AvatarURL string `json:"avatar_url,omitempty"`
}

// UpdateProfile handles profile updates
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}
	
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	
	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
			"details": err.Error(),
		})
		return
	}
	
	user, err := h.service.UpdateProfile(c.Request.Context(), parsedID, req.FullName, req.AvatarURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
		"user":    user,
	})
}

// RefreshTokenRequest is the request body for token refresh
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// RefreshToken handles refreshing access tokens
func (h *Handler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}
	
	// In production: verify refresh token and generate new access token
	c.JSON(http.StatusOK, gin.H{"message": "Token refreshed"})
}

// GoogleOAuthCallback handles Google OAuth callback
func (h *Handler) GoogleOAuthCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not provided"})
		return
	}
	
	// In production: exchange code for tokens, create/find user, set cookies
	c.JSON(http.StatusOK, gin.H{
		"message": "Google OAuth callback received",
		"code":    "code received",
	})
}

// GitHubOAuthCallback handles GitHub OAuth callback
func (h *Handler) GitHubOAuthCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not provided"})
		return
	}
	
	// In production: exchange code for tokens, create/find user, set cookies
	c.JSON(http.StatusOK, gin.H{
		"message": "GitHub OAuth callback received",
		"code":    "code received",
	})
}

// getEnv helper function
func getEnv(key, defaultValue string) string {
	if value, exists := map[string]string{
		"JWT_SECRET": "your-jwt-secret-here-change-in-production",
	}[key]; exists && value != "" {
		return value
	}
	return defaultValue
}