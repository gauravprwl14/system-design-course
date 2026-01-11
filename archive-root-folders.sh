#!/bin/bash

# archive-root-folders.sh
# Script to archive root-level numbered folders and interview-prep to _archive/
# Run this after verifying docs-site contains all content

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_DIR="$SCRIPT_DIR/_archive"

echo "================================================"
echo "System Design Repository Cleanup Script"
echo "================================================"
echo ""
echo "This script will move the following folders to _archive/:"
echo "  - 01-databases through 12-consistency (12 folders)"
echo "  - interview-prep (root level)"
echo ""
echo "⚠️  IMPORTANT: Make sure you have:"
echo "  1. Verified docs-site/ contains all content"
echo "  2. Backed up your repository (git commit or backup)"
echo "  3. Tested docs-site builds successfully (npm run dev)"
echo ""
read -p "Do you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted. No changes made."
    exit 0
fi

echo ""
echo "Creating _archive directory..."
mkdir -p "$ARCHIVE_DIR"

# Array of folders to archive
folders=(
    "01-databases"
    "02-caching"
    "03-queues"
    "04-load-balancing"
    "05-scalability"
    "06-performance"
    "07-patterns"
    "08-case-studies"
    "09-api-design"
    "10-monitoring"
    "11-security"
    "12-consistency"
    "interview-prep"
)

echo ""
echo "Archiving folders..."
echo ""

archived_count=0
skipped_count=0

for folder in "${folders[@]}"; do
    source_path="$SCRIPT_DIR/$folder"
    dest_path="$ARCHIVE_DIR/$folder"

    if [ -d "$source_path" ]; then
        echo "📦 Moving $folder..."
        mv "$source_path" "$dest_path"
        archived_count=$((archived_count + 1))
    else
        echo "⚠️  Skipping $folder (not found)"
        skipped_count=$((skipped_count + 1))
    fi
done

echo ""
echo "================================================"
echo "✅ Cleanup Complete!"
echo "================================================"
echo ""
echo "Summary:"
echo "  - Archived: $archived_count folders"
echo "  - Skipped: $skipped_count folders"
echo "  - Archive location: $ARCHIVE_DIR"
echo ""
echo "Next steps:"
echo "  1. Test docs-site: cd docs-site && npm run dev"
echo "  2. Verify all content is accessible"
echo "  3. Commit changes: git add . && git commit -m 'chore: Archive root folders, consolidate to docs-site'"
echo "  4. If everything works, you can delete _archive/ later"
echo ""
echo "To restore archived folders (if needed):"
echo "  mv _archive/* ./"
echo ""
