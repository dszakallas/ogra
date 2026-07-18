package handler

import (
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
)

var cronWorkflowResource = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Version:  "v1alpha1",
	Resource: "cronworkflows",
}

// CronWorkflowHandler handles HTTP endpoints for CronWorkflows.
type CronWorkflowHandler struct {
	dynClient dynamic.Interface
}

// NewCronWorkflowHandler creates a new CronWorkflowHandler.
func NewCronWorkflowHandler(dynClient dynamic.Interface) *CronWorkflowHandler {
	return &CronWorkflowHandler{dynClient: dynClient}
}

// ListCronWorkflows lists CronWorkflows in a namespace or all namespaces.
func (h *CronWorkflowHandler) ListCronWorkflows(w http.ResponseWriter, r *http.Request, ns string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	targetNs := ns
	if targetNs == "all" || targetNs == "_" {
		targetNs = ""
	}

	unstructuredList, err := h.dynClient.Resource(cronWorkflowResource).Namespace(targetNs).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list cronworkflows: %v", err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"apiVersion": "argoproj.io/v1alpha1",
		"kind":       "CronWorkflowList",
		"items":      unstructuredList.Items,
	})
}

// GetCronWorkflow fetches a single CronWorkflow by name.
func (h *CronWorkflowHandler) GetCronWorkflow(w http.ResponseWriter, r *http.Request, ns, name string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	cwf, err := h.dynClient.Resource(cronWorkflowResource).Namespace(ns).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("CronWorkflow not found: %v", err), http.StatusNotFound)
		return
	}

	writeJSON(w, cwf)
}

// ToggleSuspend patches the CronWorkflow suspend field.
func (h *CronWorkflowHandler) ToggleSuspend(w http.ResponseWriter, r *http.Request, ns, name string, suspend bool) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	patchData := fmt.Sprintf(`{"spec":{"suspend":%t}}`, suspend)
	patched, err := h.dynClient.Resource(cronWorkflowResource).Namespace(ns).Patch(
		r.Context(),
		name,
		types.MergePatchType,
		[]byte(patchData),
		metav1.PatchOptions{},
	)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update CronWorkflow suspend state: %v", err), http.StatusInternalServerError)
		return
	}

	writeJSON(w, patched)
}

// TriggerCronWorkflow creates a new workflow run from CronWorkflow spec.
func (h *CronWorkflowHandler) TriggerCronWorkflow(w http.ResponseWriter, r *http.Request, ns, name string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	cwf, err := h.dynClient.Resource(cronWorkflowResource).Namespace(ns).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("CronWorkflow not found: %v", err), http.StatusNotFound)
		return
	}

	wfSpec, _, _ := unstructured.NestedMap(cwf.Object, "spec", "workflowSpec")
	if wfSpec == nil {
		wfSpec = map[string]any{}
	}

	wfObj := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "argoproj.io/v1alpha1",
			"kind":       "Workflow",
			"metadata": map[string]any{
				"generateName": fmt.Sprintf("%s-", name),
				"namespace":    ns,
				"labels": map[string]string{
					"workflows.argoproj.io/cron-workflow": name,
				},
				"ownerReferences": []map[string]any{
					{
						"apiVersion": "argoproj.io/v1alpha1",
						"kind":       "CronWorkflow",
						"name":       name,
						"uid":        cwf.GetUID(),
					},
				},
			},
			"spec": wfSpec,
		},
	}

	created, err := h.dynClient.Resource(workflowResource).Namespace(ns).Create(r.Context(), wfObj, metav1.CreateOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to trigger CronWorkflow: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, created)
}
