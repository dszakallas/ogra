// Package handler implements HTTP request handlers for the ogra API.
package handler

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Forwarded-User, Remote-User")
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// GetCurrentNamespace returns the configured namespace, pod's serviceaccount namespace, or fallback "default".
func GetCurrentNamespace() string {
	if ns := os.Getenv("NAMESPACE"); ns != "" {
		return ns
	}
	if data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace"); err == nil {
		if ns := strings.TrimSpace(string(data)); ns != "" {
			return ns
		}
	}
	return "default"
}

func writeError(w http.ResponseWriter, err error, defaultStatus int) {
	status := defaultStatus
	switch {
	case apierrors.IsForbidden(err):
		status = http.StatusForbidden
	case apierrors.IsNotFound(err):
		status = http.StatusNotFound
	case apierrors.IsUnauthorized(err):
		status = http.StatusUnauthorized
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": err.Error(),
	})
}
