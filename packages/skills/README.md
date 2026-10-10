# @shivaedev/skills

This package contains ShivaeDev's shared agent skills and a simple way to keep them in the repositories that use them. It copies selected instructions into ordinary repository files, with versioned updates and a check for drift, so the shared guidance travels with the checkout.

## Why you want this

A cloud agent session can arrive without the plugins or machine-local links that make shared instructions visible elsewhere. Keeping the instructions directly in the repository gives people and agents one place to read them. This package maintains both the shared skills and the small update path:

```sh
pnpm exec shivaedev-skills sync
pnpm exec shivaedev-skills check
```

Sync puts the selected skills and their supporting files under `.agents/skills/` as real files to review and commit. Check detects changed copies and package versions, so updating the shared instructions is a reviewable repository change. The files themselves can be read directly from the checkout; they do not need a plugin to supply their content.

## Using it

### How to think about it

The package owns two things: the shared instructions it ships and the sync/check commands that distribute them. A **skill** is a folder of agent instructions. Its `SKILL.md` is the entry point, and the folder may include supporting files. The installed package supplies those folders and its version. Improve shared instructions here; use the commands to carry that version into consuming repositories.

The repository's **selection** is the `shivaedevSkills` list in its `package.json`. It says which shipped skills belong in the repository; it does not select the repository's own skills.

The **shared copies** are real files under `.agents/skills/<name>/`. They are the repository-visible instructions, including supporting files. Commit them so a checkout contains the adopted content rather than a pointer into a package installation.

