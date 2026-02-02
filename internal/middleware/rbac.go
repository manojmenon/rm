package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequireRole(roles ...string) gin.HandlerFunc {
	set := make(map[string]bool)
	for _, r := range roles {
		set[r] = true
	}
	return func(c *gin.Context) {
		role, exists := c.Get(UserRoleKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if !set[role.(string)] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

func RequireAdmin() gin.HandlerFunc {
	return RequireRole("admin")
}

func RequireOwnerOrAdmin() gin.HandlerFunc {
	return RequireRole("admin", "owner")
}
