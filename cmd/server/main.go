package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/rm/roadmap/internal/auth"
	"github.com/rm/roadmap/internal/config"
	"github.com/rm/roadmap/internal/handlers"
	"github.com/rm/roadmap/internal/middleware"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
	"github.com/rm/roadmap/internal/services"
	"github.com/rm/roadmap/internal/telemetry"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	cfg := config.Load()

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host, cfg.Database.Port, cfg.Database.User,
		cfg.Database.Password, cfg.Database.DBName, cfg.Database.SSLMode,
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		logger.Fatal("db connect failed", zap.Error(err))
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Product{},
		&models.Milestone{},
		&models.Dependency{},
		&models.ProductRequest{},
		&models.AuditLog{},
		&models.ProductVersion{},
		&models.ProductDeletionRequest{},
		&models.Group{},
		&models.ProductVersionDependency{},
		&models.Notification{},
		&models.HoldingCompany{},
		&models.Company{},
		&models.Function{},
		&models.Department{},
		&models.Team{},
		&models.UserDottedLineManager{},
		&models.ActivityLog{},
	); err != nil {
		logger.Fatal("migrate failed", zap.Error(err))
	}

	jwtService := auth.NewJWTService(
		cfg.JWT.Secret,
		cfg.JWT.AccessExpiryMin,
		cfg.JWT.RefreshExpiryMin,
	)

	userRepo := repositories.NewUserRepository(db)
	productRepo := repositories.NewProductRepository(db)
	milestoneRepo := repositories.NewMilestoneRepository(db)
	depRepo := repositories.NewDependencyRepository(db)
	reqRepo := repositories.NewProductRequestRepository(db)
	auditRepo := repositories.NewAuditRepository(db)
	activityRepo := repositories.NewActivityRepository(db)
	versionRepo := repositories.NewProductVersionRepository(db)
	deletionReqRepo := repositories.NewProductDeletionRequestRepository(db)
	groupRepo := repositories.NewGroupRepository(db)
	versionDepRepo := repositories.NewProductVersionDependencyRepository(db)
	notificationRepo := repositories.NewNotificationRepository(db)
	holdingRepo := repositories.NewHoldingCompanyRepository(db)
	companyRepo := repositories.NewCompanyRepository(db)
	funcRepo := repositories.NewFunctionRepository(db)
	deptRepo := repositories.NewDepartmentRepository(db)
	teamRepo := repositories.NewTeamRepository(db)
	dottedLineRepo := repositories.NewUserDottedLineRepository(db)

	auditSvc := services.NewAuditService(auditRepo, productRepo, logger)
	activitySvc := services.NewActivityService(activityRepo, logger)
	notificationSvc := services.NewNotificationService(notificationRepo)

	authSvc := services.NewAuthService(userRepo, jwtService)
	productSvc := services.NewProductService(productRepo, versionRepo, deletionReqRepo, groupRepo, milestoneRepo, auditSvc, activitySvc, notificationSvc)
	groupSvc := services.NewGroupService(groupRepo)
	milestoneSvc := services.NewMilestoneService(milestoneRepo, productRepo, depRepo, auditSvc, activitySvc)
	depSvc := services.NewDependencyService(depRepo, milestoneRepo, auditSvc, activitySvc)
	reqSvc := services.NewProductRequestService(reqRepo, productRepo, userRepo, auditSvc, activitySvc, notificationSvc)
	productVersionSvc := services.NewProductVersionService(versionRepo, productRepo, auditSvc, activitySvc)
	versionDepSvc := services.NewProductVersionDependencyService(versionDepRepo, versionRepo, productRepo, auditSvc)
	deletionReqSvc := services.NewProductDeletionRequestService(deletionReqRepo, productRepo, versionRepo, userRepo, auditSvc, activitySvc, notificationSvc)
	orgSvc := services.NewOrgService(holdingRepo, companyRepo, funcRepo, deptRepo, teamRepo)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	tp, err := telemetry.InitTracerProvider(ctx)
	if err != nil {
		logger.Warn("otel tracer init failed, using noop", zap.Error(err))
	} else {
		defer func() { _ = tp.Shutdown(ctx) }()
	}

	authHandler := handlers.NewAuthHandler(authSvc, activitySvc)
	productHandler := handlers.NewProductHandler(productSvc)
	milestoneHandler := handlers.NewMilestoneHandler(milestoneSvc)
	depHandler := handlers.NewDependencyHandler(depSvc)
	reqHandler := handlers.NewProductRequestHandler(reqSvc)
	userHandler := handlers.NewUserHandler(userRepo, dottedLineRepo, productRepo)
	orgHandler := handlers.NewOrgHandler(orgSvc)
	productVersionHandler := handlers.NewProductVersionHandler(productVersionSvc)
	versionDepHandler := handlers.NewProductVersionDependencyHandler(versionDepSvc)
	deletionReqHandler := handlers.NewProductDeletionRequestHandler(deletionReqSvc)
	notificationHandler := handlers.NewNotificationHandler(notificationSvc)
	auditHandler := handlers.NewAuditHandler(auditSvc, authSvc)
	activityHandler := handlers.NewActivityHandler(activitySvc)
	groupHandler := handlers.NewGroupHandler(groupSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(gin.Logger())
	r.Use(middleware.CORS())
	r.Use(middleware.RequestID())
	r.Use(middleware.Telemetry())
	r.Use(middleware.RateLimit())

	r.POST("/auth/login", authHandler.Login)
	r.POST("/auth/register", authHandler.Register)
	r.POST("/auth/refresh", authHandler.Refresh)

	api := r.Group("/api")
	api.Use(middleware.Auth(jwtService))
	api.Use(middleware.AuditContext())
	{
		api.POST("/auth/logout", activityHandler.Logout)

		api.GET("/products", productHandler.List)
		api.POST("/products", productHandler.Create)
		api.GET("/products/:id", productHandler.GetByID)
		api.PUT("/products/:id", productHandler.Update)
		api.DELETE("/products/:id", middleware.RequireAdmin(), productHandler.Delete)

		api.GET("/products/:id/milestones", milestoneHandler.ListByProduct)
		api.GET("/products/:id/versions", productVersionHandler.ListByProduct)
		api.POST("/product-versions", productVersionHandler.Create)
		api.PUT("/product-versions/:id", productVersionHandler.Update)
		api.DELETE("/product-versions/:id", productVersionHandler.Delete)
		api.GET("/product-versions/:id/dependencies", versionDepHandler.ListByProductVersion)
		api.POST("/product-version-dependencies", versionDepHandler.Create)
		api.DELETE("/product-version-dependencies/:id", versionDepHandler.Delete)
		api.POST("/products/:id/request-deletion", deletionReqHandler.Create)
		api.GET("/product-deletion-requests", deletionReqHandler.List)
		api.PUT("/product-deletion-requests/:id/approve", middleware.RequireAdmin(), deletionReqHandler.Approve)
		api.POST("/milestones", milestoneHandler.Create)
		api.PUT("/milestones/:id", milestoneHandler.Update)
		api.DELETE("/milestones/:id", milestoneHandler.Delete)

		api.GET("/dependencies", depHandler.List)
		api.POST("/dependencies", depHandler.Create)
		api.DELETE("/dependencies/:id", depHandler.Delete)

		api.POST("/product-requests", reqHandler.Create)
		api.GET("/product-requests", reqHandler.List)
		api.PUT("/product-requests/:id/approve", middleware.RequireAdmin(), reqHandler.Approve)

		api.GET("/notifications", notificationHandler.List)
		api.GET("/notifications/unread-count", notificationHandler.UnreadCount)
		api.PUT("/notifications/read-all", notificationHandler.MarkReadAll)
		api.PUT("/notifications/:id/read", notificationHandler.MarkRead)
		api.PUT("/notifications/:id/archive", notificationHandler.Archive)
		api.DELETE("/notifications/:id", notificationHandler.Delete)

		api.GET("/users", middleware.RequireAdmin(), userHandler.List)
		api.GET("/users/:id", middleware.RequireAdmin(), userHandler.GetByID)
		api.PUT("/users/:id", middleware.RequireAdmin(), userHandler.Update)
		api.PUT("/users/:id/remove-from-products", middleware.RequireAdmin(), userHandler.RemoveFromProducts)
		api.DELETE("/users/:id", middleware.RequireAdmin(), userHandler.Delete)
		api.GET("/users/:id/dotted-line-managers", middleware.RequireAdmin(), userHandler.ListDottedLineManagers)
		api.POST("/users/:id/dotted-line-managers", middleware.RequireAdmin(), userHandler.AddDottedLineManager)
		api.DELETE("/users/:id/dotted-line-managers/:manager_id", middleware.RequireAdmin(), userHandler.RemoveDottedLineManager)

		api.GET("/holding-companies", middleware.RequireAdmin(), orgHandler.ListHoldingCompanies)
		api.POST("/holding-companies", middleware.RequireAdmin(), orgHandler.CreateHoldingCompany)
		api.GET("/holding-companies/:id", middleware.RequireAdmin(), orgHandler.GetHoldingCompany)
		api.PUT("/holding-companies/:id", middleware.RequireAdmin(), orgHandler.UpdateHoldingCompany)
		api.DELETE("/holding-companies/:id", middleware.RequireAdmin(), orgHandler.DeleteHoldingCompany)

		api.GET("/companies", middleware.RequireAdmin(), orgHandler.ListCompanies)
		api.POST("/companies", middleware.RequireAdmin(), orgHandler.CreateCompany)
		api.GET("/companies/:id", middleware.RequireAdmin(), orgHandler.GetCompany)
		api.PUT("/companies/:id", middleware.RequireAdmin(), orgHandler.UpdateCompany)
		api.DELETE("/companies/:id", middleware.RequireAdmin(), orgHandler.DeleteCompany)

		api.GET("/functions", middleware.RequireAdmin(), orgHandler.ListFunctions)
		api.POST("/functions", middleware.RequireAdmin(), orgHandler.CreateFunction)
		api.GET("/functions/:id", middleware.RequireAdmin(), orgHandler.GetFunction)
		api.PUT("/functions/:id", middleware.RequireAdmin(), orgHandler.UpdateFunction)
		api.DELETE("/functions/:id", middleware.RequireAdmin(), orgHandler.DeleteFunction)

		api.GET("/departments", middleware.RequireAdmin(), orgHandler.ListDepartments)
		api.POST("/departments", middleware.RequireAdmin(), orgHandler.CreateDepartment)
		api.GET("/departments/:id", middleware.RequireAdmin(), orgHandler.GetDepartment)
		api.PUT("/departments/:id", middleware.RequireAdmin(), orgHandler.UpdateDepartment)
		api.DELETE("/departments/:id", middleware.RequireAdmin(), orgHandler.DeleteDepartment)

		api.GET("/teams", middleware.RequireAdmin(), orgHandler.ListTeams)
		api.POST("/teams", middleware.RequireAdmin(), orgHandler.CreateTeam)
		api.GET("/teams/:id", middleware.RequireAdmin(), orgHandler.GetTeam)
		api.PUT("/teams/:id", middleware.RequireAdmin(), orgHandler.UpdateTeam)
		api.DELETE("/teams/:id", middleware.RequireAdmin(), orgHandler.DeleteTeam)
		api.GET("/audit-logs", auditHandler.List)
		api.POST("/audit-logs/archive", middleware.RequireAdmin(), auditHandler.Archive)
		api.POST("/audit-logs/archive/delete", middleware.RequireAdmin(), auditHandler.DeleteArchived)
		api.GET("/activity-logs", middleware.RequireAdmin(), activityHandler.List)

		api.GET("/groups", groupHandler.List)
		api.POST("/groups", groupHandler.Create)
		api.GET("/groups/:id", groupHandler.GetByID)
		api.PUT("/groups/:id", groupHandler.Update)
		api.DELETE("/groups/:id", groupHandler.Delete)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	addr := ":" + cfg.Server.Port
	logger.Info("server listening", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		logger.Fatal("server run failed", zap.Error(err))
		os.Exit(1)
	}
}
