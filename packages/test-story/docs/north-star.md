# North star

## The problem

Agents now write most of the code, tests included, and a test file an agent writes tends to be hundreds of lines long. Each test rebuilds its setup by hand, a little differently from the last, and where rebuilding a complex setup is too much work, it mocks the part that was hard to build. Nobody reads these files. A human could ask an agent what a suite actually tests, but nobody asks consistently enough for that to be a safety net, so we lose sight of what we test exactly when more code is written than ever.

## The ideal

A test reads like a short English story: what exists, what someone does, and what is true afterwards. Its setup is a list of traits in the domain's words, such as `ovenIsLit()` and `hasDough(3)`, its actions go through the application's real verbs, and the real engine runs between them. Everything that is not specific to this one test lives elsewhere, written once:

- once per engine, a story kit that knows how to create the engine, seed it stage by stage, step it and show its state;
- once per feature, the traits and verbs that name that feature in domain words;
- in each test, only the story.

This changes the cost and benefit of a good test for both readers. For an agent, a story test is the cheaper one to write and to read on every later visit, because it is a handful of lines that reuse what already exists. Because every story runs the whole engine, each test also checks, almost by accident, the parts its author never thought about and would have mocked. For a human, a spec that reads as English leaves no excuse not to read it. With so little noise around the signal, an agent that writes a sloppy or pointless test produces something a reviewer sees at a glance.

## What good looks like

- A spec is a few lines of domain words. If a spec needs a helper, a loop or hand-built state, a trait or verb is missing from the kit.
- An impossible setup refuses loudly instead of seeding a state the application could never reach.
- A failure is a console version of stopping in a debugger: the whole story, where it stopped and the spec line there, and the engine's state at that moment, written so an agent with no knowledge of this package can fix the test, and complete enough that a CI log alone is enough to reproduce it.
- The kit author writes hooks and the package infers every type from them. There is one kit, built on Effect: a hook is a plain function, or a generator function when it needs a service or fails with a typed error, so no definition writes `Effect.gen` and a plain engine needs no Effect at all.
- A spec writes only its story. The kit hands it an `it` that already knows the engine's services, so a spec never builds a test harness, and names every test after its genre, so a report shows which engine it ran and a run can pick one engine's stories.

## Trade-offs

- **Real engine over speed.** A story is slower than a unit test with a mock. We accept that, and keep engines fast enough to step in a test instead of faking them.
- **Hooks over freedom.** The kit fixes the shape of an engine: create, stages, after-stage hooks, a step, a state to inspect, verbs. An engine that does not fit should change its kit's hooks, not bypass the kit.
- **Cheap locations over complete ones.** The failure shows one spec line, where the story stopped, found by matching the spec's path in the failure's stack or in the call site of the story's last line. A failure raised deep inside an Effect verb may have none; finding one would take machinery we do not want.

## What it will not do

- Run without Vitest, or print a failure anywhere but the failing test's own error.
- Own any application's traits, verbs or steps; they belong to the application's `test-support/`.
- Mock the application's own code, or help a test reach into an engine's internals. A fake belongs only at a true external boundary, and the kit's `create` is where it is wired in.
