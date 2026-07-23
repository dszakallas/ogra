#!/usr/bin/env bash
set -euo pipefail

# This script scans specified .nix files for '#+update-hash-next-line <attribute>' or '#+update <attribute>' comments.
# For each found comment, it builds the specified Nix attribute, extracts the correct
# hash on mismatch, and updates the hash on the following line.

echo "Analyzing file arguments for Nix hash update markers..."

# Determine files to scan
nix_files=()
scan_all_nix=false

if [ $# -eq 0 ]; then
  scan_all_nix=true
else
  for arg in "$@"; do
    if [[ "$arg" =~ \.nix$ ]]; then
      nix_files+=("$arg")
    elif [[ "$arg" =~ go\.(mod|sum)$ ]]; then
      scan_all_nix=true
    fi
  done
fi

if $scan_all_nix; then
  # Find all .nix files in the repository (excluding hidden directories)
  while IFS= read -r -d '' file; do
    # Add to nix_files if not already present
    already_added=false
    for existing in "${nix_files[@]}"; do
      if [[ "$existing" == "$file" ]]; then
        already_added=true
        break
      fi
    done
    if ! $already_added; then
      nix_files+=("$file")
    fi
  done < <(find . -name "*.nix" -not -path '*/.*' -print0)
fi

if [ ${#nix_files[@]} -eq 0 ]; then
  echo "No Nix files to check."
  exit 0
fi

updated_any=false

for file in "${nix_files[@]}"; do
  if [ ! -f "$file" ]; then
    continue
  fi

  # Read file line by line into an array
  mapfile -t lines < "$file"
  
  modified=false
  len=${#lines[@]}
  
  for ((i=0; i<len; i++)); do
    line="${lines[i]}"
    # Match pattern: #+update-hash-next-line <attribute> or #+update <attribute>
    if [[ "$line" =~ ^[[:space:]]*#[[:space:]]*\+(update-hash-next-line|update)[[:space:]]+([^[:space:]]+) ]]; then
      attr="${BASH_REMATCH[2]}"
      next_idx=$((i + 1))
      
      if (( next_idx >= len )); then
        echo "Warning: marker at end of file in $file" >&2
        continue
      fi
      
      next_line="${lines[next_idx]}"
      # Validate next line structure: key = "value";
      if [[ "$next_line" =~ ^([[:space:]]*[^[[:space:]=]+[[:space:]]*=[[:space:]]*\")[^\"]*(\";.*)$ ]]; then
        prefix="${BASH_REMATCH[1]}"
        suffix="${BASH_REMATCH[2]}"
        
        echo "Checking hash for attribute '$attr' in $file..."
        
        # Replace the current value with a dummy fake hash to trigger mismatch
        lines[next_idx]="${prefix}sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=${suffix}"
        
        # Write temporarily to disk so nix build reads the dummy hash
        printf "%s\n" "${lines[@]}" > "$file"
        
        # Run nix build and capture error output
        BUILD_OUTPUT=$(nix build "$attr" --extra-experimental-features "nix-command flakes" 2>&1 || true)
        NEW_HASH=$(echo "$BUILD_OUTPUT" | grep -oE "got:[[:space:]]+sha256-[a-zA-Z0-9/+=]{44}" | awk '{print $2}')
        
        if [ -n "$NEW_HASH" ]; then
          echo "Found correct hash: $NEW_HASH"
          lines[next_idx]="${prefix}${NEW_HASH}${suffix}"
          modified=true
          updated_any=true
        else
          echo "No hash mismatch detected or build failed for '$attr'. Restoring original line."
          lines[next_idx]="$next_line"
        fi
      else
        echo "Warning: Line following marker in $file does not match 'key = \"...\";' format: '$next_line'" >&2
      fi
    fi
  done
  
  if $modified; then
    printf "%s\n" "${lines[@]}" > "$file"
    # Format the updated file if nixfmt is available
    if command -v nixfmt >/dev/null 2>&1; then
      nixfmt "$file"
    fi
  fi
done

if $updated_any; then
  echo "Hash updates completed."
else
  echo "No hash updates applied."
fi
