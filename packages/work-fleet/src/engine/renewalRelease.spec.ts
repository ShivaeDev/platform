import { describe, expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { FleetRecord } from "#model.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { prepared } from "#test/preparation.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("renewal after explicit safe release", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("released terminal work restarts a fresh scope without losing human receipts or the old PR", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const denied = yield* fleet.reconcile("one");
				const decisionId = denied.value.decision?.id ?? "missing";
				const responseId = fixture.respond(decisionId, "release");
				yield* fleet.resolve("one", decisionId, responseId);
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const renewed = yield* restarted.prepare({
							cwd: "/synthetic",
							preparation: prepared({ ownedPaths: ["src/renewed.ts"] }),
							prompt: "Continue work in a disjoint scope",
							workId: "one",
						});
						expect(renewed.value.history?.[0]?.stage).toBe("released");
						expect(renewed.value.history?.[0]?.responses?.[0]?.responseId).toBe(responseId);
						expect(renewed.value.responses).toBeUndefined();
						expect((yield* restarted.dispatch("one")).value.stage).toBe("executing");
						const overlap = restarted.prepare({
							cwd: "/synthetic",
							preparation: prepared({ ownedPaths: ["src/one.ts"] }),
							prompt: "Overlap old PR",
							workId: "two",
						});
						expect(yield* Effect.flip(overlap)).toMatchObject({ _tag: "StorageOwnershipConflict", owner: "https://example.invalid/pr/one" });
					}),
				);
			}),
		));
	test("a known rejected turn can renew without querying an unaccepted result", () =>
		withEngine({ rejectTurn: true, resultUnavailable: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const rejected = yield* fleet.dispatch("one");
				expect(rejected.value.attempts[0]?.status).toBe("failed");
				expect(rejected.value.attempts[0]?.receipt).toBeUndefined();
				const renewed = yield* prepareWork("one");
				expect(renewed.value.stage).toBe("prepared");
				expect(renewed.value.history?.[0]?.attempts[0]).toEqual(rejected.value.attempts[0]);
				expect(fixture.launched).toHaveLength(1);
			}),
		));
	it.effect("old stored records still decode without history or Board snapshots", function* () {
		const legacy = yield* Schema.decodeUnknownEffect(FleetRecord)({
			attempts: [],
			boardRevision: "legacy-board",
			cwd: "/synthetic",
			preparation: prepared(),
			prompt: "Legacy work",
			stage: "prepared",
			workId: "legacy",
		});
		expect(legacy.history).toBeUndefined();
		expect(legacy.boardContext).toBeUndefined();
		expect(legacy.boardSourcePath).toBeUndefined();
	});
});
