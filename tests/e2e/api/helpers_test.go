//go:build e2e

package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/dszakallas/kolobok/ogra/internal/config"
	"github.com/dszakallas/kolobok/ogra/internal/handler"
)

type apiEnv struct {
	namespace string
	server    *httptest.Server
	client    *http.Client
}

func setupAPIEnv(t *testing.T, fixture string) *apiEnv {
	t.Helper()

	ns, err := testbedSetup(fixture)
	require.NoError(t, err, "testbed setup")

	t.Cleanup(func() {
		_ = testbedTeardown(ns)
	})

	clients, err := config.NewKubeClients(config.KubeConfigOptions{})
	require.NoError(t, err)

	mux := buildMux(clients)
	server := httptest.NewServer(mux)
	t.Cleanup(func() { server.Close() })

	return &apiEnv{
		namespace: ns,
		server:    server,
		client:    server.Client(),
	}
}

func testbedSetup(fixture string) (string, error) {
	cmd := exec.CommandContext(context.Background(), "testbed", "setup", fixture)
	out, err := cmd.Output()
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			return "", fmt.Errorf("testbed setup failed: %s", string(ee.Stderr))
		}
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func testbedTeardown(namespace string) error {
	cmd := exec.CommandContext(context.Background(), "testbed", "teardown", namespace)
	return cmd.Run()
}

func buildMux(clients *config.KubeClients) *http.ServeMux {
	mux := http.NewServeMux()
	infoH := handler.NewInfoHandler(clients.Typed)
	wfH := handler.NewWorkflowHandler(clients.Dynamic)
	wfTplH := handler.NewWorkflowTemplateHandler(clients.Dynamic)
	cronH := handler.NewCronWorkflowHandler(clients.Dynamic)
	eventsH := handler.NewEventsHandler(clients.Dynamic)
	logsH := handler.NewLogsHandler(clients.Typed)

	mux.HandleFunc("/api/v1/info", infoH.GetInfo)
	mux.HandleFunc("/api/v1/version", infoH.GetVersion)
	mux.HandleFunc("/api/v1/userinfo", infoH.GetUserInfo)

	mux.HandleFunc("/api/v1/workflows/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/workflows/")
		parts := strings.Split(path, "/")

		if len(parts) == 1 && parts[0] != "" {
			wfH.ListWorkflows(w, r, parts[0])
			return
		}
		if len(parts) == 2 && parts[1] == "submit" {
			wfH.SubmitWorkflow(w, r, parts[0])
			return
		}
		if len(parts) == 2 && parts[1] != "" {
			if r.Method == http.MethodDelete {
				wfH.DeleteWorkflow(w, r, parts[0], parts[1])
			} else {
				wfH.GetWorkflow(w, r, parts[0], parts[1])
			}
			return
		}
		if len(parts) == 3 {
			ns, name, action := parts[0], parts[1], parts[2]
			if action == "log" {
				logsH.StreamWorkflowLogs(w, r, ns, name)
				return
			}
			wfH.PatchWorkflowAction(w, r, ns, name, action)
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/api/v1/workflow-templates/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/workflow-templates/")
		parts := strings.Split(path, "/")
		if len(parts) == 1 && parts[0] != "" {
			wfTplH.ListWorkflowTemplates(w, r, parts[0])
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/api/v1/cron-workflows/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/cron-workflows/")
		parts := strings.Split(path, "/")
		if len(parts) == 1 && parts[0] != "" {
			cronH.ListCronWorkflows(w, r, parts[0])
			return
		}
		if len(parts) == 2 && parts[1] != "" {
			cronH.GetCronWorkflow(w, r, parts[0], parts[1])
			return
		}
		if len(parts) == 3 {
			ns, name, action := parts[0], parts[1], parts[2]
			if action == "suspend" {
				cronH.ToggleSuspend(w, r, ns, name, true)
				return
			}
			if action == "resume" {
				cronH.ToggleSuspend(w, r, ns, name, false)
				return
			}
			if action == "trigger" {
				cronH.TriggerCronWorkflow(w, r, ns, name)
				return
			}
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/api/v1/workflow-events/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/workflow-events/")
		eventsH.StreamWorkflowEvents(w, r, path)
	})

	return mux
}

func (e *apiEnv) doRequest(method, path string, body any) (int, map[string]any) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			panic(err)
		}
		reqBody = bytes.NewBuffer(b)
	}

	req, err := http.NewRequestWithContext(context.Background(), method, e.server.URL+path, reqBody)
	if err != nil {
		panic(err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.client.Do(req)
	if err != nil {
		panic(err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	var result map[string]any
	if resp.StatusCode != http.StatusNoContent {
		_ = json.NewDecoder(resp.Body).Decode(&result)
	}
	return resp.StatusCode, result
}

func (e *apiEnv) streamSSE(ctx context.Context, path string) <-chan string {
	ch := make(chan string, 100)
	go func() {
		defer close(ch)
		req, err := http.NewRequestWithContext(ctx, "GET", e.server.URL+path, nil)
		if err != nil {
			return
		}
		resp, err := e.client.Do(req)
		if err != nil {
			return
		}
		defer func() {
			_ = resp.Body.Close()
		}()
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			select {
			case <-ctx.Done():
				return
			case ch <- scanner.Text():
			}
		}
	}()
	return ch
}
