# @shivaedev/create-app

Start a Platform application without copying repository files or editing workspace dependencies. One command creates the maintained starter, installs its published dependencies and shows the steps to run it.

## From an empty folder to an app

The starter brings PostgreSQL, authenticated RPC and a React notes screen together in a small application you can change. Its source stays in Platform's `examples/starter`, so the generator carries the same app that the framework maintains.

```sh
pnpm create @shivaedev/app my-app
```

```text
Created my-app.

Next steps:
  cd 'my-app'
  pnpm dev
```

## Create and run

The package contains a snapshot of the starter made when it is packed, without the files under `src/generated` except that folder's README, since a generated app's first install writes them. Platform dependencies use exact versions from the starter's `published-versions.json`; its self-contained pnpm catalog pins the remaining dependencies.

Generated apps start with an empty Quality baseline. Code imports outside libraries directly; `adapters/` holds only what Quality forbids elsewhere because a library requires it.

The generated starter keeps the signed-in screen during unreachable session checks, retries authentication rechecks automatically, and unmounts signed-in routes during sign-out until the session refetch answers.

### Create an app

The folder argument may include a parent path. Its final folder name becomes the package name and must be a lowercase npm name. The destination must be absent or empty, including hidden files. The command runs `pnpm run setup` in the generated app to install dependencies and Quality's pre-commit hook, and reports setup failure with a nonzero exit status. Setup installs the hook only when the app has its own `.git`; it leaves an enclosing repository's hooks alone.

Pass `--minimal` to start with the foundation alone: the same starter without the notes module or its client, server, worker and migration registrations. The default includes the notes example. Starter updates preserve the minimal choice.

The command writes a git-ignored `.env.local` with a fresh authentication secret and local development and test database URLs. Existing files are never overwritten. Database names replace dots and hyphens in the app name with underscores, prefix a name starting with a digit with `app_`, and limit the stem to 58 characters before adding `_dev` and `_test`.

When Git is available and the destination is outside an existing repository, the command initializes a repository before setup and formats the generated files and installed lockfile with `pnpm run format` before committing them. The first commit runs Quality's lint and typecheck gates; a failed gate leaves it uncommitted. It uses your Git identity, with a local commit identity when none is configured. Pass `--no-git` to skip repository creation.

The command also supports `--help` and `--version`.

### What a generated app holds

A generated app gets a README titled with its name, its own framework guidance in `AGENTS.md`, and `CLAUDE.md` linked to that guidance. Its `.env.example` uses the same database names as `.env.local`. Template maintenance documentation and the published-version manifest stay in the source repository. Non-secret application files and the installed lockfile use mode `0644`; `.env.local` uses `0600`.

A generated app includes a GitHub Actions workflow that runs `pnpm run ci` against PostgreSQL and a `.railway/railway.ts` that defines PostgreSQL, builds the web and worker services, runs migrations before deployment, starts both processes and checks `/health` on the web service.

Generated apps reference Quality’s app TypeScript preset, hook setup and CI command, `@shivaedev/build`'s Vite and test configuration, and Platform’s local database and development helpers. Their shared behavior comes from installed packages, so fixes reach existing apps with a dependency update. The app keeps its plugins, paths, environment, migration composition, CI workflow and deployment resources.

Published framework pins live in the generated workspace’s `framework` catalog; manifests reference them with `catalog:framework`. Review that catalog when upgrading framework versions, then run `pnpm install`. A template without a catalog keeps literal exact pins.

### Work in the app

Run `pnpm run setup` after cloning the generated repository to install dependencies and the hook for that checkout. Run `pnpm ready` for the full local gate: lint, typecheck, build and tests, using the same script as CI.

