package logger

import (
	"os"
	"strings"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Level names supported in LOG_LEVEL (case-insensitive).
const (
	LevelDebug = "debug"
	LevelInfo  = "info"
	LevelWarn  = "warn"
	LevelError = "error"
)

// Format names supported in LOG_FORMAT (case-insensitive).
const (
	FormatConsole = "console"
	FormatJSON    = "json"
)

// New builds a zap.Logger from environment variables:
//   - LOG_LEVEL: debug | info | warn | error (default: info)
//   - LOG_FORMAT: console | json (default: json)
//
// At debug level, caller is added to each log line for easier tracing.
func New() (*zap.Logger, error) {
	level := parseLevel(getEnv("LOG_LEVEL", LevelInfo))
	format := strings.ToLower(strings.TrimSpace(getEnv("LOG_FORMAT", FormatJSON)))
	addCaller := level.Enabled(zapcore.DebugLevel)

	var encoder zapcore.Encoder
	encConfig := zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}
	switch format {
	case FormatConsole:
		encoder = zapcore.NewConsoleEncoder(encConfig)
	default:
		encoder = zapcore.NewJSONEncoder(encConfig)
	}

	core := zapcore.NewCore(encoder, zapcore.AddSync(os.Stdout), level)
	opts := []zap.Option{zap.AddStacktrace(zapcore.ErrorLevel)}
	if addCaller {
		opts = append(opts, zap.AddCaller())
	}
	return zap.New(core, opts...), nil
}

func parseLevel(s string) zapcore.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case LevelDebug:
		return zapcore.DebugLevel
	case LevelWarn:
		return zapcore.WarnLevel
	case LevelError:
		return zapcore.ErrorLevel
	default:
		return zapcore.InfoLevel
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
