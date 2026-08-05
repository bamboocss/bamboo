# Release Workflow

Follow these steps in order when releasing a new Bamboo CSS version.

## Steps

### 1. Check for an open Version Packages PR

Look for an open PR titled **"Version Packages"** (opened by the Changesets GitHub Action). Only proceed if one is open.

### 2. Pull main

```bash
git pull origin main
```

### 3. Detect the version

Read the version from the Version Packages PR description. All packages are bumped to the same version.

### 4. Read all changeset files NOW

The `.changeset/*.md` files are **deleted when the version PR merges**. Capture their content before merging anything.

```bash
ls .changeset/*.md | grep -v README
```

### 5. Merge the Version Packages PR

```bash
gh pr merge <number> --squash --delete-branch
```

This triggers the npm publish CI workflow and deletes the changeset files.

### 6. Poll until packages are confirmed released

Wait for one of these signals before proceeding:

**Option A — GitHub Actions:** The publish workflow on `main` completes successfully.

```bash
gh run list --branch main --workflow=release.yaml --limit 1
```

**Option B — Git tags:** A tag for a key package at the new version exists.

```bash
git fetch --tags
git tag | grep '@bamboocss/types@<version>'
```

Poll every ~30 seconds. If not confirmed after 10 minutes, stop and investigate.

### 7. Pull main again

```bash
git pull origin main
```

### 8. Create the GitHub Announcements discussion

Open a new discussion in the **Announcements** category with the release notes. Close it immediately after using the
`closeDiscussion` GraphQL mutation (closed announcements still appear pinned in the Discussions tab).

```bash
# Create
gh api graphql -f query='
mutation {
  createDiscussion(input: {
    repositoryId: "R_kgDOHuVHqA"
    categoryId: "DIC_kwDOHuVHqM4CXQ3j"
    title: "Bamboo v<version>"
    body: "..."
  }) {
    discussion { id url }
  }
}'

# Close (use the id returned above)
gh api graphql -f query='
mutation {
  closeDiscussion(input: { discussionId: "<id>" }) {
    discussion { id closed }
  }
}'
```
