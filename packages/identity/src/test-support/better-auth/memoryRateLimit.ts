import { Duration, Effect, Exit, Scope } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { memoryRateLimit } from "#server/better-auth/memoryRateLimit.ts";

const CAPACITY = 100_000;

export const rules = {
	"once per minute": { max: 1, window: 60 },
	"once per second": { max: 1, window: 1 },
	"twice per minute": { max: 2, window: 60 },
	"twice per ten seconds": { max: 2, window: 10 },
} as const;

type Rule = keyof typeof rules;

const keys = {
	"a new client": "new-client",
	alice: "alice",
	bob: "bob",
	"the newest client": `client-${CAPACITY - 1}`,
	"the oldest client": "client-0",
} as const;

type Client = keyof typeof keys;

export const buckets = storyKit({
	*create() {
		const scope = yield* Scope.make();
		yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
		return { elapsed: Duration.zero, scope, storage: yield* memoryRateLimit.pipe(Scope.provide(scope)) };
	},
	name: "auth memory rate-limit buckets",
	stages: ["requests"],
	verbs: (engine, story) => ({
		clockReaches: (time: Duration.Input) => {
			story.tell(`the clock reaches ${time}`);
			const target = Duration.fromInputUnsafe(time);
			const step = Duration.subtract(target, engine.elapsed);
			engine.elapsed = target;
			return TestClock.adjust(step);
		},
		closeScope: () => {
			story.tell("the scope that owns the buckets closes");
			return Scope.close(engine.scope, Exit.void);
		},
		request: (client: Client, rule: Rule = "twice per ten seconds") =>
			Effect.promise(async () => {
				story.tell(`${client} sends a request under the rule ${rule}`);
				const { allowed, retryAfter } = await engine.storage.consume(keys[client], rules[rule]);
				return allowed ? "allowed" : `retry after ${retryAfter} ${retryAfter === 1 ? "second" : "seconds"}`;
			}),
	}),
});

export function allowanceUsed(client: Client, rule: Rule) {
	return buckets.trait("requests", `${client} has used up her allowance under the rule ${rule}`, (engine) =>
		Effect.promise(async () => {
			for (let index = 0; index < rules[rule].max; index += 1) {
				await engine.storage.consume(keys[client], rules[rule]);
			}
		}),
	);
}

export const requestsAtZeroAndNine = buckets.trait(
	"requests",
	"alice made her two allowed requests at 0s and 9s under the rule twice per ten seconds",
	(engine) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => engine.storage.consume(keys.alice, rules["twice per ten seconds"]));
			yield* TestClock.adjust("9 seconds");
			engine.elapsed = Duration.seconds(9);
			yield* Effect.promise(() => engine.storage.consume(keys.alice, rules["twice per ten seconds"]));
		}),
);

export const atCapacity = buckets.trait(
	"requests",
	`${CAPACITY.toLocaleString("en")} clients, oldest first, each hold a bucket under the rule once per minute`,
	(engine) =>
		Effect.promise(async () => {
			for (let index = 0; index < CAPACITY; index += 1) {
				await engine.storage.consume(`client-${index}`, rules["once per minute"]);
			}
		}),
);
