# North star

## The problem

A repository's quality requirements often live in several places: compiler flags, a formatter config, scripts, hand-written import rules and instructions that only review enforces. Each command explains failures differently. An existing repository cannot turn every check on at error without first repairing all its debt, so rules stay at warning or acquire inline suppressions. Neither path makes a new violation stand out. An agent sees noise it can ignore, and a human cannot see which exceptions are intentional.

Quality exists to give that policy one executable path. The repository chooses checked files and rule options in a typed config. Rules produce findings, the gate distinguishes inherited debt from reasoned exceptions, and one report tells the author what to repair. Shared Biome, TypeScript and Vitest setup makes the surrounding tools speak the same conventions.

## The ideal

A repository can adopt a strict rule before it is clean. Existing findings have counted baseline entries; uncovered errors fail. Fixing a problem immediately passes, and the commit that fixes it can also lower the baseline. A permanent exception lives in a registry with a reason, rather than beside the code as a suppression. When it stops applying, the gate asks for its removal.

Every finding should make the next action clear to an agent that has never used the package. It names the rule, explains the repair and identifies the file and line when available. A malformed config, an unreadable policy or a typo in a boundary must stop the run rather than make the check silently narrower.

Policy should be easy to change deliberately and hard to weaken accidentally. A rule's options have a Standard Schema and TypeScript types. An import fence has a reason and examples that demonstrate its prohibition. A weaker Biome setting has a matching declaration. Baseline growth is explicit and visible to review; lowering tools never add debt.

## What good looks like

- The config, inventory, rule evaluation, registry, baseline and report form one path. A new repository rule reuses it.
- A rule defines the exact scope it checks: source text, test code, stylesheets, manifests or the import graph. A message does not imply a stronger guarantee than the check proves.
- Shared conventions have both an accepted and a rejected example. CLI and git promises have real command tests in seeded repositories; package promises have installed consumer tests.
- Debt diffs are small enough to review. A change to one baseline entry does not rewrite unrelated lines, and tracked moves can carry the debt they already had.
- The author keeps decisions the checker cannot make, including symbol names, semantic code order and whether a newly recorded finding is acceptable debt.
- A repository's hook uses the committing worktree's config and dependencies, so branches are checked under their own policy.

## Trade-offs

### Strictness and adoption

An all-or-nothing clean-up would prevent adoption in the repositories that most need the gate. The baseline admits existing counts while exposing uncovered errors. It is a record to review, not a proof that old debt is harmless. Explicit recording can increase counts; the maintainer and reviewer decide whether that change is justified.

Warnings are useful during a transition but should not become a second permanent policy. Prefer an error-level rule with visible baseline entries when the repository is ready to require it. Use a registry entry only for an enduring, explained exception a rule permits.

### Automation and judgement

A useful fix removes repeated mechanical work. It must not take ownership of a choice the code's author needs to make. The preset disables selected fixes and the naming rules report without renaming. Biome still has enabled unsafe fixes, so `quality fix` requires review and must never be described as behavior-preserving in every case.

### One gate and specialized tools

Quality coordinates specialized tools instead of replacing their compilers, parsers or runners. Biome checks its own configured scope; TypeScript resolves imports; Vitest runs the projects. The shared gate normalizes findings and debt, while those native tools remain visible enough to diagnose a mismatch.

Effect conventions are useful in the repositories this package serves, but the reusable gate and an opinionated preset need clear boundaries. Which conventions belong in separate presets remains the maintainer's decision in the roadmap.

### Static evidence and runtime evidence

A rule can require a test's name or report a fixture-writing call. It cannot establish that the test reaches the real engine. A fence's legal and illegal chains establish that the policy means what its author intended; they do not establish an application's deployment boundaries. Keep those runtime proofs in the application and the packages that execute the behavior.

## What it deliberately leaves out

- Application services, persistence, transactions, request identity, client state and other runtime framework jobs. Quality checks policy around them; their owning packages implement them.
- A replacement for TypeScript, Biome, Vitest or git. The package supplies shared setup and a gate around their relevant output.
- Automatic approval of baseline growth or a registry reason. Review owns whether the retained debt is justified.
- A promise that static imports reproduce every runtime loader or that syntax rules prove business behavior.
- Renaming public symbols or changing APIs to satisfy a policy whose maintainer decision remains open.
