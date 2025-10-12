package main

import (
	"net/http/httptest"
	"testing"
)

func TestCheckOrigin(t *testing.T) {
	// empty Origin -> false
	t.Run("no origin header", func(t *testing.T) {
		t.Setenv("ALLOWED_ORIGINS", "http://localhost:3000")
		r := httptest.NewRequest("GET", "http://example.com/ws", nil)
		if got := checkOrigin(r); got {
			t.Fatalf("expected false, got true")
		}
	})

	// env unset -> false
	t.Run("env unset", func(t *testing.T) {
		t.Setenv("ALLOWED_ORIGINS", "")
		r := httptest.NewRequest("GET", "http://example.com/ws", nil)
		r.Header.Set("Origin", "http://localhost:3000")
		if got := checkOrigin(r); got {
			t.Fatalf("expected false, got true")
		}
	})

	// not in allowlist -> false
	t.Run("not allowed", func(t *testing.T) {
		t.Setenv("ALLOWED_ORIGINS", "http://localhost:3000")
		r := httptest.NewRequest("GET", "http://example.com/ws", nil)
		r.Header.Set("Origin", "https://other.com")
		if got := checkOrigin(r); got {
			t.Fatalf("expected false, got true")
		}
	})

	// exact match -> true
	t.Run("allowed single", func(t *testing.T) {
		t.Setenv("ALLOWED_ORIGINS", "http://localhost:3000")
		r := httptest.NewRequest("GET", "http://example.com/ws", nil)
		r.Header.Set("Origin", "http://localhost:3000")
		if got := checkOrigin(r); !got {
			t.Fatalf("expected true, got false")
		}
	})

	// multiple with spaces -> true
	t.Run("allowed multiple with spaces", func(t *testing.T) {
		t.Setenv("ALLOWED_ORIGINS", " https://a.com , http://localhost:3000 , https://b.com ")
		r := httptest.NewRequest("GET", "http://example.com/ws", nil)
		r.Header.Set("Origin", "http://localhost:3000")
		if got := checkOrigin(r); !got {
			t.Fatalf("expected true, got false")
		}
	})
}
