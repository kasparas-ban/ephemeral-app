package main

import (
	"net/http/httptest"
	"testing"
)

func setAllowedOriginsForTest(t *testing.T, value string) {
	t.Helper()

	previous := allowedOrigins
	allowedOrigins = parseAllowedOrigins(value)
	t.Cleanup(func() {
		allowedOrigins = previous
	})
}

func TestCheckOrigin(t *testing.T) {
	// empty Origin -> false
	t.Run("no origin header", func(t *testing.T) {
		setAllowedOriginsForTest(t, "http://localhost:3000")
		r := httptest.NewRequest("GET", "http://example.com/connect", nil)
		if got := checkOrigin(r); got {
			t.Fatalf("expected false, got true")
		}
	})

	// env unset -> false
	t.Run("env unset", func(t *testing.T) {
		setAllowedOriginsForTest(t, "")
		r := httptest.NewRequest("GET", "http://example.com/connect", nil)
		r.Header.Set("Origin", "http://localhost:3000")
		if got := checkOrigin(r); got {
			t.Fatalf("expected false, got true")
		}
	})

	// not in allowlist -> false
	t.Run("not allowed", func(t *testing.T) {
		setAllowedOriginsForTest(t, "http://localhost:3000")
		r := httptest.NewRequest("GET", "http://example.com/connect", nil)
		r.Header.Set("Origin", "https://other.com")
		if got := checkOrigin(r); got {
			t.Fatalf("expected false, got true")
		}
	})

	// exact match -> true
	t.Run("allowed single", func(t *testing.T) {
		setAllowedOriginsForTest(t, "http://localhost:3000")
		r := httptest.NewRequest("GET", "http://example.com/connect", nil)
		r.Header.Set("Origin", "http://localhost:3000")
		if got := checkOrigin(r); !got {
			t.Fatalf("expected true, got false")
		}
	})

	// multiple with spaces -> true
	t.Run("allowed multiple with spaces", func(t *testing.T) {
		setAllowedOriginsForTest(t, " https://a.com , http://localhost:3000 , https://b.com ")
		r := httptest.NewRequest("GET", "http://example.com/connect", nil)
		r.Header.Set("Origin", "http://localhost:3000")
		if got := checkOrigin(r); !got {
			t.Fatalf("expected true, got false")
		}
	})

	t.Run("allowed origin normalizes trailing slash", func(t *testing.T) {
		setAllowedOriginsForTest(t, "https://app.example.com/")
		r := httptest.NewRequest("GET", "http://example.com/connect", nil)
		r.Header.Set("Origin", "https://app.example.com")
		if got := checkOrigin(r); !got {
			t.Fatalf("expected true, got false")
		}
	})

	t.Run("rejects malformed origin", func(t *testing.T) {
		setAllowedOriginsForTest(t, "http://localhost:3000")
		r := httptest.NewRequest("GET", "http://example.com/connect", nil)
		r.Header.Set("Origin", "not-a-url")
		if got := checkOrigin(r); got {
			t.Fatalf("expected false, got true")
		}
	})
}

func TestLoadConfig(t *testing.T) {
	t.Run("requires port", func(t *testing.T) {
		t.Setenv("PORT", "")
		t.Setenv("ALLOWED_ORIGINS", "http://localhost:3000")

		if _, err := loadConfig(); err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("requires allowed origins", func(t *testing.T) {
		t.Setenv("PORT", "8080")
		t.Setenv("ALLOWED_ORIGINS", "")

		if _, err := loadConfig(); err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("loads config", func(t *testing.T) {
		t.Setenv("PORT", "8080")
		t.Setenv("ALLOWED_ORIGINS", " https://app.example.com , http://localhost:3000 ")

		cfg, err := loadConfig()
		if err != nil {
			t.Fatalf("load config: %v", err)
		}

		if cfg.Addr != ":8080" {
			t.Fatalf("expected addr :8080, got %q", cfg.Addr)
		}

		if _, ok := cfg.AllowedOrigins["https://app.example.com"]; !ok {
			t.Fatal("expected https://app.example.com origin")
		}

		if _, ok := cfg.AllowedOrigins["http://localhost:3000"]; !ok {
			t.Fatal("expected http://localhost:3000 origin")
		}
	})

	t.Run("normalizes allowed origins", func(t *testing.T) {
		t.Setenv("PORT", "8080")
		t.Setenv("ALLOWED_ORIGINS", " https://app.example.com/ignored-path , http://localhost:3000/ ")

		cfg, err := loadConfig()
		if err != nil {
			t.Fatalf("load config: %v", err)
		}

		if _, ok := cfg.AllowedOrigins["https://app.example.com"]; !ok {
			t.Fatal("expected normalized https://app.example.com origin")
		}

		if _, ok := cfg.AllowedOrigins["http://localhost:3000"]; !ok {
			t.Fatal("expected normalized http://localhost:3000 origin")
		}
	})
}
