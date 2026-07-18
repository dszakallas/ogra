// Package config handles Kubernetes client configuration and initialization.
package config

import (
	"fmt"
	"os"
	"path/filepath"

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
