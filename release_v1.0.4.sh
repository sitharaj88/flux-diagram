#!/bin/bash
set -e

# 1. Build the project to ensure everything is correct
echo "Building project..."
npm run build

# 2. (Optional) Create the VSIX package
# npm run package

# 3. Create the git tag
VERSION="v1.0.4"
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo "Tag $VERSION already exists locally."
else
    echo "Creating tag $VERSION..."
    git tag -a "$VERSION" -m "Release $VERSION"
fi

# 4. Push changes and tags
echo "Pushing to GitHub..."
git push
git push origin "$VERSION"

echo "✅ Successfully tagged and pushed $VERSION to GitHub."
