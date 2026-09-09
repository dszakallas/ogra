// Package main provides the entry point for the ogra backend API server.
package main

import (
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/dszakallas/ogra/frontend"
	"github.com/dszakallas/ogra/internal/config"
	"github.com/dszakallas/ogra/internal/handler"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	portFlag := flag.String("port", "", "HTTP server port (default 8080 or $PORT)")
	kubeconfigFlag := flag.String("kubeconfig", "", "Path to kubeconfig file (or $KUBECONFIG)")
	contextFlag := flag.String("context", "", "Kubernetes context name (or $KUBE_CONTEXT)")
	apiServerFlag := flag.String("server", "", "Kubernetes API server URL (or $KUBE_API_SERVER)")
	namespacedFlag := flag.Bool("namespaced", false, "Run in namespaced mode (or $NAMESPACED)")
	managedNsFlag := flag.String("managed-namespace", "", "Managed namespace(s), comma-separated (or $MANAGED_NAMESPACE)")
	clusterWfTplFlag := flag.Bool("cluster-workflow-templates", true, "Enable ClusterWorkflowTemplate support (or $CLUSTER_WORKFLOW_TEMPLATES)")
	flag.Parse()

	var cwtExplicit *bool
	flag.Visit(func(f *flag.Flag) {
		if f.Name == "cluster-workflow-templates" {
			cwtExplicit = clusterWfTplFlag
		}
	})

	port := *portFlag
	if port == "" || strings.HasPrefix(port, "-") {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = "8080"
	}

	opts := config.KubeConfigOptions{
		Kubeconfig: *kubeconfigFlag,
		Context:    *contextFlag,
		APIServer:  *apiServerFlag,
	}

	clients, err := config.NewKubeClients(opts)
	if err != nil {
		log.Fatalf("Failed to initialize Kubernetes client: %v", err)
	}

	serverCfg := config.NewServerConfig(*namespacedFlag, *managedNsFlag, cwtExplicit)

	log.Printf("Connected to Kubernetes API host=%s (context=%s, namespaced=%t, managed=%v, clusterWorkflowTemplates=%t)",
		clients.Host, clients.ActiveContext, serverCfg.Namespaced, serverCfg.ManagedNamespaces, serverCfg.ClusterWorkflowTemplates)

	infoH := handler.NewInfoHandler(clients.Typed, serverCfg)
	wfH := handler.NewWorkflowHandler(clients.Dynamic, serverCfg)
	wfTplH := handler.NewWorkflowTemplateHandler(clients.Dynamic, serverCfg)
	clusterWfTplH := handler.NewClusterWorkflowTemplateHandler(clients.Dynamic, serverCfg)
	cronH := handler.NewCronWorkflowHandler(clients.Dynamic, serverCfg)
	eventsH := handler.NewEventsHandler(clients.Dynamic, serverCfg)
	logsH := handler.NewLogsHandler(clients.Typed)

	mux := http.NewServeMux()

	// Metadata Endpoints
	mux.HandleFunc("GET /api/v1/info", infoH.GetInfo)
	mux.HandleFunc("GET /api/v1/version", infoH.GetVersion)
	mux.HandleFunc("GET /api/v1/userinfo", infoH.GetUserInfo)

	// Workflows Router
	mux.HandleFunc("GET /api/v1/workflows/{namespace}", func(w http.ResponseWriter, r *http.Request) {
		wfH.ListWorkflows(w, r, r.PathValue("namespace"))
	})
	mux.HandleFunc("POST /api/v1/workflows/{namespace}/submit", func(w http.ResponseWriter, r *http.Request) {
		wfH.SubmitWorkflow(w, r, r.PathValue("namespace"))
	})
	mux.HandleFunc("GET /api/v1/workflows/{namespace}/{name}", func(w http.ResponseWriter, r *http.Request) {
		wfH.GetWorkflow(w, r, r.PathValue("namespace"), r.PathValue("name"))
	})
	mux.HandleFunc("GET /api/v1/workflows/{namespace}/{name}/log", func(w http.ResponseWriter, r *http.Request) {
		logsH.StreamWorkflowLogs(w, r, r.PathValue("namespace"), r.PathValue("name"))
	})
	mux.HandleFunc("DELETE /api/v1/workflows/{namespace}/{name}", func(w http.ResponseWriter, r *http.Request) {
		wfH.DeleteWorkflow(w, r, r.PathValue("namespace"), r.PathValue("name"))
	})
	mux.HandleFunc("PUT /api/v1/workflows/{namespace}/{name}/{action}", func(w http.ResponseWriter, r *http.Request) {
		action := r.PathValue("action")
		wfH.PatchWorkflowAction(w, r, r.PathValue("namespace"), r.PathValue("name"), action)
	})

	// WorkflowTemplates Router
	mux.HandleFunc("GET /api/v1/workflow-templates/{namespace}", func(w http.ResponseWriter, r *http.Request) {
		wfTplH.ListWorkflowTemplates(w, r, r.PathValue("namespace"))
	})

	// ClusterWorkflowTemplates Router
	mux.HandleFunc("GET /api/v1/cluster-workflow-templates", func(w http.ResponseWriter, r *http.Request) {
		clusterWfTplH.ListClusterWorkflowTemplates(w, r)
	})
	mux.HandleFunc("GET /api/v1/cluster-workflow-templates/{name}", func(w http.ResponseWriter, r *http.Request) {
		clusterWfTplH.GetClusterWorkflowTemplate(w, r, r.PathValue("name"))
	})

	// CronWorkflows Router
	mux.HandleFunc("GET /api/v1/cron-workflows/{namespace}", func(w http.ResponseWriter, r *http.Request) {
		cronH.ListCronWorkflows(w, r, r.PathValue("namespace"))
	})
	mux.HandleFunc("GET /api/v1/cron-workflows/{namespace}/{name}", func(w http.ResponseWriter, r *http.Request) {
		cronH.GetCronWorkflow(w, r, r.PathValue("namespace"), r.PathValue("name"))
	})
	mux.HandleFunc("PUT /api/v1/cron-workflows/{namespace}/{name}/suspend", func(w http.ResponseWriter, r *http.Request) {
		cronH.ToggleSuspend(w, r, r.PathValue("namespace"), r.PathValue("name"), true)
	})
	mux.HandleFunc("PUT /api/v1/cron-workflows/{namespace}/{name}/resume", func(w http.ResponseWriter, r *http.Request) {
		cronH.ToggleSuspend(w, r, r.PathValue("namespace"), r.PathValue("name"), false)
	})
	mux.HandleFunc("POST /api/v1/cron-workflows/{namespace}/{name}/trigger", func(w http.ResponseWriter, r *http.Request) {
		cronH.TriggerCronWorkflow(w, r, r.PathValue("namespace"), r.PathValue("name"))
	})

	// SSE Stream Router
	mux.HandleFunc("GET /api/v1/events/{namespace}", func(w http.ResponseWriter, r *http.Request) {
		eventsH.StreamEvents(w, r, r.PathValue("namespace"))
	})
	mux.HandleFunc("GET /api/v1/workflow-events/{namespace}", func(w http.ResponseWriter, r *http.Request) {
		eventsH.StreamWorkflowEvents(w, r, r.PathValue("namespace"))
	})

	// Health Check
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// Serve frontend static files
	subFS, err := fs.Sub(frontend.DistFS, "dist")
	if err != nil {
		log.Fatalf("Failed to create sub FS for embedded frontend: %v", err)
	}

	fileServer := http.FileServer(http.FS(subFS))

	// Catch-all handler for the SPA frontend
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// Clean the path to prevent directory traversal
		cleanedPath := filepath.Clean(path)

		// Try to open the file in the subFS to see if it exists
		f, err := subFS.Open(strings.TrimPrefix(cleanedPath, "/"))
		if err == nil {
			_ = f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for SPA client-side routing
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	}))

	log.Printf("Starting ogra backend server on :%s ...", port)
	if err := http.ListenAndServe(":"+port, corsMiddleware(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
