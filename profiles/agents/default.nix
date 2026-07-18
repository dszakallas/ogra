{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:
let
  dotfiles-common = inputs.dotfiles-common;
  lib' = dotfiles-common.lib;
  mcpServers = {
    playwright = {
      type = "stdio";
      command = "playwright-mcp";
      env = {
        "PLAYWRIGHT_MCP_USER_DATA_DIR" = "${config.devenv.root}/.playwright/user-data";
        "PLAYWRIGHT_MCP_OUTPUT_DIR" = "${config.devenv.root}/.playwright/output";
        "PLAYWRIGHT_MCP_BROWSER" = "webkit";
      };
    };
  };
in
{
  imports = [
    inputs.dotfiles-common.devenvModules.agents
  ];

  agents = {
    mcp = {
      enable = true;
      servers = mcpServers;
    };
  }
  // lib.genAttrs [ "vscode" "claude" "copilot" "opencode" ] (name: {
    enable = true;
    mcp = {
      enable = true;
      servers = lib'.agents.mcpServersForAgent name mcpServers;
    };
  });
}
