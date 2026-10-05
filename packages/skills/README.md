# @shivaedev/skills

Shared agent skills in the [Agent Skills](https://agentskills.io) format, with a command that copies the ones a repository selects into it and a check that tells when the copies are stale. The package is the only source of the skills, and its version in your lockfile is the pin: a bump of the package is a bump of the skills.

| Skill | What it does |
| --- | --- |
| `pr-description` | The title and body format for pull requests: Why, How, and optional Decisions and Callouts. |

Each skill is a folder under `skills/` in this package with a `SKILL.md` whose frontmatter has `name`, `description` and optionally `metadata`.

## Adopt it

```sh
pnpm add --save-dev @shivaedev/skills
```

List the skills the repository uses in its `package.json`:

```json
{
	"shivaedevSkills": ["pr-description"],
	"scripts": {
		"lint:skills": "shivaedev-skills check"
	}
}
```

Run `pnpm exec shivaedev-skills sync` and commit what it writes. Call `shivaedev-skills check` from your lint script or CI.

## `shivaedev-skills sync`

For each selected skill, `sync`:

- copies the skill's folder from the installed package into `.agents/skills/<name>/` as real files, replacing a copy it made before;
- links `.claude/skills/<name>` to that folder with a relative symlink, so Claude Code finds the same files;
- records the package version and a SHA-256 hash of each copy in `.agents/skills/.shivaedev-skills.json`.

A skill that the manifest lists but the selection no longer does is removed, with its link. A folder or link in `.agents/skills` or `.claude/skills` that the manifest does not list belongs to the repository: `sync` never changes it, and it refuses to run, changing nothing, when a selected skill has the same name as one. An unknown skill name or a `package.json` without `shivaedevSkills` also stops it with a message.

Change a shared skill in this package, not in the copy: the next `sync` overwrites the copy, and `check` fails until then. Keep formatters away from `.agents/skills`, because a reformatted copy no longer matches its hash.

## `shivaedev-skills check`

`check` exits with code 1 and says to run `sync` when:

- the manifest is missing, or its version differs from the installed version of `@shivaedev/skills`;
- a synced copy is missing, or its files differ from the hash in the manifest, because a file was edited, added or removed by hand;
- the selection in `package.json` and the skills in the manifest differ.

Otherwise it exits with code 0.

## Sync on dependency bumps

`templates/sync-skills.yml` in this package is a GitHub Actions workflow that a repository can copy into its `.github/workflows/` on purpose; installing the package does not add it. It is written for a pnpm repository and pins every action by commit SHA, which you can replace with the SHAs your repository allows.

On each pull request whose branch is in the same repository, never a fork, it installs the dependencies and runs `check`. When `check` fails, it runs `sync`, then commits `.agents/skills` and `.claude/skills` and pushes them to the pull request branch with the default `GITHUB_TOKEN`. That is why the job needs `contents: write`. This works whatever opened the pull request: Renovate, Dependabot or a person. GitHub does not start workflows for a push made with `GITHUB_TOKEN`, so the sync commit does not run CI again; push again or re-run CI when you need checks on it.
