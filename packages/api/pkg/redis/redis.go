package redis

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v9"
)

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
	PoolSize int
}

// NewRedisClient creates a new Redis client
func NewRedisClient() (*redis.Client, error) {
	config := RedisConfig{
		Host:     getEnv("REDIS_HOST", "localhost"),
		Port:     getEnv("REDIS_PORT", "6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       getEnvInt("REDIS_DB", 0),
		PoolSize: 10,
	}
	
	client := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%s", config.Host, config.Port),
		Password:     config.Password,
		DB:           config.DB,
		PoolSize:     config.PoolSize,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})
	
	// Verify connection
	ctx := context.Background()
	if _, err := client.Ping(ctx).Result(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}
	
	log.Println("✅ Connected to Redis")
	return client, nil
}

// getEnv retrieves environment variable or returns default
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt retrieves integer environment variable or returns default
func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		var intVal int
		if _, err := fmt.Sscanf(value, "%d", &intVal); err == nil {
			return intVal
		}
	}
	return defaultValue
}

// TracingMiddleware adds request tracing using Redis
func TracingMiddleware(client *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		
		// Store in Redis with 1 hour TTL
		ctx := context.Background()
		key := fmt.Sprintf("request:%s", requestID)
		client.Set(ctx, key, "active", time.Hour)
		
		c.Set("request_id", requestID)
		c.Next()
	}
}