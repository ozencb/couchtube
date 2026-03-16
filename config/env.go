package config

import (
        "log"
        "os"
        "strconv"
        "sync"

        "github.com/joho/godotenv"
)

var (
        port         string
        dbFilePath   string
        jsonFilePath string
        fullScan     bool
        readonly     bool
        youtube_api_key string
        once         sync.Once
)

func init() {
        once.Do(func() {
                if err := godotenv.Load(); err != nil {
                        log.Println("No .env file found, relying on system environment variables")
                }

                port = getEnv("PORT", "8363")
                dbFilePath = getEnv("DATABASE_FILE_PATH", "couchtube.db")
                jsonFilePath = getEnv("JSON_FILE_PATH", "/videos.json")
                fullScan = getEnvAsBool("FULL_SCAN", false)
                readonly = getEnvAsBool("READONLY_MODE", false)
                youtube_api_key = getEnv("YOUTUBE_API_KEY", "")
        })
}

func getEnv(key, fallback string) string {
        if value, exists := os.LookupEnv(key); exists {
                return value
        }
        return fallback
}

func getEnvAsBool(key string, fallback bool) bool {
        if value, exists := os.LookupEnv(key); exists {
                boolValue, err := strconv.ParseBool(value)
                if err != nil {
                        log.Printf("Warning: unable to parse boolean from %s; using default: %v", key, fallback)
                        return fallback
                }
                return boolValue
        }
        return fallback
}

func getEnvAsPath(key string, fallback string) string {
        path := getEnv(key, fallback)

        if _, err := os.Stat(path); os.IsNotExist(err) {
                log.Fatalf("Path %s does not exist", path)
        }

        return path
}

func GetPort() string {
        return port
}

func GetDBFilePath() string {
        return dbFilePath
}

func GetJSONFilePath() string {
        return jsonFilePath
}

func GetFullScan() bool {
        return fullScan
}

func GetReadonlyMode() bool {
        return readonly
}

func GetYoutubeApiKey() string {
        return youtube_api_key
}
