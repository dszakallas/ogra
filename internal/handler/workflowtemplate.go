// Package handler implements HTTP request handlers for the ogra API.
package handler

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
}

// NewWorkflowTemplateHandler creates a new WorkflowTemplateHandler.
func NewWorkflowTemplateHandler(dynClient dynamic.Interface) *WorkflowTemplateHandler {
	return &WorkflowTemplateHandler{dynClient: dynClient}
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

	unstructuredList, err := h.dynClient.Resource(workflowTemplateResource).Namespace(targetNs).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list workflowtemplates: %v", err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"apiVersion": "argoproj.io/v1alpha1",
		"kind":       "WorkflowTemplateList",
		"items":      unstructuredList.Items,
	})
}
