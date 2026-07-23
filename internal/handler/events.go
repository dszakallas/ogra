package handler

import (
	"fmt"
	"net/http"

	"github.com/dszakallas/ogra/internal/config"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
)

// EventsHandler handles SSE workflow events watch stream.
type EventsHandler struct {
	dynClient dynamic.Interface
	serverCfg *config.ServerConfig
}

// NewEventsHandler creates a new EventsHandler.
func NewEventsHandler(dynClient dynamic.Interface, serverCfg *config.ServerConfig) *EventsHandler {
	return &EventsHandler{
		dynClient: dynClient,
		serverCfg: serverCfg,
	}
}

// StreamWorkflowEvents streams SSE watch events for workflows.
func (h *EventsHandler) StreamWorkflowEvents(w http.ResponseWriter, r *http.Request, ns string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	sse, err := NewSSEWriter(w)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	targetNs := ns
	if targetNs == "all" || targetNs == "_" {
		targetNs = ""
	}

	if targetNs == "" && h.serverCfg != nil && h.serverCfg.Namespaced && len(h.serverCfg.ManagedNamespaces) > 0 {
		targetNs = h.serverCfg.ManagedNamespaces[0]
	}

	watcher, err := h.dynClient.Resource(workflowResource).Namespace(targetNs).Watch(r.Context(), metav1.ListOptions{})
	if err != nil && targetNs == "" && apierrors.IsForbidden(err) && h.serverCfg != nil && len(h.serverCfg.ManagedNamespaces) > 0 {
		targetNs = h.serverCfg.ManagedNamespaces[0]
		watcher, err = h.dynClient.Resource(workflowResource).Namespace(targetNs).Watch(r.Context(), metav1.ListOptions{})
	}
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to watch workflows: %v", err), http.StatusInternalServerError)
		return
	}
	defer watcher.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case event, open := <-watcher.ResultChan():
			if !open {
				return
			}

			if unstruct, ok := event.Object.(*unstructured.Unstructured); ok {
				_ = sse.Send("message", map[string]any{
					"type":   string(event.Type),
					"object": unstruct,
				})
			}
		}
	}
}
