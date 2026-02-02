package middleware

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type rateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	r        rate.Limit
	b        int
}

func newRateLimiter(r rate.Limit, b int) *rateLimiter {
	return &rateLimiter{
		limiters: make(map[string]*rate.Limiter),
		r:        r,
		b:        b,
	}
}

func (rl *rateLimiter) get(key string) *rate.Limiter {
	rl.mu.RLock()
	l, ok := rl.limiters[key]
	rl.mu.RUnlock()
	if ok {
		return l
	}
	rl.mu.Lock()
	defer rl.mu.Unlock()
	l = rate.NewLimiter(rl.r, rl.b)
	rl.limiters[key] = l
	return l
}

// 600 req/s per IP with burst 600 so dashboard (global + my + per-user stats), products, roadmap don't hit 429
var defaultLimiter = newRateLimiter(rate.Limit(600), 600)

func RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()
		if l := defaultLimiter.get(key); !l.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
