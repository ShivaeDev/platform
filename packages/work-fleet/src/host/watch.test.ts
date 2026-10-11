import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { storeState, withHost } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("work-fleet watch against PostgreSQL", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);

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
						yield* storeState(fixture.host, "a", { outcome: { evidence: ["All checks passed"] }, stage: "completed" });
						yield* untilOutput(follower, "a completed: All checks passed\n");
						expect(follower.output().trim().split("\n")).toEqual(["a completed: All checks passed"]);
						yield* storeState(fixture.host, "b", { decision: { reason: "Review failed\nPlease inspect\r\nthe diff" }, stage: "needs-human" });
						yield* untilOutput(follower, "b needs-human (waiting on orchestrator): Review failed Please inspect the diff\n");
						yield* storeState(fixture.host, "c", { stage: "released" });
						expect(yield* Effect.promise(() => follower.done)).toMatchObject({
							code: 0,
							stderr: "",
							stdout: "a completed: All checks passed\nb needs-human (waiting on orchestrator): Review failed Please inspect the diff\nc released",
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
				for (const [id, stage] of [
					["old", "completed"],
					["stuck", "needs-human"],
					["gone", "released"],
					["a", "executing"],
					["b", "prepared"],
				] as const) {
					yield* storeState(fixture.host, id, { stage });
				}
				yield* withFollower(
					fixture.configFile,
					"watch",
					[],
					{},
					Effect.fnUntraced(function* (follower) {
						yield* Effect.sleep("2 seconds");
						expect(follower.output()).toBe("");
						yield* storeState(fixture.host, "a", { stage: "released" });
						yield* untilOutput(follower, "a released\n");
						yield* storeState(fixture.host, "new", { stage: "executing" });
						yield* storeState(fixture.host, "b", { stage: "completed" });
						expect(yield* Effect.promise(() => follower.done)).toMatchObject({ code: 0, stdout: "a released\nb completed" });
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
				yield* storeState(fixture.host, "a", { stage: "released" });
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
				yield* storeState(fixture.host, "new", { stage: "released" });
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
