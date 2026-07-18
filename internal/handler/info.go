package handler

import (
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// InfoHandler handles system info, version, and userinfo endpoints.
type InfoHandler struct {
	kubeClient kubernetes.Interface
}

// NewInfoHandler creates a new InfoHandler.
func NewInfoHandler(kubeClient kubernetes.Interface) *InfoHandler {
	return &InfoHandler{kubeClient: kubeClient}
}

// InfoResponse matches ServerInfo expected by frontend.
type InfoResponse struct {
	ManagedNamespaces []string `json:"managedNamespaces"`
	Links             []any    `json:"links"`
}

// VersionResponse matches version info expected by frontend.
type VersionResponse struct {
	Version string `json:"version"`
}

// UserInfoResponse matches user info expected by frontend.
type UserInfoResponse struct {
	LoggedIn           bool     `json:"loggedIn"`
	Username           string   `json:"username"`
	Email              string   `json:"email"`
	ServiceAccountName string   `json:"serviceAccountName"`
	Roles              []string `json:"roles"`
}

// GetInfo responds with managed namespaces and UI links.
func (h *InfoHandler) GetInfo(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var namespaces []string
	if h.kubeClient != nil {
		nsList, err := h.kubeClient.CoreV1().Namespaces().List(r.Context(), metav1.ListOptions{})
		if err == nil {
			for _, item := range nsList.Items {
				namespaces = append(namespaces, item.Name)
			}
		}
	}
	if len(namespaces) == 0 {
		namespaces = []string{"default", "argo", "example-a", "example-b"}
	}

	writeJSON(w, InfoResponse{
		ManagedNamespaces: namespaces,
		Links:             []any{},
	})
}

// GetVersion responds with Argo server version string.
func (h *InfoHandler) GetVersion(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	writeJSON(w, VersionResponse{Version: "v3.6.0"})
}

// GetUserInfo responds with user credentials derived from headers.
func (h *InfoHandler) GetUserInfo(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	user := r.Header.Get("X-Forwarded-User")
	if user == "" {
		user = r.Header.Get("Remote-User")
	}
	if user == "" {
		user = "admin"
	}
	email := r.Header.Get("X-Forwarded-Email")
	if email == "" {
		email = r.Header.Get("Remote-Email")
	}
	if email == "" {
		email = "admin@example.com"
	}

	writeJSON(w, UserInfoResponse{
		LoggedIn:           true,
		Username:           user,
		Email:              email,
		ServiceAccountName: "default",
		Roles:              []string{"admin"},
	})
}
