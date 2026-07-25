{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:
{
  env.KUBECONFIG = "${config.devenv.root}/.kube/kind-config.yaml";

  packages = [
    pkgs.kind
    pkgs.kubectl
    pkgs.kustomize
  ];

  tasks = {
    "kind:cluster" = {
      exec = ''
        mkdir -p "${config.devenv.root}/.kube"
        if ! kubectl get nodes --kubeconfig "${config.devenv.root}/.kube/kind-config.yaml" >/dev/null 2>&1; then
          echo "[INFO] Creating kind cluster 'ogra-cluster'..."
          kind create cluster --name ogra-cluster --kubeconfig "${config.devenv.root}/.kube/kind-config.yaml" || true
          kind get kubeconfig --name ogra-cluster > "${config.devenv.root}/.kube/kind-config.yaml"
        else
          echo "[INFO] Kind cluster 'ogra-cluster' is running and reachable."
          kind get kubeconfig --name ogra-cluster > "${config.devenv.root}/.kube/kind-config.yaml" 2>/dev/null || true
        fi
        kubectl config use-context kind-ogra-cluster --kubeconfig "${config.devenv.root}/.kube/kind-config.yaml" 2>/dev/null || true
      '';
      before = [ "devenv:enterShell" ];
    };

    "kind:argo-install" = {
      exec = ''
        export KUBECONFIG="${config.devenv.root}/.kube/kind-config.yaml"
        echo "[INFO] Applying Argo Workflows manifests and CRDs to kind cluster using server-side apply..."
        kubectl create namespace argo --dry-run=client -o yaml | kubectl apply -f -
        kubectl apply --server-side --force-conflicts -f "${config.devenv.root}/api/crds"
        kubectl apply --server-side --force-conflicts -n argo -f "${config.devenv.root}/k8s/releases/argo-workflows/install.yaml"
      '';
      after = [ "kind:cluster" ];
      before = [ "devenv:enterShell" ];
    };

    "kind:example-workflows" = {
      exec = ''
        export KUBECONFIG="${config.devenv.root}/.kube/kind-config.yaml"
        echo "[INFO] Setting up example namespaces, roles, and WorkflowTemplates..."

        kubectl create namespace example-a --dry-run=client -o yaml | kubectl apply -f -
        kubectl create namespace example-b --dry-run=client -o yaml | kubectl apply -f -

        kubectl apply -n example-a -f "${config.devenv.root}/k8s/roles/roles.yaml"
        kubectl apply -n example-b -f "${config.devenv.root}/k8s/roles/roles.yaml"

        kubectl apply -f "${config.devenv.root}/k8s/examples/workflow-template-bash.yaml"
        kubectl apply -f "${config.devenv.root}/k8s/examples/workflow-template-python.yaml"
        kubectl apply -f "${config.devenv.root}/k8s/examples/cron-workflow-backup.yaml"
      '';
      after = [ "kind:argo-install" ];
      before = [ "devenv:enterShell" ];
    };
  };
}
