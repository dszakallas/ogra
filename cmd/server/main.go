// Package main provides the entry point for the ogra backend API server.
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/dszakallas/kolobok/ogra/internal/config"
	"github.com/dszakallas/kolobok/ogra/internal/handler"
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
	flag.Parse()

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

	log.Printf("Connected to Kubernetes API host=%s (context=%s)", clients.Host, clients.ActiveContext)

	infoH := handler.NewInfoHandler(clients.Typed)
	wfH := handler.NewWorkflowHandler(clients.Dynamic)
	wfTplH := handler.NewWorkflowTemplateHandler(clients.Dynamic)
	cronH := handler.NewCronWorkflowHandler(clients.Dynamic)
	eventsH := handler.NewEventsHandler(clients.Dynamic)
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
	mux.HandleFunc("GET /api/v1/workflow-events/{namespace}", func(w http.ResponseWriter, r *http.Request) {
		eventsH.StreamWorkflowEvents(w, r, r.PathValue("namespace"))
	})

	// Health Check
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	log.Printf("Starting ogra backend server on :%s ...", port)
	if err := http.ListenAndServe(":"+port, corsMiddleware(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
