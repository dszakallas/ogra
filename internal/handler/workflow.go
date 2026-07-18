package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
)

var workflowResource = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Version:  "v1alpha1",
	Resource: "workflows",
}

// WorkflowHandler handles HTTP endpoints for Workflows.
type WorkflowHandler struct {
	dynClient dynamic.Interface
}

// NewWorkflowHandler creates a new WorkflowHandler.
func NewWorkflowHandler(dynClient dynamic.Interface) *WorkflowHandler {
	return &WorkflowHandler{dynClient: dynClient}
}

// SubmitRequest payload matching frontend submit expectations.
type SubmitRequest struct {
	ResourceKind  string `json:"resourceKind"`
	ResourceName  string `json:"resourceName"`
	SubmitOptions struct {
		Parameters []string `json:"parameters"`
	} `json:"submitOptions"`
}

// ListWorkflows lists workflows in a namespace or all namespaces.
func (h *WorkflowHandler) ListWorkflows(w http.ResponseWriter, r *http.Request, ns string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	targetNs := ns
	if targetNs == "all" || targetNs == "_" {
		targetNs = ""
	}

	labelSelector := r.URL.Query().Get("listOptions.labelSelector")
	opts := metav1.ListOptions{}
	if labelSelector != "" {
		opts.LabelSelector = labelSelector
	}

	unstructuredList, err := h.dynClient.Resource(workflowResource).Namespace(targetNs).List(r.Context(), opts)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list workflows: %v", err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"apiVersion": "argoproj.io/v1alpha1",
		"kind":       "WorkflowList",
		"items":      unstructuredList.Items,
	})
}

// GetWorkflow fetches a single workflow by name.
func (h *WorkflowHandler) GetWorkflow(w http.ResponseWriter, r *http.Request, ns, name string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	wf, err := h.dynClient.Resource(workflowResource).Namespace(ns).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Workflow not found: %v", err), http.StatusNotFound)
		return
	}

	writeJSON(w, wf)
}

// SubmitWorkflow creates a new workflow run from a template.
func (h *WorkflowHandler) SubmitWorkflow(w http.ResponseWriter, r *http.Request, ns string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req SubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid submit payload: %v", err), http.StatusBadRequest)
		return
	}

	var params []map[string]string
	for _, pStr := range req.SubmitOptions.Parameters {
		parts := strings.SplitN(pStr, "=", 2)
		if len(parts) == 2 {
			params = append(params, map[string]string{
				"name":  parts[0],
				"value": parts[1],
			})
		}
	}

	wfObj := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "argoproj.io/v1alpha1",
			"kind":       "Workflow",
			"metadata": map[string]any{
				"generateName": fmt.Sprintf("%s-", req.ResourceName),
				"namespace":    ns,
				"labels": map[string]string{
					"workflows.argoproj.io/workflow-template": req.ResourceName,
				},
			},
			"spec": map[string]any{
				"workflowTemplateRef": map[string]any{
					"name": req.ResourceName,
				},
				"arguments": map[string]any{
					"parameters": params,
				},
			},
		},
	}

	created, err := h.dynClient.Resource(workflowResource).Namespace(ns).Create(r.Context(), wfObj, metav1.CreateOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to submit workflow: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, created)
}

// PatchWorkflowAction sends merge patches for suspend, resume, stop, and terminate.
func (h *WorkflowHandler) PatchWorkflowAction(w http.ResponseWriter, r *http.Request, ns, name, action string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var patchData string
	switch action {
	case "suspend":
		patchData = `{"spec":{"suspend":true}}`
	case "resume":
		patchData = `{"spec":{"suspend":false}}`
	case "stop":
		patchData = `{"spec":{"shutdown":"Stop"}}`
	case "terminate":
		patchData = `{"spec":{"shutdown":"Terminate"}}`
	default:
		http.Error(w, "Unsupported workflow action", http.StatusBadRequest)
		return
	}

	patched, err := h.dynClient.Resource(workflowResource).Namespace(ns).Patch(
		r.Context(),
		name,
		types.MergePatchType,
		[]byte(patchData),
		metav1.PatchOptions{},
	)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to %s workflow: %v", action, err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, patched)
}

// DeleteWorkflow removes a workflow resource.
func (h *WorkflowHandler) DeleteWorkflow(w http.ResponseWriter, r *http.Request, ns, name string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	err := h.dynClient.Resource(workflowResource).Namespace(ns).Delete(r.Context(), name, metav1.DeleteOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to delete workflow: %v", err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "deleted", "name": name})
}
