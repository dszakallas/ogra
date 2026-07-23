//go:generate go run ../scripts/build-frontend.go

// Package frontend contains the embedded static files of the WebUI.
package frontend

import "embed"

// DistFS contains the embedded static files from the frontend production build.
//
//go:embed dist
var DistFS embed.FS
