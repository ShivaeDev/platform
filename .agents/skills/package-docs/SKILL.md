---
name: package-docs
description: "Use this skill before you write or reshape a package's AGENTS.md, README.md or docs/ folder in this repo, and when you add a new package."
---

# Package docs

Every package in this repo explains itself to three readers, and each reader gets its own file. A human decides from the README's first screen whether the package is worth pointing their agents at. An agent that uses the package learns from the rest of the README how to think about it and how to use it. An agent that changes the package reads the package's `AGENTS.md` to know what the package is for and which way to lean when a trade-off comes up.

## The files

| File | Reader | Holds |
|---|---|---|
| `packages/<name>/AGENTS.md` | An agent changing the package | The north star in a few short paragraphs: the problem, the ideal, and the order of priorities when they conflict. Links to the README, and to `docs/` when the package has one. `CLAUDE.md` beside it is a symlink to it. |
| `packages/<name>/README.md` | A human first, then an agent using the package | The first screen sells; the rest teaches. Published to npm. |
| `packages/<name>/docs/north-star.md` | Anyone deciding where the package goes | Optional. The long form of the vision, only when it says something durable that `AGENTS.md` cannot hold in a screen. |

Add more files under `docs/` only when a topic outgrows the README; let the pattern grow from real need. No package keeps a roadmap: planned work, status and open questions live on the Work Board, and what shipped lives in git and the changelog.

## AGENTS.md: the north star

Keep it short enough to read on every visit, about a screen. Say what the package is for and why it matters, the ideals that guide design decisions, and the order in which they win when they conflict. Do not repeat the README's usage guide or the repo's `AGENTS.md`; link to them. An agent that reads only this file should make the same call the maintainer would on a judgement question.

## README.md: one page for humans, the rest for agents

Use this shape:

```markdown
# @shivaedev/<name>

One to three sentences: why this package exists. It says the same thing as the north star, in the reader's words.

## Why you want this

The human page. The problem, the payoff, and one small code example that shows the payoff at a glance. Images and Mermaid diagrams are welcome here.

## Using it

The agent part. How to think about the package, the concepts in the order a user meets them, full examples, the API, then install, setup, warnings and limits.
```

Name the two H2 sections in words that fit the package; the split is what matters, not the labels.

- The first screen is the sell. It holds no install command, no warning, no configuration and no API list. A human who stops reading there should know what problem the package solves and what using it looks like.
- The agent part is text and code only. It explains the mental model before the API, so an agent can use the package correctly in a case no example covers.
- Organize the agent part by the order of the reader's work: what they set up once, what they write once per feature, what they write every day.
- Name each concept by what it is. A reader without a glossary should understand the word.
- Do not hard-wrap Markdown prose. Keep each prose paragraph on one source line, including inside lists; preserve Markdown structure and line breaks in literal code and output.
- A code block shows the code or output exactly as it really is or prints, with no explanation inside it; the prose under the block says what the reader is looking at.
- Every behavior the README states has a test that fails without it.
- npm renders the README too. Use absolute URLs for images; GitHub renders Mermaid, npm shows it as a code block, so keep the text around a diagram readable without it.

## docs/

`north-star.md`, when a package has one, is the long form of the `AGENTS.md` north star: the problem in full, the ideals, the trade-offs, and what the package deliberately leaves out. It does not repeat `AGENTS.md`. Docs state the current truth. Leave out status, "built" or "done" lists, inventories of files, modules or tests, narrated history and counts: they drift, and every parallel pull request edits the same lines.

## Changesets and releases

For a consumer-visible change, add one `.changeset/<short-name>.md` per PR, naming each affected package and its bump in YAML frontmatter (`"@shivaedev/example": minor`). Use minor for Added or Breaking behavior before 1.0 and patch for Changed or Fixed only, with `### Added`, `### Changed`, `### Fixed` or `### Breaking` headings and Markdown bullets. Choose a unique short filename; do not edit versions, `CHANGELOG.md` or release manifests outside a release PR. Internal docs, tests, tooling and refactors need no changeset. For a release PR, follow [the release steps](../../../docs/releases.md): review `pnpm changesets plan`, run `pnpm changesets apply`, and commit the generated versions, changelogs, `.changeset/release.json`, hook changes and deleted changesets.

## Checklist

- [ ] `AGENTS.md` is a short north star, with `CLAUDE.md` symlinked to it.
- [ ] The README title is the package name, followed by the one-to-three-sentence why.
- [ ] The README's first screen holds the human pitch and one small example, nothing else.
- [ ] The agent part goes from mental model to examples to API to install and limits.
- [ ] A `docs/north-star.md`, if present, adds to `AGENTS.md` rather than repeating it.
- [ ] No doc keeps a roadmap, a status list or an inventory of files or tests.
- [ ] Each claim in the README has a test behind it.