The **Claude compatibility link**, `.claude/skills/<name>`, is a relative symlink to that same folder. It provides another path to the one copy. Direct reading of `.agents/skills/` does not use this link; the sync operation still requires creating it, as described under [limits](#install-setup-and-limits).

The **sync manifest**, `.agents/skills/.shivaedev-skills.json`, records the package version and a hash for each copied folder. It also records ownership: a folder or link whose name is absent from the manifest belongs to the repository. `sync` replaces the copies it owns and refuses to overwrite an unowned name. `check` compares the selected names, installed version and copies with that record.

The work has three parts: select the shared instructions once, sync and review them when the selection or dependency changes, and check them in everyday lint and CI runs. Each agent working from that checkout has the same committed files available; discovery and use still depend on its host's instruction-loading rules.

### 1. Choose the shared instructions

Put the selection in the repository's `package.json`:

```json
{
  "name": "example-project",
  "shivaedevSkills": ["pr-description"]
}
```

`pr-description` is the shipped skill for writing a pull request title and body. Its instructions use Why and How, with Decisions and Callouts when needed. Read the [skill itself](https://github.com/ShivaeDev/platform/blob/main/packages/skills/skills/pr-description/SKILL.md) before adopting that format.

An unknown name stops `sync` before it copies selected skills, and the error lists the shipped names. Omitting `shivaedevSkills` also stops `sync` with a message asking for a selection. To remove all managed skills, keep the field and set it to `[]`; local skills remain.

### 2. Sync, review and commit

```sh
pnpm exec shivaedev-skills sync
git add --all .agents/skills .claude/skills
git diff --cached
git commit -m "Sync shared agent skills"
```

`sync` copies every selected skill folder, including its supporting files, and creates the relative Claude link. It records the installed version and a SHA-256 hash of each copy in the manifest. Review the copied instructions and commit the manifest, copies and compatibility links together. Updates arrive by changing the dependency and syncing again; the instructions an agent reads remain visible in the repository diff.

When a previously synced skill is deselected, `sync` removes its copy and link. When a managed copy has been edited or has extra files, `sync` replaces it with the shipped folder. Make shared changes in this package rather than in the copy; keep repository-specific instructions in a separate local skill.

A selected name that already exists in either agent directory but is absent from the manifest stops the sync before files change. Rename the local skill, remove it deliberately, or drop that name from the selection. Local skills under other names remain beside the managed copies.

### 3. Check in everyday work

```json
{
  "name": "example-project",
  "shivaedevSkills": ["pr-description"],
  "scripts": {
    "lint:skills": "shivaedev-skills check"
  }
}
```

Add `pnpm lint:skills` to the repository's lint, pre-commit or CI sequence. The package supplies the check; the repository chooses when to require it.

```sh
pnpm lint:skills
```

The CLI exits with code 0 after a valid sync. It exits with code 1 when no manifest exists. The check also fails when the installed version differs, the selection and manifest disagree, a copied folder is missing, or a copied file is edited, added or removed. Each of those failures asks you to run `shivaedev-skills sync` and commit the result.

For example, a check before the first sync reports:

```text
shivaedev-skills: The shared skills are out of sync:
- .agents/skills/.shivaedev-skills.json is missing.
Run `shivaedev-skills sync` and commit the result.
```

Keep formatters away from managed copies. Formatting changes their bytes just as a hand edit does, so the next check reports drift.

### Optional: sync from a pull request workflow

The package includes an opt-in [GitHub Actions template](https://github.com/ShivaeDev/platform/blob/main/packages/skills/templates/sync-skills.yml). Copy it into a repository deliberately:

```sh
mkdir -p .github/workflows
cp node_modules/@shivaedev/skills/templates/sync-skills.yml .github/workflows/sync-skills.yml
```

The template installs dependencies with pnpm and runs `check` on pull requests whose branch belongs to the same repository. After a failed check, its next step runs `sync`, stages both agent directories, commits and pushes to the pull request branch. Its `contents: write` permission requests repository write access for that push. A repository can instead run only `check` in CI and have the contributor commit the sync locally.

### Command and module API

| Command | Work |
| --- | --- |
| `shivaedev-skills sync` | Copy selected instructions, replace owned copies and links, remove deselected owned skills, and record the manifest. |
| `shivaedev-skills check` | Check the installed version, selected names and copied files against the manifest. |

The executable is the adoption path. For an Effect program that needs these operations, import a module by its `.ts` subpath, such as `@shivaedev/skills/syncSkills.ts`; there is no root entry point. The exported module inventory is:

| Module | Exports |
| --- | --- |
| `syncSkills.ts` | `syncSkills(repo, installed)` |
| `checkSkills.ts` | `checkSkills(repo, installed)` |
| `installed.ts` | `Installed`, with `root`, `skills` and `version`; `readInstalled(root)` |
| `readSelection.ts` | `readSelection(repo)` |
| `manifest.ts` | `Manifest` schema and type; `readManifest(repo)`; `writeManifest(repo, manifest)` |
| `hashSkill.ts` | `hashSkill(folder)` |
| `layout.ts` | `BIN`, `PACKAGE`, `SELECTION_FIELD`, `AGENTS_SKILLS`, `CLAUDE_SKILLS`, `MANIFEST`; `SkillPaths`; `skillPaths(path, repo, name)` |
| `SkillsError.ts` | `SkillsError`, the tagged error with a `message` |
| `cli.ts` | Executable entry point with no named exports; importing it runs the CLI |

`syncSkills` and `checkSkills` return Effects. Their `repo` argument is the consumer directory; `installed` describes the package directory, shipped names and version. Prefer the two complete operations when integrating a check or sync:

```ts
import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { checkSkills } from "@shivaedev/skills/checkSkills.ts";
import { readInstalled } from "@shivaedev/skills/installed.ts";
import { Effect } from "effect";

const packageRoot = fileURLToPath(new URL(".", import.meta.resolve("@shivaedev/skills/package.json")));

const check = Effect.gen(function* () {
  const installed = yield* readInstalled(packageRoot);
  yield* checkSkills(process.cwd(), installed);
});

check.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
```

This program checks the current repository using the installed package. `NodeServices.layer` supplies the filesystem and path services; `NodeRuntime.runMain` runs the Effect. The smaller modules expose the pieces that sync and check use.

### Install, setup and limits

```sh
pnpm add --save-dev @shivaedev/skills @effect/platform-node@4.0.0-rc.112 @effect/platform-node-shared@4.0.0-rc.112 effect@4.0.0-rc.112
```

The Effect and Node platform packages are peers, and the package requires Node.js 24 or newer. Run the CLI from the repository directory that contains the selection's `package.json`.

- Sync requires filesystem support for the Claude compatibility symlink. If that creation fails, sync fails; copying and manifest writing do not have an established rollback guarantee. The committed `.agents/skills/` content is directly readable, but successful sync on a host without symlink support is not a package promise.
- Commit the shared files, relative links and manifest. The dependency supplies the next version; syncing makes that version's instructions a reviewable repository change.
- Keep local instructions outside folders owned by the manifest. A later sync replaces managed copies, including added files.
- The manifest is a record of a sync, not a security boundary. `check` compares copied files with recorded hashes; it does not re-hash the installed skill source or verify Claude links. A passing check is evidence about the recorded copies, not about an agent discovering or following them.
- Name-collision refusal happens before files change. It does not establish rollback after a filesystem failure during copying.
- The workflow template belongs to repository setup. Review its action pins and write permission before enabling it. Hosted repository permissions and follow-up CI runs need validation in that repository; the template alone does not establish them.
