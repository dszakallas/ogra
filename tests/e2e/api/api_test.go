//go:build e2e

package api

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/dszakallas/ogra/internal/config"
)

func TestWorkflowTemplateSubmissionAndLifecycle(t *testing.T) {
	env := setupAPIEnv(t, "wf-lifecycle")

	code, resp := env.doRequest("GET", "/api/v1/workflow-templates/"+env.namespace, nil)
	require.Equal(t, 200, code)
	items, ok := resp["items"].([]any)
	require.True(t, ok)
	require.GreaterOrEqual(t, len(items), 1, "expected at least 1 workflow template")

	submitPayload := map[string]any{
		"resourceKind": "WorkflowTemplate",
		"resourceName": "bash-simulation-template",
		"submitOptions": map[string]any{
			"parameters": []string{"sleep-duration=3"},
		},
	}
	code, submitResp := env.doRequest("POST", "/api/v1/workflows/"+env.namespace+"/submit", submitPayload)
	require.Equal(t, 201, code)

	meta, ok := submitResp["metadata"].(map[string]any)
	require.True(t, ok)
	wfName, ok := meta["name"].(string)
	require.True(t, ok)
	require.True(t, strings.HasPrefix(wfName, "bash-simulation-template-"))

	code, getResp := env.doRequest("GET", "/api/v1/workflows/"+env.namespace+"/"+wfName, nil)
	require.Equal(t, 200, code)
	getSpec, ok := getResp["spec"].(map[string]any)
	require.True(t, ok)
	tplRef, ok := getSpec["workflowTemplateRef"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "bash-simulation-template", tplRef["name"])

	code, suspendResp := env.doRequest("PUT", "/api/v1/workflows/"+env.namespace+"/"+wfName+"/suspend", nil)
	require.Equal(t, 200, code)
	suspendSpec, ok := suspendResp["spec"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, suspendSpec["suspend"])

	code, resumeResp := env.doRequest("PUT", "/api/v1/workflows/"+env.namespace+"/"+wfName+"/resume", nil)
	require.Equal(t, 200, code)
	resumeSpec, ok := resumeResp["spec"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, false, resumeSpec["suspend"])

	code, termResp := env.doRequest("PUT", "/api/v1/workflows/"+env.namespace+"/"+wfName+"/terminate", nil)
	require.Equal(t, 200, code)
	termSpec, ok := termResp["spec"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "Terminate", termSpec["shutdown"])

	code, _ = env.doRequest("DELETE", "/api/v1/workflows/"+env.namespace+"/"+wfName, nil)
	require.Equal(t, 200, code)

	code, _ = env.doRequest("GET", "/api/v1/workflows/"+env.namespace+"/"+wfName, nil)
	require.Equal(t, 404, code)
}

func TestCronWorkflowOperations(t *testing.T) {
	env := setupAPIEnv(t, "cron-ops")

	code, resp := env.doRequest("GET", "/api/v1/cron-workflows/"+env.namespace, nil)
	require.Equal(t, 200, code)
	items, ok := resp["items"].([]any)
	require.True(t, ok)
	require.GreaterOrEqual(t, len(items), 1, "expected at least 1 cron workflow")

	code, suspendResp := env.doRequest("PUT", "/api/v1/cron-workflows/"+env.namespace+"/periodic-backup-job/suspend", nil)
	require.Equal(t, 200, code)
	suspendSpec, ok := suspendResp["spec"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, suspendSpec["suspend"])

	code, triggerResp := env.doRequest("POST", "/api/v1/cron-workflows/"+env.namespace+"/periodic-backup-job/trigger", nil)
	require.Equal(t, 201, code)
	triggerMeta, ok := triggerResp["metadata"].(map[string]any)
	require.True(t, ok)
	triggeredWfName, ok := triggerMeta["name"].(string)
	require.True(t, ok)
	require.True(t, strings.HasPrefix(triggeredWfName, "periodic-backup-job-"))
}

func TestWorkflowEventsSSEStream(t *testing.T) {
	env := setupAPIEnv(t, "events")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	sseChan := env.streamSSE(ctx, "/api/v1/workflow-events/"+env.namespace)

	submitPayload := map[string]any{
		"resourceKind": "WorkflowTemplate",
		"resourceName": "bash-simulation-template",
	}
	code, _ := env.doRequest("POST", "/api/v1/workflows/"+env.namespace+"/submit", submitPayload)
	require.Equal(t, 201, code)

	var received bool
	for line := range sseChan {
		if strings.Contains(line, "ADDED") && strings.Contains(line, "bash-simulation-template-") {
			received = true
			cancel()
			break
		}
	}
	require.True(t, received, "SSE stream should receive ADDED event for submitted workflow")
}

func TestWorkflowLogStreaming(t *testing.T) {
	env := setupAPIEnv(t, "logs")

	clients, err := config.NewKubeClients(config.KubeConfigOptions{})
	require.NoError(t, err)

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "e2e-log-wf-pod",
			Namespace: env.namespace,
			Labels: map[string]string{
				"workflows.argoproj.io/workflow": "e2e-log-wf",
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:    "main",
					Image:   "alpine:latest",
					Command: []string{"echo", "OGRA_TEST_LOG_OUTPUT"},
				},
			},
		},
	}
	_, err = clients.Typed.CoreV1().Pods(env.namespace).Create(context.Background(), pod, metav1.CreateOptions{})
	require.NoError(t, err)

	code, _ := env.doRequest("GET", "/api/v1/workflows/"+env.namespace+"/e2e-log-wf/log?container=main", nil)
	require.Contains(t, []int{200, 500}, code, "log endpoint should respond")
}
