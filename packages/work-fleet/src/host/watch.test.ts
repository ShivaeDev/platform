import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { withHost } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { storeState } from "#test/storeState.ts";

describe("work-fleet watch against PostgreSQL and HTTP", () => {
	const test = postgresTests("live");

	test("streams each selected outcome once, including late records and multiline details", function* () {
		yield* withHost(
			{},
			{},
			Effect.fnUntraced(function* (fixture) {
				yield* withFollower(
					fixture.configFile,
					"watch",
					["a", "b", "c", "a"],
					{},
					Effect.fnUntraced(function* (follower) {
						yield* storeState(fixture.host, "a", { outcome: { evidence: ["All checks passed"] }, stage: "done", step: "done" });
						yield* untilOutput(follower, "a done: All checks passed\n");
						expect(follower.output().trim().split("\n")).toEqual(["a done: All checks passed"]);
						yield* storeState(fixture.host, "b", {
							decision: { reason: "Review failed\nPlease inspect\r\nthe diff" },
							stage: "waiting",
							step: "waiting",
						});
						yield* untilOutput(follower, "b waiting (waiting on orchestrator): Review failed Please inspect the diff\n");
						yield* storeState(fixture.host, "c", { stage: "released", step: "released" });
						expect(yield* Effect.promise(() => follower.done)).toMatchObject({
							code: 0,
							stderr: "",
							stdout: "a done: All checks passed\nb waiting (waiting on orchestrator): Review failed Please inspect the diff\nc released",
						});
					}),
				);
			}),
		);
	});

	test("without IDs snapshots only active work", function* () {
		yield* withHost(
			{},
			{},
			Effect.fnUntraced(function* (fixture) {
				for (const [id, step] of [
					["old", "done"],
					["stuck", "waiting"],
					["gone", "released"],
					["a", "working"],
					["b", "queued"],
				] as const) {
					yield* storeState(fixture.host, id, { stage: step, step });
				}
				yield* withFollower(
					fixture.configFile,
					"watch",
					[],
					{},
					Effect.fnUntraced(function* (follower) {
						yield* Effect.promise(() => follower.ready);
						expect(follower.output()).toBe("");
						yield* storeState(fixture.host, "a", { stage: "released", step: "released" });
						yield* untilOutput(follower, "a released\n");
						yield* storeState(fixture.host, "new", { stage: "working", step: "working" });
						yield* storeState(fixture.host, "b", { stage: "done", step: "done" });
						expect(yield* Effect.promise(() => follower.done)).toMatchObject({ code: 0, stdout: "a released\nb done" });
					}),
				);
			}),
		);
	});

	test("timeout preserves printed outcomes", function* () {
		yield* withHost(
			{},
			{},
			Effect.fnUntraced(function* (fixture) {
				yield* storeState(fixture.host, "a", { stage: "released", step: "released" });
				yield* withFollower(
					fixture.configFile,
					"watch",
					["a", "unknown"],
					{ timeout: 0.2 },
					Effect.fnUntraced(function* (follower) {
						expect(yield* Effect.promise(() => follower.done)).toMatchObject({
							code: 4,
							stderr: "watch: timed out waiting for Fleet work",
							stdout: "a released",
						});
					}),
				);
			}),
		);
	});
	test("an empty active set exits without printing terminal records", function* () {
		yield* withHost(
			{},
			{},
			Effect.fnUntraced(function* (fixture) {
				yield* storeState(fixture.host, "new", { stage: "released", step: "released" });
				yield* withFollower(
					fixture.configFile,
					"watch",
					[],
					{},
					Effect.fnUntraced(function* (follower) {
						expect(yield* Effect.promise(() => follower.done)).toMatchObject({ code: 0, stdout: "" });
					}),
				);
			}),
		);
	});
});
