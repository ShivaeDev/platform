---
name: story-testing
description: "Use this skill when writing, reviewing or fixing test-story stories, their setups or their test kits in a Platform app."
metadata:
  author: marvin-bitterlich
  user-invocable: "true"
---

# Story testing

A story proves what the application does for someone outside it. Start with the behaviour and the evidence that would convince that person, then choose the setup and actions. Keep the real application running behind its public boundaries. A short story with the wrong evidence still proves the wrong thing.

Use `storyKit` from `@shivaedev/test-story/server/storyKit.ts`. Keep the application's kits, traits, verbs and readouts in `src/test-support/`; a spec names traits with the kit's `it`, calls verbs, reads results and states expectations. Extend the kit when a feature needs another action or setup.

## Assert what someone outside sees

Assert on a PR comment or checks, a screen, an HTTP answer or an outbound request. Those observations prove the behaviour reached its consumer; a stored row alone does not prove delivery, rendering or the response.

Read stored rows or logs only when nothing outside shows the behaviour yet. Name the readout to disclose that limit, such as “stored word count” or “recorded worker log”, so a reviewer can see what remains unproved.

Good: check the posted PR comment's text. Bad: check a comment row and assume the PR received it.

## Set up through the application's boundary

Traits drive the app through events or requests, then settle until the resulting observable work completes. Never call module internals to seed state: doing so skips the wiring and rules the story needs to exercise. A shortcut is rare and named as a shortcut, with its reason visible at its definition.

Good: deliver the repository event and wait for the resulting check. Bad: call an internal repository method to insert the check that the event should create.

## Separate actions, observations and expectations

Verbs act on the real engine. Readouts return values. Specs assert. Put no `expect` in test-support: hidden assertions make the story's claim hard to review and prevent another story from using the same observation differently. A helper that two specs need lives in test-support.

A verb performs an action, not a whole scenario that returns the numbers the spec checks. Never hard-code the expected outcome inside a helper. If an action cannot find its form or button, fail instead of silently doing nothing; otherwise the story may pass without performing its action.

Good: a verb submits a title, a readout returns the displayed title, and the spec compares it with the requested title. Bad: a “save succeeds” helper runs setup, saves and asserts internally.

After one action, check several outcomes with `outcomes` from `@shivaedev/test-story/server/outcomes.ts`, called in the spec: each row is `label: [readout, expected]`, where the readout is an Effect. Write each label once, beside its observation and expected value. For one outcome, keep a plain `expect` in the spec.

## Observe the job's result

Never count pg-boss jobs or touch the `pgboss` schema. Queue storage is an implementation detail, and an enqueued job does not prove the work ran. Assert what the jobs did through the application's visible results.

Good: read the updated word count in the HTTP answer. Bad: count queue rows after submitting a note.

## Test the application's responsibility

Do not test the framework's own behaviour in an app. Those tests belong to the framework package that owns it; repeating them adds cost and can hide missing coverage of the application's policy and wiring.

Good: check which repository receives the app's PR comment. Bad: reproduce the queue library's retry contract in an app story.

## Make every assertion capable of failing

For each assertion, identify a plausible broken implementation that would make it fail. Avoid assertions on constants, values fabricated by the helper, or empty collections whose universal predicate passes without observing anything. Prefer content over lengths: a count can be right while every result is wrong.

Good: compare the received request's destination and body with the intended message. Bad: check only that one request exists, or that every request has a token when no requests were received.

## Report framework gaps

Hand-made decoders, settle heuristics and schema SQL in a test kit are framework gaps. Report the missing capability to the framework owner rather than building a workaround in the app's kit. Duplicated infrastructure drifts from the framework and makes every application carry the same defect. Use existing supported APIs; do not hide a missing one behind a helper.

Good: report that the framework cannot wait for the required observable completion. Bad: poll queue tables or add arbitrary sleeps to guess when the app is settled.

## Fake preconditions, exercise the behaviour

A setup may start from a faked precondition: John is already signed in and admin of this repo, a session is minted for the story, or the fake service has the needed permissions and tokens. Only the behaviour under test must be driven and asserted from outside. Name the precondition so it is clear where the story starts.

Never spend slow work such as an OAuth round trip or password hashing on a precondition. Keep exactly one story per real sign-in flow; other stories start signed in. This keeps feature stories fast and makes a sign-in failure belong to the story that owns it.

Good: a note-editing story starts with a minted session; the one OAuth story drives the real callback through a fake provider. Bad: every note story completes OAuth or hashes a password before editing.

## Isolate full apps by database

Full-app stories use an isolated database cloned from a template, not a wrapping transaction. Writes cross several pools, and PostgreSQL `NOTIFY` fires only on commit; a transaction around one pool neither contains the other writes nor exercises committed notifications.

Use `withIsolatedDatabase` from `@shivaedev/test-sql/server/withIsolatedDatabase.ts` as the kit's `around` hook with its PostgreSQL test layer. Keep `withTestTransaction` from `@shivaedev/test-sql/server/withTestTransaction.ts` for repository-level tests on a migrated template, where all work stays on the transaction's connection.

Good: let an HTTP story commit into its disposable database clone. Bad: wrap that story in a transaction and assume separate HTTP and worker pools roll back with it.

## Run one spec directly

From the app directory, run:

```sh
pnpm run test <file> --maxWorkers=2
```

Replace `<file>` with the spec's path. Do not insert `--`: pnpm forwards these arguments to the test script directly, so the file filter and worker limit reach Vitest as intended. A focused run shortens feedback while you write the story; run the project's full checks before handing it off.
