# North star

## The problem

Shared instructions help only when agents can reach them. Skill distribution often depends on a plugin being installed and loaded, a machine-local location or a symlink into a package installation. Those assumptions are fragile across the cloud environments where agents work. A checkout can contain the code without the instructions that should guide changes to it.

Copying skills into each repository solves availability but creates another problem: copies drift, and an improvement to the shared instruction does not reach them by itself. The maintainer needs both a useful collection of shared skills and a practical way to update the repository copies. Neither part should require a complicated distribution system.

Shared and local instructions also have different owners. A repository can adopt the common pull request format while keeping its architecture guidance. Distribution must let them coexist without treating every folder in an agent directory as package-owned.

## The ideal

This package is ShivaeDev's maintained collection of shared agent skills and the small mechanism that distributes them. Maintaining the instructions is part of its purpose, alongside selection, copying, updating and checking. It is not merely a transport for a catalogue maintained somewhere else.

The adopted instructions are ordinary committed files. An agent that can read the checkout can read their content directly, without asking a plugin or resolving a link into `node_modules`. Supporting files travel with the skill's entry point. All agents working from that checkout should have the same reviewed guidance available, rather than depend on individual machine setup.

The versioned dependency supplies the next version. Sync copies selected folders into the repository and records what it owns. The repository reviews and commits the change. Check names missing or edited copies, changed selection and version mismatches, with a concrete command to restore them. Updates stay visible instead of replacing instructions invisibly when an agent starts.

Agent-specific paths can help a host find the same content, but the ordinary files remain the core delivery path. Discovery differs between hosts, and availability does not prove that an agent followed an instruction. The [roadmap](roadmap.md) owns compatibility work and the exact checks still to establish.

## Which ideals win

1. **Native Effect.** Use existing filesystem and path services, typed failures and normal Effect composition.
2. **Direct repository access.** Prefer committed ordinary files and a small update operation over plugin-dependent delivery or links as the only content path. Preserve a skill's supporting files.
3. **Explicit ownership.** The manifest marks the names this package manages. Protect repository-local instructions before choosing a more convenient sync.
4. **Useful skills and one maintained source.** Improve shared instructions here. Keep repository-specific instructions in local skills rather than forks inside managed copies.
5. **Reviewable updates and actionable drift.** Make adopted versions and content visible in Git. A check explains how to restore the copies, without promising more than its evidence.
6. **Small, explicit adoption.** Repositories choose their skills and commit, hook and CI policy. Automation is an opt-in convenience.

## Trade-offs

### Committed copies and compatibility paths

Real files make a larger diff than installation links, but show exactly which instructions the repository adopts. The instructions remain present in a checkout independent of the package's installation location. Compatibility paths should lead to those files rather than create another content source or become a requirement for direct reading.

### Simple updates and local edits

A managed copy is sync output. Merging local edits would create another maintained version and obscure ownership. Shared improvements belong in this package; local variation belongs under a different skill name. Replacing a copy keeps the update path small and predictable.

### Refusal and convenience

A selected name can collide with a local skill. Refusing the collision requires a contributor to decide which instruction owns the name, but preserves that choice rather than silently replacing the repository's guidance.

### File evidence and host evidence

Local filesystem tests can establish copied content, links, version records and drift handling. They do not establish discovery in every cloud host, a host's permissions or whether an agent followed a skill. Keep those boundaries explicit, and validate a claimed host integration in that host.

## What the package leaves out

- A general plugin manager, agent runtime or dependency on a plugin for reading the copied content.
- Choosing a consuming repository's selection or overwriting its local instruction policy.
- Running an agent, writing its pull request or proving that it followed a skill.
- Maintaining forks inside managed copied folders.
- Installing hooks, enabling workflows or granting write permissions during dependency installation.
- Replacing Quality's code checks or Work Board's work presentation.

The [README](../README.md) describes selection, sync and check. The [roadmap](roadmap.md) owns implementation status, next changes and maintainer questions.
