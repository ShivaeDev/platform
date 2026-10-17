import { describe, expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { FleetRecord } from "#model.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

describe("renewal after explicit safe release", () => {
	const test = postgresTests("test");
	test("released terminal work restarts a fresh scope without losing human receipts or the old PR backlog", () =>
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
				expect(renewed.value.history?.[0]?.attempts[0]).toEqual({ ...rejected.value.attempts[0], sessionCleanupComplete: true });
				expect(fixture.launched).toHaveLength(1);
			}),
		));
	for (const changed of ["scope", "cwd"] as const) {
		test(`a prepared retry renews ownership when its ${changed} changes`, () =>
			withEngine({ rejectTurn: true, resultUnavailable: true }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					const rejected = yield* fleet.dispatch("one");
					const decisionId = rejected.value.decision?.id ?? "missing";
					const retried = yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "retry"));
					expect(retried.value.stage).toBe("prepared");
					const renewed = yield* fleet.prepare({
						cwd: changed === "cwd" ? "/different-repository" : retried.value.cwd,
						preparation: changed === "scope" ? prepared({ ownedPaths: ["src/other.ts"] }) : retried.value.preparation,
						prompt: retried.value.prompt,
						workId: "one",
					});
					expect(renewed.value.attempts).toEqual([]);
					expect(renewed.value.history?.[0]?.attempts[0]).toEqual({ ...retried.value.attempts[0], sessionCleanupComplete: true });
					expect(renewed.value.history?.[0]?.responses).toEqual(retried.value.responses);
					expect(fixture.launched).toHaveLength(1);
				}),
			));
	}
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
