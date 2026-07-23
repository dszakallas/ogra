// Package handler implements HTTP request handlers for the ogra API.
package handler

import (
	"context"
	"net/http"

	"github.com/dszakallas/ogra/internal/config"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

var workflowTemplateResource = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Version:  "v1alpha1",
	Resource: "workflowtemplates",
}

// WorkflowTemplateHandler handles HTTP endpoints for WorkflowTemplates.
type WorkflowTemplateHandler struct {
	dynClient dynamic.Interface
	serverCfg *config.ServerConfig
}

// NewWorkflowTemplateHandler creates a new WorkflowTemplateHandler.
func NewWorkflowTemplateHandler(dynClient dynamic.Interface, serverCfg *config.ServerConfig) *WorkflowTemplateHandler {
	return &WorkflowTemplateHandler{
		dynClient: dynClient,
		serverCfg: serverCfg,
	}
}

// ListWorkflowTemplates responds with WorkflowTemplate resources filtered by optional namespace query param.
func (h *WorkflowTemplateHandler) ListWorkflowTemplates(w http.ResponseWriter, r *http.Request, ns string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	targetNs := ns
	if targetNs == "all" || targetNs == "_" {
		targetNs = ""
	}

	var items []unstructured.Unstructured
	if targetNs == "" && h.serverCfg != nil && h.serverCfg.Namespaced {
		for _, managed := range h.serverCfg.ManagedNamespaces {
			list, err := h.dynClient.Resource(workflowTemplateResource).Namespace(managed).List(context.Background(), metav1.ListOptions{})
			if err == nil {
				items = append(items, list.Items...)
			}
		}
	} else {
		unstructuredList, err := h.dynClient.Resource(workflowTemplateResource).Namespace(targetNs).List(context.Background(), metav1.ListOptions{})
		switch {
		case err == nil:
			items = unstructuredList.Items
		case targetNs == "" && apierrors.IsForbidden(err) && h.serverCfg != nil:
			for _, managed := range h.serverCfg.ManagedNamespaces {
				list, lErr := h.dynClient.Resource(workflowTemplateResource).Namespace(managed).List(context.Background(), metav1.ListOptions{})
				if lErr == nil {
					items = append(items, list.Items...)
				}
			}
		default:
			writeError(w, err, http.StatusInternalServerError)
			return
		}
	}

	if items == nil {
		items = []unstructured.Unstructured{}
	}

	writeJSON(w, map[string]any{
		"apiVersion": "argoproj.io/v1alpha1",
		"kind":       "WorkflowTemplateList",
		"items":      items,
	})
}
