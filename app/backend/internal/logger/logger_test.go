package logger

import (
	"os"
	"testing"
)

func TestNew(t *testing.T) {
	// Default: no env set, should succeed with info/json
	l, err := New()
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	if l == nil {
		t.Fatal("New() returned nil logger")
	}
	_ = l.Sync()
}

func TestNew_withLevel(t *testing.T) {
	os.Setenv("LOG_LEVEL", "debug")
	defer os.Unsetenv("LOG_LEVEL")
	l, err := New()
	if err != nil {
		t.Fatalf("New() with LOG_LEVEL=debug failed: %v", err)
	}
	if l == nil {
		t.Fatal("New() returned nil logger")
	}
	_ = l.Sync()
}

func TestNew_withFormat(t *testing.T) {
	os.Setenv("LOG_FORMAT", "console")
	defer os.Unsetenv("LOG_FORMAT")
	l, err := New()
	if err != nil {
		t.Fatalf("New() with LOG_FORMAT=console failed: %v", err)
	}
	if l == nil {
		t.Fatal("New() returned nil logger")
	}
	_ = l.Sync()
}
