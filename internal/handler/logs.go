package handler

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// LogsHandler handles streaming pod logs for workflows.
type LogsHandler struct {
	kubeClient kubernetes.Interface
}

// NewLogsHandler creates a new LogsHandler.
func NewLogsHandler(kubeClient kubernetes.Interface) *LogsHandler {
	return &LogsHandler{kubeClient: kubeClient}
}

// StreamWorkflowLogs streams container logs for workflow pods using SSEWriter.
func (h *LogsHandler) StreamWorkflowLogs(w http.ResponseWriter, r *http.Request, ns, name string) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	podName := r.URL.Query().Get("podName")
	containerName := r.URL.Query().Get("container")
	if containerName == "" {
		containerName = "main"
	}

	ctx := r.Context()
	if podName == "" {
		labelSelector := fmt.Sprintf("workflows.argoproj.io/workflow=%s", name)
		pods, err := h.kubeClient.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
		if err == nil && len(pods.Items) > 0 {
			podName = pods.Items[0].Name
		}
	}

	if podName == "" {
		http.Error(w, "No pods found for workflow", http.StatusNotFound)
		return
	}

	sse, err := NewSSEWriter(w)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	req := h.kubeClient.CoreV1().Pods(ns).GetLogs(podName, &corev1.PodLogOptions{
		Container:  containerName,
		Follow:     true,
		Timestamps: true,
	})

	stream, err := req.Stream(ctx)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to stream pod logs: %v", err), http.StatusInternalServerError)
		return
	}
	defer func() {
		_ = stream.Close()
	}()

	reader := bufio.NewReader(stream)
	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 {
			content := strings.TrimRight(line, "\n")
			payload := map[string]any{
				"result": map[string]any{
					"content": content,
					"podName": podName,
				},
			}
			_ = sse.Send("message", payload)
		}
		if err != nil {
			if err != io.EOF {
				_ = fmt.Sprintf("Log stream error: %v", err)
			}
			return
		}
	}
}
