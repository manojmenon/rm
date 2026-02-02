package middleware

import "github.com/gin-gonic/gin"

const AuditIPKey = "audit_ip"
const AuditUserAgentKey = "audit_user_agent"

func AuditContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(AuditIPKey, c.ClientIP())
		c.Set(AuditUserAgentKey, c.Request.UserAgent())
		c.Next()
	}
}
