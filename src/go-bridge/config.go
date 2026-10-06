package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type bridgeConfig struct {
	Port               string `json:"port"`
	HTTPTimeout        string `json:"httpTimeout"`
	SessionIdleTimeout string `json:"sessionIdleTimeout"`
	SwitchLockTimeout  string `json:"switchLockTimeout"`
}

func defaultConfigPath() string {
	if value := strings.TrimSpace(os.Getenv("XDG_CONFIG_HOME")); value != "" {
		return filepath.Join(value, "zen-mcp", "config.json")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".config", "zen-mcp", "config.json")
	}
	return filepath.Join(home, ".config", "zen-mcp", "config.json")
}

func loadBridgeConfig(path string) (bridgeConfig, error) {
	config := bridgeConfig{}
	if path == "" {
		path = defaultConfigPath()
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return config, nil
	}
	if err != nil {
		return config, fmt.Errorf("read bridge config %s: %w", path, err)
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return config, fmt.Errorf("parse bridge config %s: %w", path, err)
	}
	return config, nil
}

func durationFromConfig(fileValue string, envName string, fallback time.Duration) time.Duration {
	if strings.TrimSpace(os.Getenv(envName)) != "" {
		return durationFromEnv(envName, fallback)
	}
	if value := strings.TrimSpace(fileValue); value != "" {
		if duration, err := time.ParseDuration(value); err == nil && duration > 0 {
			return duration
		}
		log.Printf("Invalid bridge config %s=%q; using %s", envName, value, fallback)
	}
	return fallback
}

func configuredPort(fileValue string) string {
	if value := strings.TrimSpace(os.Getenv("ZEN_MCP_PORT")); value != "" {
		return value
	}
	if value := strings.TrimSpace(fileValue); value != "" {
		return value
	}
	return defaultPort
}
