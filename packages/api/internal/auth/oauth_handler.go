package auth

import (
	"context"
	"crypto/bcrypt"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lms/api/internal/user"
)

// OAuthHandler handles OAuth2 authentication endpoints
type OAuthHandler struct {
	userService  *user.Service
	authHandler  *AuthHandler
	googleClientID string
	googleClientSecret string
	githubClientID string
	githubClientSecret string
}

// NewOAuthHandler creates a new OAuth handler
func NewOAuthHandler(
	userService *user.Service,
	authHandler *AuthHandler,
) *OAuthHandler {
	return &OAuthHandler{
		userService:  userService,
		authHandler:  authHandler,
	}
}

// GoogleOAuthURL generates the Google OAuth authorization URL
func (h *OAuthHandler) GoogleOAuthURL() string {
	params := url.Values{}
	params.Set("client_id", "YOUR_GOOGLE_CLIENT_ID")
	params.Set("redirect_uri", "http://localhost:8080/api/v1/auth/oauth/google/callback")
	params.Set("response_type", "code")
	params.Set("scope", "openid email profile")
	params.Set("access_type", "offline")
	params.Set("prompt", "consent")
	
	return "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode()
}

// GoogleCallback handles the Google OAuth callback
func (h *OAuthHandler) GoogleCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not provided"})
		return
	}
	
	// Exchange code for tokens
	oauthUser, err := h.authHandler.OAuthTokenExchange(ProviderGoogle, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OAuth token exchange failed"})
		return
	}
	
	// Find or create user
	user, err := h.findOrCreateOAuthUser(oauthUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find or create user"})
		return
	}
	
	// Generate tokens
	access, refresh, err := h.authHandler.GenerateTokens(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}
	
	// Set cookies
	c.SetCookie("access_token", access, 15*60, "/", "", true, true)
	c.SetCookie("refresh_token", refresh, 7*24*60*60, "/", "", true, true)
	
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"full_name": user.FullName,
			"role":      user.Role,
		},
	})
}

// GitHubOAuthURL generates the GitHub OAuth authorization URL
func (h *OAuthHandler) GitHubOAuthURL() string {
	params := url.Values{}
	params.Set("client_id", "YOUR_GITHUB_CLIENT_ID")
	params.Set("redirect_uri", "http://localhost:8080/api/v1/auth/oauth/github/callback")
	params.Set("scope", "user:email")
	
	return "https://github.com/login/oauth/authorize?" + params.Encode()
}

// GitHubCallback handles the GitHub OAuth callback
func (h *OAuthHandler) GitHubCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code not provided"})
		return
	}
	
	// Exchange code for tokens
	oauthUser, err := h.authHandler.OAuthTokenExchange(ProviderGitHub, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OAuth token exchange failed"})
		return
	}
	
	// Find or create user
	user, err := h.findOrCreateOAuthUser(oauthUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find or create user"})
		return
	}
	
	// Generate tokens
	access, refresh, err := h.authHandler.GenerateTokens(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}
	
	// Set cookies
	c.SetCookie("access_token", access, 15*60, "/", "", true, true)
	c.SetCookie("refresh_token", refresh, 7*24*60*60, "/", "", true, true)
	
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"full_name": user.FullName,
			"role":      user.Role,
		},
	})
}

// AppleCallback handles Apple OAuth callback (simplified)
func (h *OAuthHandler) AppleCallback(c *gin.Context) {
	// Apple Sign In requires token verification from Apple
	// This is a placeholder implementation
	c.JSON(http.StatusNotImplemented, gin.H{
		"message": "Apple Sign In not yet implemented",
	})
}

func (h *OAuthHandler) findOrCreateOAuthUser(oauthUser *OAuthUser) (*user.User, error) {
	// Try to find existing user by email
	existingUser, err := h.userService.FindByEmail(context.Background(), oauthUser.Email)
	if err == nil && existingUser != nil {
		return existingUser, nil
	}
	
	// Create new user if not found
	newUser := &user.User{
		ID:            uuid.New(),
		Email:         oauthUser.Email,
		FullName:      oauthUser.FullName,
		Role:          user.RoleStudent,
		IsVerified:    true, // OAuth users are pre-verified
		IsActive:        true,
		OAuthProvider: oauthUser.Provider,
		OAuthID:       oauthUser.ID,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	
	if err := h.userService.Create(context.Background(), newUser); err != nil {
		return nil, err
	}
	
	return newUser, nil
}

// OAuthProvider represents an OAuth provider configuration
type OAuthProvider struct {
	Name     string `json:"name"`
	Enabled  bool   `json:"enabled"`
	ButtonColor string `json:"button_color"`
	IconURL  string `json:"icon_url"`
}

// GetOAuthProviders returns available OAuth providers
func (h *OAuthHandler) GetOAuthProviders(c *gin.Context) {
	providers := []OAuthProvider{
		{
			Name:         "google",
			Enabled:      true,
			ButtonColor:  "#4285F4",
			IconURL:      "https://www.google.com/favicon.ico",
		},
		{
			Name:         "github",
			Enabled:      true,
			ButtonColor:  "#24292e",
			IconURL:      "https://github.com/favicon.ico",
		},
		{
			Name:         "apple",
			Enabled:      true,
			ButtonColor:  "#000000",
			IconURL:      "https://apple.com/favicon.ico",
		},
	}
	
	c.JSON(http.StatusOK, gin.H{"providers": providers})
}

// RefreshTokenHandler handles token refresh requests
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// RefreshToken handles refreshing access tokens
func (h *OAuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	
	newAccessToken, err := h.authHandler.RefreshAccessToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"access_token": newAccessToken})
}

// VerifyEmailRequest represents email verification request
type VerifyEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

// VerifyEmail handles email verification
func (h *OAuthHandler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification token is required"})
		return
	}
	
	userID, err := h.authHandler.VerifyEmailToken(req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Mark user as verified in database
	if err := h.userService.MarkEmailVerified(*userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify email"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

// RequestPasswordResetRequest represents password reset request
type RequestPasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// RequestPasswordReset generates a password reset token
func (h *OAuthHandler) RequestPasswordReset(c *gin.Context) {
	var req RequestPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
		return
	}
	
	// Find user
	user, err := h.userService.FindByEmail(context.Background(), req.Email)
	if err != nil {
		// Don't reveal if user exists or not
		c.JSON(http.StatusOK, gin.H{
			"message": "If the email exists, a password reset link has been sent",
		})
		return
	}
	
	// Generate reset token
	token, err := h.authHandler.GeneratePasswordResetToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate reset token"})
		return
	}
	
	// Return token (in production, send via email)
	c.JSON(http.StatusOK, gin.H{
		"message": "If the email exists, a password reset link has been sent",
		"token":   token, // Only for development!
	})
}

// ResetPasswordRequest represents the reset password confirmation
type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min(8)"`
}

// ResetPassword handles password reset
func (h *OAuthHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	
	userID, err := h.authHandler.VerifyPasswordResetToken(req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Hash new password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}
	
	// Update password
	if err := h.userService.UpdatePassword(*userID, string(passwordHash)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}

// Helper function to make HTTP requests
func makeHTTPRequest(url string, method string, body interface{}) ([]byte, error) {
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	return json.Marshal(result)
}

// ParseOAuthCodeFromState parses OAuth state to get the code
func ParseOAuthCodeFromState(state, provider string) string {
	parts := strings.Split(state, ":")
	if len(parts) != 2 {
		return ""
	}
	return parts[1]
}