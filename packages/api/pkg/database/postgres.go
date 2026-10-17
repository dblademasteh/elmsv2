package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

// PostgresConfig holds database configuration
type PostgresConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
	PoolSize int
}

// NewPostgresConnection creates a new PostgreSQL connection
func NewPostgresConnection() (*pgx.Conn, error) {
	config := PostgresConfig{
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnv("DB_PORT", "5432"),
		User:     getEnv("DB_USER", "postgres"),
		Password: getEnv("DB_PASSWORD", "postgres"),
		DBName:   getEnv("DB_NAME", "lms_dev"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
		PoolSize: 10,
	}
	
	connStr := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s&pool_max_conns=%d",
		config.User,
		config.Password,
		config.Host,
		config.Port,
		config.DBName,
		config.SSLMode,
		config.PoolSize,
	)
	
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	conn, err := pgx.Connect(ctx, connStr, pgx.TLSConfig(nil))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	
	// Verify connection
	if err := conn.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	
	log.Println("✅ Connected to PostgreSQL database")
	return conn, nil
}

// GetEnv retrieves environment variable or returns default
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return defaultValue
}