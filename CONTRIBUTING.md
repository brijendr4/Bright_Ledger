# Contributing to Bright Ledger

Thanks for helping improve Bright Ledger. This guide describes a lightweight team workflow that keeps `main` stable while letting frontend, backend, and blockchain work proceed in parallel.

## Before you start

1. Create or join the team's GitHub repository.
2. Read the project overview and local setup in [`README.md`](README.md).
3. Check existing issues and pull requests before starting duplicate work.
4. For a significant change, agree on its scope in an issue before implementation.

## Branch strategy

Use `main` as the protected, releasable integration branch. Create short-lived branches from the latest `main`; merge through pull requests and delete feature branches after merge.

| Change | Branch example |
| --- | --- |
| New feature | `feat/market-filters` |
| Bug fix | `fix/trade-reservation` |
| Documentation | `docs/local-setup` |
| Maintenance | `chore/refresh-dependencies` |

Keep branches focused and small. Avoid long-lived `develop` branches for this team-sized product unless release coordination later makes one necessary. Do not commit directly to `main`, and do not force-push shared branches.

## Pull request workflow

1. Update your local `main`, then branch from it:

   ```sh
   git switch main
   git pull --ff-only origin main
   git switch -c feat/short-description
   ```

2. Make focused commits with clear messages, for example `feat: add service-area filters`.
3. Before opening a PR, run the relevant checks:

   ```sh
   npm run lint
   npm run build
   npm run test:backend
   npm run chain:test
   ```

4. Push your branch and open a PR into `main`:

   ```sh
   git push -u origin feat/short-description
   ```

5. Describe the problem, solution, test results, screenshots for UI changes, database migration impact, and any configuration changes. Request at least one teammate review.
6. Address review feedback, wait for required checks, then squash-merge the PR. Delete the branch after merge.

For urgent production fixes, use `fix/...`, review and test the same way, and merge promptly. Tag releases from `main` when release tracking is needed.

## GitHub repository setup

The project folder may not yet have a Git remote configured. Create an **empty** repository on GitHub (do not initialize a second README or license there), then from the project root:

```sh
git init
git add .
git status
```

Review `git status` carefully. Confirm `.env`, credentials, `node_modules`, build output, and local artifacts are not staged. Then make and push the initial commit:

```sh
git commit -m "chore: initialize Bright Ledger repository"
git branch -M main
git remote add origin https://github.com/<your-team>/<your-repository>.git
git push -u origin main
```

Replace the GitHub URL with your team's repository. Use a GitHub organization when the project belongs to a team; grant members the least permissions they need.

In **Settings → Rules → Rulesets** (or branch protection rules), protect `main`: require pull requests, at least one approval, passing status checks, and conversation resolution; block force pushes and deletion. Enable the `Bright Ledger CI` workflow as a required check after its first run.

## Engineering expectations

- Keep credentials and private keys out of source control. Use local `.env` files or GitHub/hosting secret stores.
- Add a numbered SQL migration for schema changes; do not silently edit migrations already applied to shared databases.
- Preserve API validation, authorization, and transaction boundaries when changing backend routes.
- Add or update tests for changed matching rules, API behavior, and contract state transitions.
- Treat meter readings, delivery, payments, and environmental outcomes as unverified unless there is an explicit trusted integration and documented method.
- Update documentation when developer commands, API configuration, schema, or user workflows change.

## Useful commands

```sh
docker compose up --build  # Full local application stack
docker compose down        # Stop stack; preserve data volumes
npm run lint
npm run build
npm run test:backend
npm run chain:test
```
