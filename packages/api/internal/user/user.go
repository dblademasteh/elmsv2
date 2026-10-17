package user

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-redis/redis/v9"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// Errors
var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserExists        = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailNotVerified  = errors.New("email not verified")
)

// User model
type User struct {
	ID                 uuid.UUID `json:"id"`
	Email              string    `json:"email"`
	PasswordHash       string    `json:"-"`
	FullName           string    `json:"full_name"`
	Role               string    `json:"role"`
	AvatarURL          string    `json:"avatar_url,omitempty"`
	IsVerified         bool      `json:"is_verified"`
	IsActive           bool      `json:"is_active"`
	FailedLoginAttempts int      `json:"-"`
	LockedUntil        *time.Time `json:"-"`
	EmailVerifiedAt    *time.Time `json:"-"`
	OAuthProvider     string    `json:"oauth_provider,omitempty"`
	OAuthID           string    `json:"oauth_id,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// Role constants
const (
	RoleStudent   = "student"
	RoleInstructor = "instructor"
	RoleAdmin     = "admin"
	RoleParent    = "parent"
)

// UserResponse for API responses
type UserResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	FullName  string    `json:"full_name"`
	Role      string    `json:"role"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// Repository interface
type Repository interface {
	Create(ctx context.Context, user *User) error
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id uuid.UUID) (*User, error)
	UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash string) error
	UpdateProfile(ctx context.Context, user *User) error
	IncrementFailedLoginAttempts(ctx context.Context, id uuid.UUID) error
	ResetFailedLoginAttempts(ctx context.Context, id uuid.UUID) error
	LockUser(ctx context.Context, id uuid.UUID, lockedUntil time.Time) error
	SetVerified(ctx context.Context, id uuid.UUID) error
}

// Service interface
type Service interface {
	Register(ctx context.Context, email, fullName, password, role string) (*UserResponse, error)
	Login(ctx context.Context, email, password string) (*LoginResponse, error)
	GetCurrentUser(ctx context.Context, userID uuid.UUID) (*UserResponse, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, fullName, avatarURL string) (*UserResponse, error)
	VerifyEmail(ctx context.Context, userID uuid.UUID) error
	MarkEmailVerified(ctx context.Context, userID uuid.UUID) error
	FindByEmail(ctx context.Context, email string) (*User, error)
}

// LoginResponse contains tokens after successful login
type LoginResponse struct {
	User         *UserResponse `json:"user"`
	AccessToken  string        `json:"access_token"`
	RefreshToken string        `json:"refresh_token"`
}

// Repository implementation using PostgreSQL
type repository struct {
	db     *pgx.Conn
	redis  *redis.Client
}

func NewRepository(db *pgx.Conn, redis *redis.Client) Repository {
	return &repository{db: db, redis: redis}
}

func (r *repository) Create(ctx context.Context, user *User) error {
	query := `
		INSERT INTO users (id, email, password_hash, full_name, role, is_verified, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	
	_, err := r.db.Exec(ctx, query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.FullName,
		user.Role,
		user.IsVerified,
		user.IsActive,
		user.CreatedAt,
		user.UpdatedAt,
	)
	
	return err
}

func (r *repository) FindByEmail(ctx context.Context, email string) (*User, error) {
	query := `
		SELECT id, email, password_hash, full_name, role, avatar_url, 
		       is_verified, is_active, failed_login_attempts, locked_until,
		       email_verified_at, created_at, updated_at
		FROM users WHERE email = $1
	`
	
	var user User
	var lockedUntil sql.NullTime
	
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FullName,
		&user.Role,
		&user.AvatarURL,
		&user.IsVerified,
		&user.IsActive,
		&user.FailedLoginAttempts,
		&lockedUntil,
		&user.EmailVerifiedAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	
	if errors.Is(err, pgx.ErrRowNotFound) {
		return nil, ErrUserNotFound
	}
	
	if err != nil {
		return nil, err
	}
	
	if lockedUntil.Valid {
		user.LockedUntil = &lockedUntil.Time
	}
	
	return &user, nil
}

func (r *repository) FindByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `
		SELECT id, email, full_name, role, avatar_url, is_verified, is_active, 
		       email_verified_at, created_at, updated_at
		FROM users WHERE id = $1
	`
	
	var user User
	var emailVerifiedAt sql.NullTime
	
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.FullName,
		&user.Role,
		&user.AvatarURL,
		&user.IsVerified,
		&user.IsActive,
		&emailVerifiedAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	
	if errors.Is(err, pgx.ErrRowNotFound) {
		return nil, ErrUserNotFound
	}
	
	if err != nil {
		return nil, err
	}
	
	if emailVerifiedAt.Valid {
		user.EmailVerifiedAt = &emailVerifiedAt.Time
	}
	
	return &user, nil
}

func (r *repository) UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`
	
	_, err := r.db.Exec(ctx, query, passwordHash, time.Now(), id)
	return err
}

