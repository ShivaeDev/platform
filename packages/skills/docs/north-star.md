# North star

## The problem

An agent instruction is useful only when the repository can find it and maintain it. A skill copied between projects soon has several owners and several versions. Fixing one copy does not fix the others, and a dependency update does not make an agent's visible files change by itself.

Shared instructions and local instructions also have different owners. A repository may want the common pull request format while keeping its own architecture guidance. Distribution must let them coexist without treating every folder in an agent directory as package-owned.

## The ideal

A shared skill has one maintained source. A repository selects that skill through its versioned dependency, sees the full copied folder in review, and commits it next to local instructions. The version and content in use are explicit rather than an invisible update fetched when an agent runs.

The copy is ordinary text that humans and agents can inspect. Supporting files travel with the entry point. Multiple agent directories reach the same content rather than holding independent copies that can disagree.

A check makes the ownership record useful in daily work. It says which selected copy is missing, edited or associated with another installed version, and tells the contributor the operation that restores it. The check's promises stay as narrow as the tests prove.

## Which ideals win

1. **Native Effect.** Use existing filesystem and path services, typed failures and normal Effect composition. Distribution does not need a second execution model.
2. **Explicit ownership.** The manifest decides which names this package manages. Protect unowned files before choosing a more convenient sync.
3. **One maintained source.** Shared changes belong in the package. Repository-specific instructions belong in local skills rather than edits to managed copies.
4. **Reviewable change and actionable drift.** Keep the actual files and their ownership record visible. Prefer a failure with a concrete recovery step over silently accepting a changed copy.
5. **Small, explicit adoption.** Let the repository select its skills and decide its commit, hook and CI policy. Add automation as an opt-in example rather than an installation side effect.

## Trade-offs

### Committed copies over installation links

Real files create a larger diff than a link into `node_modules`, but the diff shows the instructions the repository adopts. Dependency changes and agent-visible instructions become a change a maintainer can review together.

### Replacement over merging

A managed copy is the output of syncing the shared source. Merging local edits into it would create another maintained version and obscure ownership. Local variation belongs under a different skill name.

### Refusal over a convenient overwrite

A selected name may collide with a repository's own instruction. Refusing the collision requires a contributor to decide which instruction owns the name, but preserves that decision for the repository instead of making it silently.

### A focused check over broader assurances

A copy check is useful without claiming to execute an agent, validate its behavior or establish a hosted CI policy. Keep copy integrity, host discovery and instruction quality separate, and describe each only to the degree it has evidence.

## What the package leaves out

- Choosing the repository's instruction policy or deciding which skills it should adopt.
- Running an agent, writing its pull request or verifying that it followed a skill.
- Maintaining forks inside copied shared folders.
- Installing hooks, enabling a workflow or granting repository write permissions as part of dependency installation.
- Replacing `@shivaedev/quality` as the owner of repository code checks or `@shivaedev/work-board` as the owner of work presentation.

The [roadmap](roadmap.md) owns implementation status and the questions the maintainer still decides. The [README](../README.md) describes how to select, sync and check instructions.
