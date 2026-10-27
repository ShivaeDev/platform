import { Effect, Schema } from "effect";
import type { SendOptions } from "pg-boss";
import { expectTypeOf } from "vitest";
import { defineQueue, type QueuePolicy } from "#definition.ts";
import { makePgBoss } from "#service.ts";
import { PullRequestJob } from "#test/singletonQueueOptions.ts";

expectTypeOf<QueuePolicy>().toEqualTypeOf<"standard" | "short" | "singleton" | "stately" | "exclusive" | "key_strict_fifo">();

const Queue = defineQueue({
	key: (payload) => {
		expectTypeOf(payload.pullRequestId).toEqualTypeOf<number>();
		expectTypeOf(payload._tag).toEqualTypeOf<"Refresh" | "Reconcile">();
		return `pr:${payload.pullRequestId.toFixed(0)}`;
	},
	name: "pull-request",
	queue: { policy: "singleton" },
	schema: PullRequestJob,
});
const Ordinary = defineQueue({ name: "ordinary", schema: Schema.Struct({}) });
const Jobs = makePgBoss("@test/SingletonJobs");
const program = Effect.gen(function* () {
	const jobs = yield* Jobs;
	yield* jobs.counts(Queue);
	yield* jobs.retry(Queue, "job-id");
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }, { priority: 1 });
	yield* jobs.enqueue(Queue, { _tag: "Reconcile", pullRequestId: 42 });
	// @ts-expect-error The definition owns the singleton key.
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }, { singletonKey: "wrong" });
	const conflicting: SendOptions = { singletonKey: "wrong" };
	// @ts-expect-error Non-literal options cannot override the key either.
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: 42 }, conflicting);
	// @ts-expect-error Producers supply decoded payloads.
	yield* jobs.enqueue(Queue, { _tag: "Refresh", pullRequestId: "42" });
	// @ts-expect-error Only declared tagged job kinds are accepted.
	yield* jobs.enqueue(Queue, { _tag: "Unknown", pullRequestId: 42 });
	yield* jobs.enqueue(Ordinary, {}, conflicting);
});
void program;

// @ts-expect-error A singleton queue must declare its key.
defineQueue({ name: "missing-key", queue: { policy: "singleton" }, schema: PullRequestJob });
// @ts-expect-error Queue policies reject typos.
defineQueue({ name: "typo", queue: { policy: "singelton" }, schema: PullRequestJob });
// @ts-expect-error The key must return a string.
defineQueue({ key: () => 42, name: "numeric-key", queue: { policy: "singleton" }, schema: PullRequestJob });