func (r *repository) UpdateProfile(ctx context.Context, user *User) error {
	query := `UPDATE users SET full_name = $1, avatar_url = $2, updated_at = $3 WHERE id = $4`
	
	_, err := r.db.Exec(ctx, query, user.FullName, user.AvatarURL, time.Now(), user.ID)
	return err
}

func (r *repository) IncrementFailedLoginAttempts(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE users SET failed_login_attempts = failed_login_attempts + 1, updated_at = $2 
		WHERE id = $1
	`
	
	_, err := r.db.Exec(ctx, query, id, time.Now())
	return err
}

func (r *repository) ResetFailedLoginAttempts(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = $2 
		WHERE id = $1
	`
	
	_, err := r.db.Exec(ctx, query, id, time.Now())
	return err
}

func (r *repository) LockUser(ctx context.Context, id uuid.UUID, lockedUntil time.Time) error {
	query := `
		UPDATE users SET locked_until = $1, updated_at = $2 WHERE id = $3
	`
	
	_, err := r.db.Exec(ctx, query, lockedUntil, time.Now(), id)
	return err
}

func (r *repository) SetVerified(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE users SET is_verified = true, email_verified_at = $1, updated_at = $2 
		WHERE id = $3
	`
	
	_, err := r.db.Exec(ctx, query, time.Now(), time.Now(), id)
	return err
}

// Service implementation
type service struct {
	repo      Repository
	redis     *redis.Client
	jwtSecret string
}

func NewService(repo Repository, redis *redis.Client, jwtSecret string) Service {
	return &service{
		repo:      repo,
		redis:     redis,
		jwtSecret: jwtSecret,
	}
}

func (s *service) Register(ctx context.Context, email, fullName, password, role string) (*UserResponse, error) {
	// Check if user already exists
	existingUser, _ := s.repo.FindByEmail(ctx, email)
	if existingUser != nil {
		return nil, ErrUserExists
	}
	
	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}
	
	// Create user
	user := &User{
		ID:         uuid.New(),
		Email:      email,
		PasswordHash: string(passwordHash),
		FullName:   fullName,
		Role:       role,
		IsVerified: false,
		IsActive:   true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	
	return userToResponse(user), nil
}

func (s *service) Login(ctx context.Context, email, password string) (*LoginResponse, error) {
	// Find user
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}
	
	// Check if user is locked
	if user.LockedUntil != nil && time.Now().Before(*user.LockedUntil) {
		return nil, ErrInvalidCredentials
	}
	
	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		// Increment failed attempts
		s.repo.IncrementFailedLoginAttempts(ctx, user.ID)
		return nil, ErrInvalidCredentials
	}
	
	// Reset failed attempts
	s.repo.ResetFailedLoginAttempts(ctx, user.ID)
	
	// Generate tokens
	accessToken, refreshToken, err := s.generateTokens(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}
	
	return &LoginResponse{
		User:         userToResponse(user),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *service) GetCurrentUser(ctx context.Context, userID uuid.UUID) (*UserResponse, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	
	return userToResponse(user), nil
}

func (s *service) UpdateProfile(ctx context.Context, userID uuid.UUID, fullName, avatarURL string) (*UserResponse, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	
	user.FullName = fullName
	user.AvatarURL = avatarURL
	
	if err := s.repo.UpdateProfile(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}
	
	return userToResponse(user), nil
}

func (s *service) VerifyEmail(ctx context.Context, userID uuid.UUID) error {
	return s.repo.SetVerified(ctx, userID)
}

func (s *service) MarkEmailVerified(ctx context.Context, userID uuid.UUID) error {
	return s.repo.SetVerified(ctx, userID)
}

func (s *service) FindByEmail(ctx context.Context, email string) (*User, error) {
	return s.repo.FindByEmail(ctx, email)
}

func (s *service) generateTokens(user *User) (string, string, error) {
	// Access token (15 minutes)
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID.String(),
		"email": user.Email,
		"role": user.Role,
		"exp": time.Now().Add(15 * time.Minute).Unix(),
		"iat": time.Now().Unix(),
		"typ": "access",
	})
	
	accessStr, err := accessToken.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}
	
	// Refresh token (7 days)
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID.String(),
		"email": user.Email,
		"exp": time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
		"typ": "refresh",
	})
	
	refreshStr, err := refreshToken.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return "", "", err
	}
	
	return accessStr, refreshStr, nil
}

func userToResponse(user *User) *UserResponse {
	return &UserResponse{
		ID:        user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		Role:      user.Role,
		AvatarURL: user.AvatarURL,
		CreatedAt: user.CreatedAt,
	}
}