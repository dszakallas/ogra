package handler

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/dszakallas/ogra/internal/config"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
)

type resourceWatchTarget struct {
	gvr           schema.GroupVersionResource
	kind          string
	clusterScoped bool
}

var watchResources = []resourceWatchTarget{
	{gvr: workflowResource, kind: "Workflow"},
	{gvr: workflowTemplateResource, kind: "WorkflowTemplate"},
	{gvr: clusterWorkflowTemplateResource, kind: "ClusterWorkflowTemplate", clusterScoped: true},
	{gvr: cronWorkflowResource, kind: "CronWorkflow"},
}

type resourceWatchEvent struct {
	eventType watch.EventType
	kind      string
	object    *unstructured.Unstructured
}

// EventsHandler handles SSE workflow and resource events watch stream.
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

// StreamWorkflowEvents streams SSE watch events for resources (backward compatibility alias).
func (h *EventsHandler) StreamWorkflowEvents(w http.ResponseWriter, r *http.Request, ns string) {
	h.StreamEvents(w, r, ns)
}

// StreamEvents streams SSE watch events for all supported Kubernetes resources (Workflows, Templates, CronWorkflows).
func (h *EventsHandler) StreamEvents(w http.ResponseWriter, r *http.Request, ns string) {
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

	var namespaces []string
	switch {
	case targetNs != "":
		namespaces = []string{targetNs}
	case h.serverCfg != nil && h.serverCfg.Namespaced && len(h.serverCfg.ManagedNamespaces) > 0:
		namespaces = h.serverCfg.ManagedNamespaces
	default:
		namespaces = []string{""} // Cluster-wide
	}

	ctx := r.Context()
	eventChan := make(chan resourceWatchEvent, 100)
	var wg sync.WaitGroup

	startWatchersForNamespaces := func(nsList []string) int {
		active := 0
		spawnWatcher := func(w watch.Interface, kind string) {
			active++
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer w.Stop()
				for {
					select {
					case <-ctx.Done():
						return
					case event, open := <-w.ResultChan():
						if !open {
							return
						}
						if unstruct, ok := event.Object.(*unstructured.Unstructured); ok {
							objKind := unstruct.GetKind()
							if objKind == "" {
								objKind = kind
								unstruct.SetKind(kind)
							}
							select {
							case <-ctx.Done():
								return
							case eventChan <- resourceWatchEvent{
								eventType: event.Type,
								kind:      objKind,
								object:    unstruct,
							}:
							}
						}
					}
				}
			}()
		}

		for _, target := range watchResources {
			if target.clusterScoped {
				watcher, err := h.dynClient.Resource(target.gvr).Watch(ctx, metav1.ListOptions{})
				if err == nil {
					spawnWatcher(watcher, target.kind)
				}
				continue
			}
			for _, n := range nsList {
				watcher, err := h.dynClient.Resource(target.gvr).Namespace(n).Watch(ctx, metav1.ListOptions{})
				if err == nil {
					spawnWatcher(watcher, target.kind)
				}
			}
		}
		return active
	}

	activeCount := startWatchersForNamespaces(namespaces)

	// Fallback to managed namespaces if cluster-wide watch failed or was forbidden
	if activeCount == 0 && targetNs == "" && h.serverCfg != nil && len(h.serverCfg.ManagedNamespaces) > 0 {
		activeCount = startWatchersForNamespaces(h.serverCfg.ManagedNamespaces)
	}

	if activeCount == 0 {
		http.Error(w, fmt.Sprintf("Failed to start any resource watchers for namespace(s) %v", namespaces), http.StatusInternalServerError)
		return
	}

	// Close eventChan when all watch goroutines exit
	go func() {
		wg.Wait()
		close(eventChan)
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case ev, open := <-eventChan:
			if !open {
				return
			}
			_ = sse.Send("message", map[string]any{
				"type":   string(ev.eventType),
				"kind":   ev.kind,
				"object": ev.object,
			})
		}
	}
}
