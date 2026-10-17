package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Email verification token storage (in production, use Redis or database)
type EmailToken struct {
	UserID    uuid.UUID
	Token     string
	Type      string // "email_verification", "password_reset"
	ExpiresAt time.Time
}

// Provider constants
const (
	ProviderGoogle = "google"
	ProviderGitHub = "github"
	ProviderApple  = "apple"
)

// OAuthUser represents a user coming from an OAuth provider
type OAuthUser struct {
	ID            string
	Email         string
	FullName      string
	FirstName     string
	LastName      string
	Provider      string
	RefreshToken  string
}

// EmailService handles sending emails
type EmailService interface {
	SendVerificationEmail(to, token string) error
	SendPasswordResetEmail(to, token string) error
}

// MockEmailService is a placeholder for development
type MockEmailService struct{}

func (e *MockEmailService) SendVerificationEmail(to, token string) error {
	// In production, send actual email
	fmt.Printf("📧 Verification email to %s with token: %s\n", to, token)
	return nil
}

func (e *MockEmailService) SendPasswordResetEmail(to, token string) error {
	// In production, send actual email
	fmt.Printf("📧 Password reset email to %s with token: %s\n", to, token)
	return nil
}

// AuthHandler handles authentication related endpoints
type AuthHandler struct {
	jwtSecret     string
	emailService  EmailService
	tokenStore    map[string]EmailToken // In production, use Redis
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(jwtSecret string) *AuthHandler {
	return &AuthHandler{
		jwtSecret:    jwtSecret,
		emailService: &MockEmailService{},
		tokenStore:   make(map[string]EmailToken),
	}
}

// GenerateSecureToken generates a random secure token
func GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// GenerateVerificationToken generates and stores an email verification token
func (h *AuthHandler) GenerateVerificationToken(userID uuid.UUID, email string) (string, error) {
	token, err := GenerateSecureToken(32)
	if err != nil {
		return "", err
	}

	verificationToken := EmailToken{
		UserID:    userID,
		Token:     token,
		Type:      "email_verification",
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}

	h.tokenStore[token] = verificationToken

	// Send verification email
	if err := h.emailService.SendVerificationEmail(email, token); err != nil {
		return "", err
	}

	return token, nil
}

// VerifyEmailToken verifies an email verification token
func (h *AuthHandler) VerifyEmailToken(token string) (*uuid.UUID, error) {
	verificationToken, exists := h.tokenStore[token]
	if !exists {
		return nil, errors.New("invalid verification token")
	}

	if time.Now().After(verificationToken.ExpiresAt) {
		delete(h.tokenStore, token)
		return nil, errors.New("verification token expired")
	}

	if verificationToken.Type != "email_verification" {
		return nil, errors.New("invalid token type")
	}

	userID := verificationToken.UserID
	delete(h.tokenStore, token)

	return &userID, nil
}

// GeneratePasswordResetToken generates a password reset token
func (h *AuthHandler) GeneratePasswordResetToken(userID uuid.UUID, email string) (string, error) {
	token, err := GenerateSecureToken(32)
	if err != nil {
		return "", err
	}

	resetToken := EmailToken{
		UserID:    userID,
		Token:     token,
		Type:      "password_reset",
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	h.tokenStore[token] = resetToken

	// Send password reset email
	if err := h.emailService.SendPasswordResetEmail(email, token); err != nil {
		return "", err
	}

	return token, nil
}

// VerifyPasswordResetToken verifies a password reset token
func (h *AuthHandler) VerifyPasswordResetToken(token string) (*uuid.UUID, error) {
	resetToken, exists := h.tokenStore[token]
	if !exists {
		return nil, errors.New("invalid reset token")
	}

	if time.Now().After(resetToken.ExpiresAt) {
		delete(h.tokenStore, token)
		return nil, errors.New("reset token expired")
	}

	if resetToken.Type != "password_reset" {
		return nil, errors.New("invalid token type")
	}

	userID := resetToken.UserID
	delete(h.tokenStore, token)

	return &userID, nil
}

// GenerateTokens generates access and refresh tokens
func (h *AuthHandler) GenerateTokens(userID uuid.UUID, email, role string) (access string, refresh string, err error) {
	// Access token (15 minutes)
	accessClaims := jwt.MapClaims{
		"sub":   userID.String(),
		"email": email,
		"role":  role,
		"typ":   "access",
		"exp":   time.Now().Add(15 * time.Minute).Unix(),
		"iat":   time.Now().Unix(),
	}
	
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	access, err = accessToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return "", "", err
	}

	// Refresh token (7 days)
	refreshClaims := jwt.MapClaims{
		"sub":   userID.String(),
		"email": email,
		"typ":   "refresh",
		"exp":   time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}
	
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refresh, err = refreshToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return "", "", err
	}

	return access, refresh, nil
}

// RefreshAccessToken generates a new access token from a refresh token
func (h *AuthHandler) RefreshAccessToken(refreshToken string) (string, error) {
	token, err := jwt.Parse(refreshToken, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMACSHA256); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(h.jwtSecret), nil
	})

	if err != nil {
		return "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", errors.New("invalid refresh token")
	}

	if claims["typ"] != "refresh" {
		return "", errors.New("invalid token type")
	}

	email, _ := claims["email"].(string)
	role, _ := claims["role"].(string)

	// Get user ID from claims
	userID, _ := uuid.Parse(claims["sub"].(string))

	// Generate new access token
	accessClaims := jwt.MapClaims{
		"sub":   userID.String(),
		"email": email,
		"role":  role,
		"typ":   "access",
		"exp":   time.Now().Add(15 * time.Minute).Unix(),
		"iat":   time.Now().Unix(),
	}

	newAccessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	return newAccessToken.SignedString([]byte(h.jwtSecret))
}

// OAuthTokenExchange exchanges an OAuth code for user data
func (h *AuthHandler) OAuthTokenExchange(provider, code string) (*OAuthUser, error) {
	// This is a simplified example
	// In production, you would call the OAuth provider's token endpoint
	
	switch provider {
	case ProviderGoogle:
		// Call Google OAuth API
		return h.exchangeGoogleToken(code)
	case ProviderGitHub:
		// Call GitHub OAuth API
		return h.exchangeGitHubToken(code)
	default:
		return nil, errors.New("unsupported provider")
	}
}

func (h *AuthHandler) exchangeGoogleToken(code string) (*OAuthUser, error) {
	// In production: make HTTP request to Google's token endpoint
	// Then call Google's userinfo endpoint with the access token
	
	// Mock response for development
	return &OAuthUser{
		ID:       "google-oauth-id",
		Email:    "user@gmail.com",
		FullName: "Google User",
		Provider: ProviderGoogle,
	}, nil
}

func (h *AuthHandler) exchangeGitHubToken(code string) (*OAuthUser, error) {
	// In production: make HTTP request to GitHub's token endpoint
	// Then call GitHub's user endpoint
	
	// Mock response for development
	return &OAuthUser{
		ID:       "github-oauth-id",
		Email:    "user@users.noreply.github.com",
		FullName: "GitHub User",
		Provider: ProviderGitHub,
	}, nil
}