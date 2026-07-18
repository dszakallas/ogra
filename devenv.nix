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
    pkgs.pnpm
    pkgs.playwright-driver
    pkgs.playwright-test
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
  };

  env = {
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
  };

  processes.backend = {
    exec = "go run ./cmd/server";
    cwd = ".";
    ports.http.allocate = 8080;
    env = {
      PORT = "${toString config.processes.backend.ports.http.value}";
    };
  };

  processes.frontend = {
    exec = "npm run dev";
    cwd = "./frontend";
    ports.http.allocate = 3000;
    env = {
      PORT = "${toString config.processes.frontend.ports.http.value}";
      VITE_BACKEND_PORT = "${toString config.processes.backend.ports.http.value}";
    };
  };

  scripts.backend.exec = ''
    go run ./cmd/server
  '';

  scripts.frontend.exec = ''
    cd "${config.devenv.root}/frontend"
    npm run dev
  '';

  scripts.testbed.exec = ''
    cd "${config.devenv.root}"
    exec go run ./tests/e2e/testbed "$@"
  '';

  scripts.playwright-test.exec = ''
    cd "${config.devenv.root}/frontend"
    export NODE_PATH="${config.devenv.root}/frontend/node_modules:$NODE_PATH"
    CHROMIUM_BIN="$(find -L "${pkgs.playwright-driver.browsers}" -name chrome-headless-shell -type f -print -quit)"
    export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROMIUM_BIN"
    export PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH="$CHROMIUM_BIN"
    exec playwright test "$@"
  '';

  scripts.gen-api-types.exec = ''
    python3 "${config.devenv.root}/scripts/gen-api-types.py" "$@"
  '';
}
