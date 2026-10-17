package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/lms/api/internal/auth"
	"github.com/lms/api/internal/user"
	"github.com/lms/api/pkg/database"
	"github.com/lms/api/pkg/redis"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Connect to database
	db, err := database.NewPostgresConnection()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Connect to Redis
	redisClient, err := redis.NewRedisClient()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Initialize auth handler
	authHandler := auth.NewAuthHandler(getEnv("JWT_SECRET", "dev-secret-key"))

	// Initialize User Service and Handler
	userRepo := user.NewRepository(db, redisClient)
	userService := user.NewService(userRepo, redisClient, getEnv("JWT_SECRET", "dev-secret-key"))
	userHandler := user.NewHandlerWithService(userService)

	// Initialize Gin router
	r := gin.New()

	// Middleware
	r.Use(gin.LoggerWithFormatter(func(param gin.LogParams) string {
		return fmt.Sprintf("[%s] %s %s %s %d %s\n",
			param.TimeStamp.Format("2006/01/02 - 15:04:05"),
			param.Method,
			param.Path,
			param.ClientIP,
			param.StatusCode,
			param.Latency,
		)
	}))
	r.Use(gin.Recovery())
	r.Use(redis.TracingMiddleware(redisClient))

	// Configure CORS
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", getEnv("CORS_ORIGINS", "*"))
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Accept,Content-Type,Content-Length,X-Amz-Attachment,Authorization,X-Requested-With")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(200)
			return
		}
		c.Next()
	})

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":   "ok",
			"database": "connected",
			"redis":    "connected",
			"time":     time.Now().Unix(),
		})
	})

	// API Routes
	api := r.Group("/api/v1")
	{
		// Auth Routes - Basic Authentication
		authRoutes := api.Group("/auth")
		{
			authRoutes.POST("/register", userHandler.Register)
			authRoutes.POST("/login", userHandler.Login)
			authRoutes.POST("/logout", userHandler.Logout)
			authRoutes.POST("/verify-email", userHandler.VerifyEmail)
			authRoutes.POST("/reset-password", userHandler.RequestPasswordReset)
			authRoutes.POST("/reset-password/confirm", userHandler.ResetPassword)
			authRoutes.GET("/me", userHandler.GetCurrentUser)
			authRoutes.POST("/refresh-token", userHandler.RefreshToken)
		}

		// OAuth Routes
		oauthRoutes := api.Group("/auth/oauth")
		{
			oauthRoutes.GET("/google", func(c *gin.Context) {
				c.Redirect(http.StatusFound, authHandler.GoogleOAuthURL())
			})
			oauthRoutes.GET("/google/callback", userHandler.GoogleOAuthCallback)
			oauthRoutes.GET("/github", func(c *gin.Context) {
				c.Redirect(http.StatusFound, authHandler.GitHubOAuthURL())
			})
			oauthRoutes.GET("/github/callback", userHandler.GitHubOAuthCallback)
		}
	}

	// Get port from env or default to 8080
	port := getEnv("PORT", "8080")
	
	// Run server
	addr := fmt.Sprintf(":%s", port)
	log.Printf("🚀 Server starting on %s", addr)
	
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// getEnv helper function
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return defaultValue
}