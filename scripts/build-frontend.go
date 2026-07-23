// Package main provides a build script to compile the frontend assets with caching.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func main() {
	// The script is run from the directory containing the go:generate directive (frontend/)
	if _, err := os.Stat("package.json"); os.IsNotExist(err) {
		fmt.Println("Error: build-frontend must be run from the frontend directory")
		os.Exit(1)
	}

	// Calculate hash of all source files
	hash, err := calculateSourceHash()
	if err != nil {
		fmt.Printf("Error calculating source hash: %v\n", err)
		os.Exit(1)
	}

	// Read existing hash
	hashFile := filepath.Join("dist", ".build-hash")
	existingHashBytes, err := os.ReadFile(hashFile)
	if err == nil && string(existingHashBytes) == hash {
		fmt.Println("Frontend build is up to date (cached).")
		return
	}

	fmt.Println("Frontend sources modified. Running production build...")

	// Run npm run build
	cmd := exec.CommandContext(context.Background(), "npm", "run", "build")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Printf("Error running npm run build: %v\n", err)
		os.Exit(1)
	}

	// Write new hash
	_ = os.MkdirAll("dist", 0o755)
	if err := os.WriteFile(hashFile, []byte(hash), 0o644); err != nil {
		fmt.Printf("Warning: failed to write build hash: %v\n", err)
	}
}

func calculateSourceHash() (string, error) {
	h := sha256.New()

	// List of directories and files to hash
	targets := []string{
		"src",
		"index.html",
		"package.json",
		"package-lock.json",
		"vite.config.ts",
		"tsconfig.json",
		"eslint.config.js",
	}

	for _, target := range targets {
		info, err := os.Stat(target)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return "", err
		}

		if info.IsDir() {
			err = filepath.Walk(target, func(path string, fileInfo os.FileInfo, walkErr error) error {
				if walkErr != nil {
					return walkErr
				}
				if fileInfo.IsDir() {
					return nil
				}
				// Skip temp files or output/log files if any
				if strings.HasSuffix(path, ".swp") || strings.HasPrefix(filepath.Base(path), ".") {
					return nil
				}

				return hashFileContent(h, path)
			})
			if err != nil {
				return "", err
			}
		} else {
			err = hashFileContent(h, target)
			if err != nil {
				return "", err
			}
		}
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

func hashFileContent(h io.Writer, path string) error {
	// Write the path name to include structure changes
	_, _ = io.WriteString(h, path)

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	_, err = io.Copy(h, f)
	return err
}