`pnpm dev` first runs `pnpm db:setup` to prepare both databases through `@shivaedev/local-postgres`. Have local PostgreSQL 18.6 on port 55432 or Docker available; see [local-postgres machine setup](https://github.com/ShivaeDev/platform/tree/main/packages/local-postgres#install-and-machine-setup). `pnpm test` loads `TEST_DATABASE_URL` from `.env.local`.

After migrations, `pnpm db:seed` creates local demo owner and user accounts through identity's `defineSeed`. Edit `src/server/seed.ts` to declare personas and the Effect to run as each user. Reruns reuse accounts, and non-local database URLs are refused.

The app selects `story-testing` from `@shivaedev/skills`. Setup syncs the installed instructions to `<app>/.agents/skills/story-testing/`, and `AGENTS.md` links to that local copy. `pnpm lint` rejects edits to managed skills. After changing the skills dependency, run `pnpm skills:sync` and commit the copies and manifest.

### Add a resource

From the generated app directory, run:

```sh
pnpm dlx @shivaedev/create-app resource bookmarks
pnpm format
pnpm migrate
pnpm test src/modules/bookmarks/server/lifecycle.spec.ts
```

The command creates a resource module with an authenticated list query and create command, an account-owned PostgreSQL table, a service, a repository, a bound client and a story kit. The list query declares no `reads`: its repository read filters by the signed-in owner, so an open list listens on that owner's bucket and reruns for the owner's new items and not for another account's. Its generated stories exercise creation, persistence, private lists, live list updates and anonymous refusals through the real application host and PostgreSQL. Both full and minimal apps accept resources; the migration takes the next number across the app's migration folders.

The generated `server/service.ts` declares its `defineRepository` tag and `SessionUser` in `requires`, with `Effect.void` initialization. Its `create.ts` and `list.ts` operations are named `Effect.fn` exports that yield the repository and caller. Handlers pass only operation inputs. The module registers the service in `requestServices` and its repository in `services`. A resource’s single insert commits without `transact`; add a transaction when several writes, such as a write and job enqueue, must commit together.

The resource registers once in the server application's `modules` list in `src/server/modules.ts`. The command expects the starter's `const modules = [...] as const;` declaration and refuses an unsupported list before writing. Existing destination files are named and left intact. Resource names use lowercase letters and digits with optional hyphens; `reading-lists` produces a `reading_lists` table and a `ReadingListsContract` contract.

The generated module has no admin pages or jobs. Add those fields to its server registration when needed. Its browser-safe client is available from `src/modules/bookmarks/client/make.ts`; use it in your own route and screen, following the [resource guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/add-a-feature.md).

### Take starter updates

Run `pnpm dlx @shivaedev/create-app@latest update` in a generated app with a clean app directory in Git to take later starter changes. Apps inside an enclosing repository receive the changes within their own directory; sibling files and unrelated staged changes stay untouched. Only the app directory must be clean. A nonempty starter delta that applies no changes fails without advancing `.create-app.json`. The command reads `.create-app.json`, downloads the recorded generator’s starter and uses Git’s three-way merge to replay its changes against the current starter; app edits survive, deleted files stay deleted, and conflicts are listed and left for you to resolve. Once the starter changes apply, including a merge with conflicts, `.create-app.json` records the current generator version. The command runs `pnpm install` and the app’s `pnpm run typecheck`, lists every non-ignored file with conflict markers and any unresolved Git conflicts, and exits nonzero while those or either check’s failures remain. Resolve the reported problems and rerun install and typecheck before committing. If pnpm reports a trust downgrade, the command preserves the rejected package and version and gives `pnpm update --depth Infinity` to re-resolve transitive dependencies under the existing trust policy; an exact manifest or catalog pin must first be changed to a trusted version. An update adds the admin Users registration and route to an app that lacks them, and lists conflicts where the app customized those parts.

When the starter deletes a file you customized, the command lists its path and leaves a Git modify/delete conflict with your contents intact. Other starter changes still apply, including text conflicts that need resolution, and the generation record advances to the current generator version. Keep the customized file with `git add -- <path>`, or accept the starter’s deletion with `git rm -- <path>`. Resolve any text conflicts, rerun install and typecheck, then review and commit the update.

### Reuse the generator

Generator modules are available through `@shivaedev/create-app/*.ts`. Compose their Effects with your application’s services when you need scaffolding outside the CLI:

```ts
import { packTemplate } from "@shivaedev/create-app/packTemplate.ts";

const template = packTemplate("/path/to/starter", "/path/to/template.json");
```

`packTemplate` reads its filesystem service from the Effect environment. Node integrations need `@effect/platform-node` and `@effect/platform-node-shared`; the CLI bundles them. Test-support files stay outside the published archive.

### Requirements

Use Node 24 or newer and pnpm. See the [framework quickstart](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md) for the starter's application and deployment workflow.

The [packed starter check](https://github.com/ShivaeDev/platform/blob/main/examples/starter/README.md) runs package adoption proofs inside its existing generated app. Add a fixture folder and its stories to that shared check; packages do not add adoption CI jobs or separate generated-app installs.
