// Package handler implements HTTP request handlers for the ogra API.
package handler

import (
	"fmt"
	"net/http"

	"github.com/dszakallas/ogra/internal/config"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

var clusterWorkflowTemplateResource = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Version:  "v1alpha1",
	Resource: "clusterworkflowtemplates",
}

// ClusterWorkflowTemplateHandler handles HTTP endpoints for ClusterWorkflowTemplates.
type ClusterWorkflowTemplateHandler struct {
	dynClient dynamic.Interface
	serverCfg *config.ServerConfig
}

// NewClusterWorkflowTemplateHandler creates a new ClusterWorkflowTemplateHandler.
func NewClusterWorkflowTemplateHandler(dynClient dynamic.Interface, serverCfg *config.ServerConfig) *ClusterWorkflowTemplateHandler {
	return &ClusterWorkflowTemplateHandler{
		dynClient: dynClient,
		serverCfg: serverCfg,
	}
}

// ListClusterWorkflowTemplates responds with ClusterWorkflowTemplate resources.
func (h *ClusterWorkflowTemplateHandler) ListClusterWorkflowTemplates(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if h.serverCfg != nil && !h.serverCfg.ClusterWorkflowTemplates {
		writeJSON(w, map[string]any{
			"apiVersion": "argoproj.io/v1alpha1",
			"kind":       "ClusterWorkflowTemplateList",
			"items":      []unstructured.Unstructured{},
		})
		return
	}

	unstructuredList, err := h.dynClient.Resource(clusterWorkflowTemplateResource).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		if apierrors.IsForbidden(err) {
			writeJSON(w, map[string]any{
				"apiVersion": "argoproj.io/v1alpha1",
				"kind":       "ClusterWorkflowTemplateList",
				"items":      []unstructured.Unstructured{},
			})
			return
		}
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	items := unstructuredList.Items
	if items == nil {
		items = []unstructured.Unstructured{}
	}

	writeJSON(w, map[string]any{
		"apiVersion": "argoproj.io/v1alpha1",
		"kind":       "ClusterWorkflowTemplateList",
		"items":      items,
	})
}

// GetClusterWorkflowTemplate responds with a single ClusterWorkflowTemplate resource.
func (h *ClusterWorkflowTemplateHandler) GetClusterWorkflowTemplate(w http.ResponseWriter, r *http.Request, name string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if h.serverCfg != nil && !h.serverCfg.ClusterWorkflowTemplates {
		writeError(w, fmt.Errorf("cluster workflow templates are disabled"), http.StatusNotFound)
		return
	}

	res, err := h.dynClient.Resource(clusterWorkflowTemplateResource).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsForbidden(err) {
			writeError(w, err, http.StatusForbidden)
			return
		}
		writeError(w, err, http.StatusNotFound)
		return
	}

	writeJSON(w, res)
}
