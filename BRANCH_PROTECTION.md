# Branch Protection Setup

To block direct pushes to the `main` branch and enforce code reviews, you need to set up branch protection rules in GitHub. Follow these steps:

## Setting Up Branch Protection

1. Navigate to your GitHub repository
2. Click on the "Settings" tab (near the top right)
3. In the left sidebar, click on "Branches"
4. Under "Branch protection rules", click "Add rule"
5. For "Branch name pattern", enter `main`
6. Enable the following options:
   - ✅ "Require a pull request before merging"
   - ✅ "Require approvals" (optionally set the number of required reviewers)
   - ✅ "Dismiss stale pull request approvals when new commits are pushed"
   - ✅ "Require status checks to pass before merging"
   - ✅ "Require branches to be up to date before merging"
7. Under "Status checks that are required":
   - Search for and select the status checks from your GitHub Actions:
     - `test` (from api-tests.yml)
     - `build` (from build.yml)
8. Optionally, you can also enable:
   - ✅ "Do not allow bypassing the above settings"
   - ✅ "Restrict who can push to matching branches"
9. Click "Create" or "Save changes"

## Testing Your Branch Protection

To test that your branch protection is working:

1. Try to push directly to the main branch:
   ```bash
   git push origin main
   ```
   This should be rejected.

2. Create a new branch, make changes, and submit a PR:
   ```bash
   git checkout -b feature-branch
   # Make changes
   git add .
   git commit -m "Your changes"
   git push origin feature-branch
   ```

3. Go to GitHub and create a PR from your feature branch to main.
   - Verify that the required status checks run
   - Verify that you cannot merge until reviews are complete

## PR-Based Workflow

With these protections in place, your workflow will be:

1. All development happens in feature branches
2. PRs are required to merge changes to main
3. GitHub Actions will run tests on all PRs
4. PRs require code review and passing tests before merging
5. When a PR is merged to main, the deploy workflow will automatically deploy to Railway

This approach ensures code quality and prevents accidental changes to your production branch.