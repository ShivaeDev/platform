import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt(
	"reconciles an existing queue on restart and rejects immutable changes before updating it",
	[realPostgres],
	function* ({ register, admin }) {
		const name = "options";
		const Payload = Schema.Struct({});
		const Initial = defineQueue({ name, queue: { expireInSeconds: 10, retryDelayMax: 10, retryLimit: 1 }, schema: Payload });
		const Changed = defineQueue({ name, queue: { expireInSeconds: 45, notify: true, retryDelayMax: 30, retryLimit: 5 }, schema: Payload });
		const Immutable = defineQueue({
			key: () => "entity",
			name,
			queue: { expireInSeconds: 60, partition: true, policy: "singleton" },
			schema: Payload,
		});
		const observer = yield* admin();
		yield* register([Initial]);
		expect(yield* Effect.promise(() => observer.getQueue(name))).toMatchObject({ expireInSeconds: 10, retryDelayMax: 10, retryLimit: 1 });
		yield* register([Changed]);
		expect(yield* Effect.promise(() => observer.getQueue(name))).toMatchObject({
			expireInSeconds: 45,
			notify: true,
			retryDelayMax: 30,
			retryLimit: 5,
		});
		const id = yield* Effect.promise(() => observer.send(name, {}));
		expect(yield* Effect.promise(() => observer.findJobs(name, { id: id ?? "" }))).toMatchObject([
			{ expireInSeconds: 45, retryDelayMax: 30, retryLimit: 5 },
		]);
		const error = yield* Effect.flip(register([Immutable]));
		expect(error).toMatchObject({ _tag: "PgBossQueueOptionsError", options: ["partition", "policy"], queue: name });
		expect(error.message).toContain("partition, policy");
		expect(yield* Effect.promise(() => observer.getQueue(name))).toMatchObject({ expireInSeconds: 45, partition: false, policy: "standard" });
	},
);
