{
  buildGoModule,
  fetchFromGitHub,
  lib,
}:
buildGoModule rec {
  pname = "kustomize-plugins";

  version = "0.0.5";

  src = fetchFromGitHub {
    owner = "midiparse";
    repo = "kustomize-plugins";
    rev = "v${version}";
    hash = "sha256-yGduXGlkRfiGfR+ol7mJytSflmIkakM1+nzuOy1gxqg=";
  };

  vendorHash = "sha256-n+lKbSCktXNgqTLSG++AWdItai7jDFGSAJTQs5hC23w=";

  ldflags = [
    "-s"
    "-w"
  ];

  subPackages = [ "./cmd/..." ];

  doCheck = false;
  doInstallCheck = false;

  postInstall = ''
    if [ -d "$out/bin" ]; then
      for f in "$out/bin"/*; do
        [ -e "$f" ] || continue
        base="$(basename "$f")"
        mv "$f" "$out/bin/kustomize-plugin-$base"
      done
    fi
  '';

  meta = {
    license = lib.licenses.mit;
  };
}
