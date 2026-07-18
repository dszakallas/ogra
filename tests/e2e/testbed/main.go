// Command testbed provides setup and teardown of isolated Kubernetes test environments for E2E testing.
package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/yaml"

	"github.com/dszakallas/kolobok/ogra/internal/config"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "setup":
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "usage: testbed setup <fixture>")
			os.Exit(1)
		}
		ns, err := runSetup(os.Args[2])
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		fmt.Print(ns)
	case "teardown":
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "usage: testbed teardown <namespace>")
			os.Exit(1)
		}
		if err := runTeardown(os.Args[2]); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
	case "gc":
		olderThan := 15 * time.Minute
		if len(os.Args) >= 3 {
			if d, err := time.ParseDuration(os.Args[2]); err == nil {
				olderThan = d
			}
		}
		if err := runGC(olderThan); err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Fprintln(os.Stderr, "usage: testbed <command> [args]")
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "commands:")
	fmt.Fprintln(os.Stderr, "  setup <fixture>       Create namespace and apply fixtures")
	fmt.Fprintln(os.Stderr, "  teardown <namespace> Delete a namespace")
	fmt.Fprintln(os.Stderr, "  gc [duration]        Clean up test namespaces older than duration (default 15m)")
}

func runSetup(fixture string) (string, error) {
	_ = runGC(15 * time.Minute)

	projectRoot, err := findProjectRoot()
	if err != nil {
		return "", err
	}

	clients, err := config.NewKubeClients(config.KubeConfigOptions{})
	if err != nil {
		return "", fmt.Errorf("kubernetes client: %w", err)
	}

	nsName := fmt.Sprintf("e2e-%s-%d", strings.ToLower(fixture), time.Now().UnixNano()%100000000)
	ctx := context.Background()

	_, err = clients.Typed.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: nsName,
			Labels: map[string]string{
				"ogra-e2e-test": "true",
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("create namespace: %w", err)
	}

	rolesPath := filepath.Join(projectRoot, "k8s", "roles", "roles.yaml")
	if err := applyYAMLFile(clients, nsName, rolesPath); err != nil {
		return "", fmt.Errorf("apply roles: %w", err)
	}

	examplesDir := filepath.Join(projectRoot, "k8s", "examples")
	entries, err := os.ReadDir(examplesDir)
	if err != nil {
		return "", fmt.Errorf("read examples dir: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".yaml") {
			continue
		}
		fixturePath := filepath.Join(examplesDir, entry.Name())
		if err := applyYAMLFile(clients, nsName, fixturePath); err != nil {
			return "", fmt.Errorf("apply %s: %w", entry.Name(), err)
		}
	}

	return nsName, nil
}

func runTeardown(namespace string) error {
	clients, err := config.NewKubeClients(config.KubeConfigOptions{})
	if err != nil {
		return fmt.Errorf("kubernetes client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err = clients.Typed.CoreV1().Namespaces().Delete(ctx, namespace, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("delete namespace %s: %w", namespace, err)
	}
	return nil
}

func findProjectRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			if _, err := os.Stat(filepath.Join(dir, "k8s", "examples")); err == nil {
				return dir, nil
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not find project root (looked for go.mod + k8s/examples)")
		}
		dir = parent
	}
}

var namespaceRegex = regexp.MustCompile(`namespace:\s*["']?[a-zA-Z0-9_-]+["']?`)

func applyYAMLFile(clients *config.KubeClients, namespace, filePath string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	content := namespaceRegex.ReplaceAllString(string(data), fmt.Sprintf("namespace: %s", namespace))
	return applyYAMLContent(clients, namespace, content)
}

func applyYAMLContent(clients *config.KubeClients, namespace, content string) error {
	decoder := yaml.NewYAMLOrJSONDecoder(bytes.NewBufferString(content), 4096)
	ctx := context.Background()

	for {
		var raw map[string]any
		err := decoder.Decode(&raw)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil || len(raw) == 0 {
			continue
		}

		u := &unstructured.Unstructured{Object: raw}
		u.SetNamespace(namespace)

		gvk := u.GroupVersionKind()
		resource := guessPluralResource(gvk.Kind)

		gvr := schema.GroupVersionResource{
			Group:    gvk.Group,
			Version:  gvk.Version,
			Resource: resource,
		}

		_, err = clients.Dynamic.Resource(gvr).Namespace(namespace).Create(ctx, u, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("create %s/%s in %s: %w", gvk.Kind, u.GetName(), namespace, err)
		}
	}
	return nil
}

func guessPluralResource(kind string) string {
	lower := strings.ToLower(kind)
	switch {
	case strings.HasSuffix(lower, "ss"):
		return lower + "es"
	case strings.HasSuffix(lower, "y"):
		return strings.TrimSuffix(lower, "y") + "ies"
	default:
		return lower + "s"
	}
}

func runGC(olderThan time.Duration) error {
	clients, err := config.NewKubeClients(config.KubeConfigOptions{})
	if err != nil {
		return fmt.Errorf("kubernetes client: %w", err)
	}

	ctx := context.Background()
	namespaces, err := clients.Typed.CoreV1().Namespaces().List(ctx, metav1.ListOptions{
		LabelSelector: "ogra-e2e-test=true",
	})
	if err != nil {
		return fmt.Errorf("list test namespaces: %w", err)
	}

	cutoff := time.Now().Add(-olderThan)
	for _, ns := range namespaces.Items {
		if ns.CreationTimestamp.Time.Before(cutoff) {
			_ = clients.Typed.CoreV1().Namespaces().Delete(ctx, ns.Name, metav1.DeleteOptions{})
		}
	}
	return nil
}
