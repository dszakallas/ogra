{
  pkgs,
  lib,
  config,
  inputs,
  ...
}@args:
{
  imports = [
    inputs.dotfiles-common.devenvModules.recommended
  ];

  profiles = {
    kind.module = import ./profiles/kind.nix args;
    agents.module = import ./profiles/agents args;
  };

  packages = [
    pkgs.go
    pkgs.golangci-lint
    pkgs.gofumpt
    pkgs.nodejs_24
    pkgs.playwright-driver
    (pkgs.python3.withPackages (ps: [ ps.pyyaml ]))
  ];

  languages.go.enable = true;
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
  };

  git-hooks.hooks = {
    golangci-lint.enable = true;
    gofmt.enable = true;

    # TypeScript typechecking
    tsc = {
      enable = true;
      name = "TypeScript Type Check";
      entry = "npm --prefix frontend run tsc";
      files = "\\.(ts|tsx)$";
      pass_filenames = false;
    };

    # ESLint checking
    eslint = {
      enable = true;
      name = "ESLint React/TypeScript Linter";
      entry = "npm --prefix frontend run lint";
      files = "\\.(js|jsx|ts|tsx)$";
      pass_filenames = false;
    };

    # Auto-generated code correctness
    gen-api-types-check = {
      enable = true;
      name = "Generated API Code Up-to-Date Check";
      entry = ''
        python3 scripts/gen-api-types.py
        git diff --exit-code -- api/openapi.json internal/api/ frontend/src/types/generated/
      '';
      files = "^api/crds/.*\\.yaml$";
      pass_filenames = false;
    };

    # Auto-update Nix derivation hashes
    update-nix-hashes = {
      enable = true;
      name = "Update Nix Hashes";
      entry = "./scripts/update-nix-hashes.sh";
      language = "system";
      files = "(\\.nix|go\\.mod|go\\.sum)$";
      pass_filenames = true;
    };
  };

  env = {
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
  };

  enterShell = ''
    export NODE_PATH="${config.devenv.root}/frontend/node_modules:$NODE_PATH"
    CHROMIUM_BIN="$(find -L "${pkgs.playwright-driver.browsers}" -name chrome-headless-shell -type f -print -quit)"
    export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROMIUM_BIN"
    export PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH="$CHROMIUM_BIN"
  '';

  scripts.backend = {
    exec = ''
      go run ./cmd/server
    '';
    description = "Start the Go backend server";
  };

  processes.backend = {
    exec = "backend";
    cwd = ".";
    ports.http.allocate = 8080;
    env = {
      PORT = "${toString config.processes.backend.ports.http.value}";
    };
  };

  scripts.frontend = {
    exec = ''
      cd "${config.devenv.root}/frontend"
      npm run dev
    '';
    description = "Start the React frontend development server";
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

  scripts.gen-api-types = {
    exec = ''
      python3 "${config.devenv.root}/scripts/gen-api-types.py" "$@"
    '';
    description = "Regenerate Go and TypeScript API types from Argo CRDs/OpenAPI schemas";
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

  tasks."api-test:run" = {
    exec = ''
      api-test -p "${toString config.processes.backend.ports.http.value}"
    '';
    after = [ "devenv:processes:backend" ];
  };

  tasks."ui-test:run" = {
    exec = ''
      ui-test -p "${toString config.processes.frontend.ports.http.value}"
    '';
    after = [
      "devenv:processes:backend"
      "devenv:processes:frontend"
    ];
  };
}
