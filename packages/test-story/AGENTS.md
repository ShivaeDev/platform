# @shivaedev/test-story

You are changing the package that lets a test read like a short English story while it runs the real engine. When agents write most of the code, test files grow into hundreds of lines no human reads: each rebuilds its setup by hand or mocks what was too much work to build, so nobody can see what is actually tested. This package shifts the balance. Writing a story test is less work for an agent than writing the slop, every story runs the whole engine and so checks what a mock would have skipped, and a spec holds only what is specific to its test, so a human reviewer reads it in seconds and a sloppy test stands out. The full vision is in `docs/north-star.md`; what is built and still open is in `docs/roadmap.md`; how to use the package is in `README.md`.

## Which way to lean

When goals conflict, they win in this order:

1. **The spec reads as a story.** A spec names traits and verbs in domain words and holds nothing else. Any API that makes a spec longer or adds plumbing to it loses, even if it saves the kit author work.
2. **The real engine runs.** The package never encourages a fake engine, a mocked step or state written by hand in a spec.
3. **One definition per engine.** The kit owns the plumbing every engine shares, down to the test's `it` and its genre tag; the engine's author fills in hooks and every type is inferred from them. There is one implementation, built on Effect, and an engine that needs no Effect plugs in with plain functions. Add a hook only when two real engines need it.
4. **The failure fixes itself.** A failure carries everything an agent needs to find and fix the cause without rerunning anything.
5. **Small and native.** Vitest and Effect stay visible; the package wraps them thinly.

## Failure messages are for agents

Every error and every failure appendix is written for an agent that may never have heard of this package and wants to fix the test, in the spirit of the Rust compiler:

- The first line says what went wrong, in the engine's own words, with the data that pins it down.
- A `help:` line says what this kind of failure means and what to change, in one or two sentences, so an agent new to the package can act and one used to it can skip it.
- Point at places: the spec line behind each story line, the kit that defines the traits, the command that reruns the test. Prefer what is cheap and reliable, such as matching the spec's path in a stack, over machinery that parses or guesses.
- Show the state, never `[object Object]`. Render a thrown string, plain object or tagged error by its content, and when something is too large to print, write it to a file and name the file.
- Stay short. A failure that a CI log shows must be enough to reproduce and fix the test locally, and nothing in it should repeat on every failure that an agent does not need.
