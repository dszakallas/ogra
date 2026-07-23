{
  description = "OGRA — Modern Argo Workflows Dashboard & Backend";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        frontend = pkgs.buildNpmPackage {
          pname = "ogra-frontend";
          version = "develop";
          src = ./frontend;

          npmDeps = pkgs.importNpmLock {
            npmRoot = ./frontend;
          };

          npmConfigHook = pkgs.importNpmLock.npmConfigHook;

          npmBuildScript = "build";

          dontNpmInstall = true;

          installPhase = ''
            mkdir -p $out
            cp -r dist/* $out/
          '';
        };

        backend = pkgs.buildGoModule {
          pname = "ogra";
          version = "develop";
          src = ./.;

          #+update .#backend.goModules
          vendorHash = "sha256-oBQGb9HzutQ4SaX9OJi7p04wxoMORofSm5BFcaMChi0=";

          proxyVendor = true;

          preBuild = ''
            rm -rf frontend/dist
            mkdir -p frontend/dist
            cp -r ${frontend}/* frontend/dist/
          '';

          subPackages = [ "cmd/server" ];

          postInstall = ''
            mv $out/bin/server $out/bin/ogra
          '';
        };

        dockerImage = pkgs.dockerTools.buildImage {
          name = "ogra";
          tag = "latest";

          copyToRoot = pkgs.buildEnv {
            name = "ogra-image-root";
            paths = [
              backend
              pkgs.cacert
            ];
            pathsToLink = [ "/bin" ];
          };

          config = {
            Entrypoint = [ "/bin/ogra" ];
            ExposedPorts = {
              "8080/tcp" = { };
            };
          };
        };
      in
      {
        packages = {
          default = backend;
          backend = backend;
          frontend = frontend;
        }
        // pkgs.lib.optionalAttrs pkgs.stdenv.isLinux {
          dockerImage = dockerImage;
        };
      }
    );
}
