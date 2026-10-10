# North star

## The problem

Repositories repeat the same quality decisions: which lint rules to enable, which findings to leave as warnings, how to configure formatting and compiler checks, and what an agent should do when a command fails. Copied configs drift. Inline suppressions hide exceptions. A long list of warnings gives an agent no clear obligation to repair the code, and asking every repository to assemble a policy makes adoption another maintenance job.

Quality exists to make that decision once. A repository adopts Quality's opinionated policy and shared tooling, then spends its effort on the code. Quality owns check selection and sensible defaults, including the checks it deliberately leaves off internally. An enabled check requires a repair for uncovered findings. The benefit is the same one an opinionated formatter offers: fewer settings to debate, one consistent result and less configuration to maintain.

## The ideal

A consuming repository gets the whole policy. It does not select a preset of standards, turn a Quality rule off or demote it to a warning. Quality decides which checks belong together and explains their repairs. Internal exceptions belong to the package and have reasons; they are part of its judgement, not a template of switches for consumers to copy.

The repository supplies facts Quality cannot infer: where the source and generated files live, which architectural boundaries its imports must respect, and which additional commands a commit must run. Shared Biome and TypeScript configuration and Vitest helpers carry the package's conventions into those tools. The usual setup should stay small, with defaults that make sense together.

Adopting the whole policy does not require fixing all old debt in one change. The baseline records existing findings by rule and file while the checks stay strict. An uncovered finding asks for a repair. Fixing debt passes immediately, and lowering tools reduce its recorded counts. A permitted permanent exception lives in a registry with a reason. When that exception no longer applies, the gate asks for its removal.

Every finding should tell an agent that has never used the package what to change. It names the rule and identifies the file and line when available. Invalid input, an unreadable policy or an import boundary with contradictory examples must stop the run rather than make a check silently narrower.

## What good looks like

- Adoption is a small setup task. A repository uses the shared defaults instead of maintaining its own catalogue of rules and levels.
- Quality's rules, tool configuration and internal exceptions express one policy. A new shared convention belongs here, with a reason and accepted and rejected examples.
- Repository-specific inputs describe code and architecture. A generated path or import fence does not become permission to choose a weaker standard.
- The config, inventory, rule evaluation, registry, baseline and report form one path. Checks use that path instead of inventing their own debt handling.
- A rule defines exactly what it checks. CLI and git promises have real-command tests; package promises have installed-consumer tests. Messages never imply stronger guarantees than those tests prove.
- Debt diffs are reviewable. Lowering one entry preserves unrelated lines, and a tracked move can carry the debt it already had.
- The author retains choices the checker cannot make, including symbol names, semantic code order and whether a newly recorded finding is acceptable debt.

## Trade-offs

### Shared defaults and repository facts

A new setting creates a decision every consuming repository must make and maintain. Prefer improving the shared default. Add an input when the check needs a fact about the repository, not merely because another repository prefers a different rule or threshold. Quality can disable a tool rule internally when another tool owns the check or the rule cannot make a reliable judgement. That reason belongs with the shared configuration.

The public configuration surface and its gaps are recorded in the [roadmap](./roadmap.md). Usage documentation must describe what the code actually accepts without turning an implementation gap into recommended policy.

### Strictness and adoption

Adopt the policy as a whole; record old debt instead of weakening it. The baseline exposes uncovered findings without demanding an immediate clean-up of every file. It is a record to review, not proof that retained debt is harmless. Explicit recording can raise counts, and a reviewer owns whether that growth is justified. A registry entry is for an enduring, explained exception a rule permits, not a substitute for following that rule.

### Automation and judgement

A useful fix removes mechanical work. It must not take ownership of a choice the author needs to make. Selected fixes are disabled internally, and naming checks report without renaming. Biome also has enabled unsafe fixes, so `quality fix` requires review and must never promise to preserve every behavior.

### One policy and specialized tools

Quality coordinates Biome, TypeScript, Vitest and git instead of replacing their compilers, parsers or runners. These tool entry points share the policy; they are not separate menus of standards to adopt. Their native behavior remains visible enough to diagnose a mismatch. A pre-commit hook uses the committing worktree's config and dependencies.

### Static evidence and runtime evidence

A rule can require a test's name or report a fixture-writing call. It cannot establish that the test reaches the real engine. A fence's legal and illegal chains show that an import policy means what its author intended; they do not establish an application's deployment behavior. Runtime proof belongs in the application and the packages that execute it.

## What it deliberately leaves out

- A consumer warning mode, rule-selection menu or set of competing opt-in quality policies as the adoption model.
- A requirement for every repository to build its own rules or copy a complicated config before it can use Quality.
- Application services, persistence, transactions, request identity, client state and other runtime framework jobs. Their owning packages implement them.
- A replacement for TypeScript, Biome, Vitest or git.
- Automatic approval of baseline growth or a registry reason. Review owns whether retained debt is justified.
- A promise that static imports reproduce every runtime loader or that syntax rules prove business behavior.
- Renaming public symbols or changing APIs to satisfy a rule whose maintainer decision remains open.
