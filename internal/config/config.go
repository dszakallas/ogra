// Package config handles Kubernetes client configuration and initialization.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

// KubeConfigOptions holds parameters for connecting to a Kubernetes cluster.
type KubeConfigOptions struct {
	Kubeconfig string
	Context    string
	APIServer  string
}

// ServerConfig holds namespace scoping and server runtime settings matching Argo Workflows options.
type ServerConfig struct {
	Namespaced        bool
	ManagedNamespaces []string
}

// GetPodNamespace returns the pod's serviceaccount namespace or fallback "default".
func GetPodNamespace() string {
	if ns := os.Getenv("POD_NAMESPACE"); ns != "" {
		return ns
	}
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

// NewServerConfig initializes ServerConfig from flags/env vars matching Argo Workflows options.
func NewServerConfig(namespacedFlag bool, managedNsFlag string) *ServerConfig {
	namespaced := namespacedFlag
	if !namespaced {
		envVal := strings.ToLower(os.Getenv("NAMESPACED"))
		if envVal == "true" || envVal == "1" {
			namespaced = true
		}
	}

	managedStr := managedNsFlag
	if managedStr == "" {
		managedStr = os.Getenv("MANAGED_NAMESPACE")
	}

	var managedNamespaces []string
	if managedStr != "" {
		parts := strings.Split(managedStr, ",")
		for _, p := range parts {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				managedNamespaces = append(managedNamespaces, trimmed)
			}
		}
	}

	if len(managedNamespaces) == 0 {
		managedNamespaces = []string{GetPodNamespace()}
	}

	return &ServerConfig{
		Namespaced:        namespaced,
		ManagedNamespaces: managedNamespaces,
	}
}

// KubeClients holds typed and dynamic Kubernetes clients and active connection metadata.
type KubeClients struct {
	Typed         kubernetes.Interface
	Dynamic       dynamic.Interface
	ActiveContext string
	Host          string
}

// NewKubeClients loads Kubernetes config using specified options, falling back to $KUBECONFIG or default paths.
func NewKubeClients(opts KubeConfigOptions) (*KubeClients, error) {
	var cfg *rest.Config
	var err error
	var activeContext string

	kubeconfigPath := opts.Kubeconfig
	if kubeconfigPath == "" {
		kubeconfigPath = os.Getenv("KUBECONFIG")
	}

	contextName := opts.Context
	if contextName == "" {
		contextName = os.Getenv("KUBE_CONTEXT")
	}

	apiServer := opts.APIServer
	if apiServer == "" {
		apiServer = os.Getenv("KUBE_API_SERVER")
	}

	if kubeconfigPath != "" || contextName != "" || apiServer != "" {
		loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
		if kubeconfigPath != "" {
			loadingRules.ExplicitPath = kubeconfigPath
		}

		configOverrides := &clientcmd.ConfigOverrides{}
		if contextName != "" {
			configOverrides.CurrentContext = contextName
		}
		if apiServer != "" {
			configOverrides.ClusterInfo.Server = apiServer
		}

		clientConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
		cfg, err = clientConfig.ClientConfig()
		if err == nil {
			rawConfig, rawErr := clientConfig.RawConfig()
			if rawErr == nil {
				activeContext = rawConfig.CurrentContext
			}
		}
	}

	if cfg == nil && homedir.HomeDir() != "" {
		defaultPath := filepath.Join(homedir.HomeDir(), ".kube", "config")
		cfg, err = clientcmd.BuildConfigFromFlags("", defaultPath)
		if err == nil {
			activeContext = "default (~/.kube/config)"
		}
	}

	if cfg == nil {
		cfg, err = rest.InClusterConfig()
		if err != nil {
			return nil, fmt.Errorf("failed to load kubeconfig (path=%q, context=%q): %w", kubeconfigPath, contextName, err)
		}
		activeContext = "in-cluster"
	}

	cfg.QPS = 50
	cfg.Burst = 100

	typedClient, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	dynClient, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	return &KubeClients{
		Typed:         typedClient,
		Dynamic:       dynClient,
		ActiveContext: activeContext,
		Host:          cfg.Host,
	}, nil
}
