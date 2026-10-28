{
  pkgs,
  lib,
  inputs,
  ...
}:
{ config, ... }:
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
        kubectl apply -f "${config.devenv.root}/k8s/examples/cluster-workflow-template-whalesay.yaml"
        kubectl apply -f "${config.devenv.root}/k8s/examples/cron-workflow-backup.yaml"
      '';
      after = [ "kind:argo-install" ];
      before = [
        "devenv:enterShell"
        "devenv:processes:backend"
      ];
    };

    "api-test:run" = {
      exec = ''
        api-test -p "${toString config.processes.backend.ports.http.value}"
      '';
      after = [ "devenv:processes:backend" ];
    };

    "ui-test:run" = {
      exec = ''
        ui-test -p "${toString config.processes.frontend.ports.http.value}"
      '';
      after = [
        "devenv:processes:backend"
        "devenv:processes:frontend"
      ];
    };
  };

  processes.backend = {
    exec = "backend";
    cwd = ".";
    ports.http.allocate = 8080;
    env = {
      PORT = "${toString config.processes.backend.ports.http.value}";
    };
  };

  processes.frontend = {
    exec = "frontend";
    cwd = ".";
    ports.http.allocate = 3000;
    env = {
      PORT = "${toString config.processes.frontend.ports.http.value}";
      VITE_BACKEND_PORT = "${toString config.processes.backend.ports.http.value}";
    };
  };

  scripts.testbed = {
    exec = ''
      cd "${config.devenv.root}"
      exec go run ./tests/e2e/testbed "$@"
    '';
    description = "Manage Kubernetes E2E test environments and fixtures";
  };

  scripts.ui-test = {
    exec = ''
      cd "${config.devenv.root}/frontend"
      PORT="${toString config.processes.frontend.ports.http.value}"
      while getopts "p:" opt; do
        case "$opt" in
          p) PORT="$OPTARG" ;;
          *) echo "Usage: ui-test [-p port] [playwright args...]" >&2; exit 1 ;;
        esac
      done
      shift $((OPTIND-1))
      export UI_BASE_URL="http://localhost:$PORT"
      exec playwright test "$@"
    '';
    description = "Run Playwright E2E user interface tests";
  };

  scripts.api-test = {
    exec = ''
      cd "${config.devenv.root}"
      PORT="${toString config.processes.backend.ports.http.value}"
      while getopts "p:" opt; do
        case "$opt" in
          p) PORT="$OPTARG" ;;
          *) echo "Usage: api-test [-p port] [go test args...]" >&2; exit 1 ;;
        esac
      done
      shift $((OPTIND-1))
      export TEST_BACKEND_PORT="$PORT"
      exec go test -tags e2e ./tests/e2e/api/ -v "$@"
    '';
    description = "Run Go E2E API tests manually";
  };
}
