import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { prepared } from "#test/preparation.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("context-bound Fleet renewal", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("terminal context edits renew the same Board ID after restart without promoting old evidence", () =>
		withEngine({ noChange: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const first = yield* fleet.dispatch("one");
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const renewed = yield* restarted.prepare({
							cwd: "/synthetic",
							preparation: prepared({ ownedPaths: ["src/one.ts"], validation: [{ command: "new scoped validation", revision: "new-preparation" }] }),
							prompt: "Implement changed context",
							workId: "one",
						});
						expect(renewed.value.workId).toBe("one");
						expect(renewed.value.attempts).toEqual([]);
						expect(renewed.value.history?.[0]?.attempts[0]?.receipt).toEqual(first.value.attempts[0]?.receipt);
						expect(renewed.value.history?.[0]?.boardRevision).toBe("board-one");
						expect(renewed.value.history?.[0]?.decision).toBeDefined();
						expect(renewed.value.preparation.validation).toEqual([{ command: "new scoped validation", revision: "new-preparation" }]);
						expect(renewed.value.result).toBeUndefined();
						expect(renewed.value.review).toBeUndefined();
						expect(renewed.value.checks).toBeUndefined();
						expect(renewed.value.outcome).toBeUndefined();
						expect(renewed.value.decision).toBeUndefined();
						expect((yield* restarted.dispatch("one")).value.stage).toBe("executing");
					}),
				);
				expect(fixture.launched).toHaveLength(2);
			}),
		));
	for (const lostAcknowledgement of [false, true]) {
		test(`running or ambiguous submission cannot renew (lost acknowledgement ${lostAcknowledgement})`, () =>
			withEngine({ lostAcknowledgement }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					const submitted = yield* fleet.dispatch("one");
					expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ _tag: "FleetFailure", reason: "denied" });
					expect((yield* fleet.get("one")).value.attempts).toEqual(submitted.value.attempts);
					expect((yield* fleet.get("one")).value.history).toBeUndefined();
					expect(fixture.launched).toHaveLength(1);
				}),
			));
	}
	test("completed work renews only a newly approved context and preserves outcome, review and checks", () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const completed = yield* fleet.reconcile("one");
				expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ _tag: "FleetFailure", reason: "denied" });
				fixture.editWork("one", "board-one-next");
				expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ _tag: "FleetFailure", reason: "denied" });
				fixture.approveWork("one", "board-one-next");
				const renewed = yield* prepareWork("one");
				expect(renewed.value.stage).toBe("prepared");
				expect(renewed.value.history?.[0]?.outcome).toEqual(completed.value.outcome);
				expect(renewed.value.history?.[0]?.review).toEqual(completed.value.review);
				expect(renewed.value.history?.[0]?.checks).toEqual(completed.value.checks);
				expect(renewed.value.history?.[0]?.boardContext).toContain("board-one");
				expect(renewed.value.deliverySubmitted).toBeUndefined();
				expect(renewed.value.outcome).toBeUndefined();
			}),
		));
	test("archiving completed attempts does not reset fresh observed quota or permit historic acknowledgement", () =>
		withEngine({ quota: 2 }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const completed = yield* fleet.reconcile("one");
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				yield* prepareWork("one");
				const prior = completed.value.attempts[0];
				expect(
					yield* Effect.flip(fixture.acknowledgeTurn(prior?.operationId ?? "missing", prior?.receipt ?? { sessionId: "missing", turnId: "missing" })),
				).toMatchObject({ _tag: "SessionFailure", reason: "persistence" });
				expect(yield* Effect.flip(fleet.dispatch("one"))).toMatchObject({ _tag: "FleetFailure", reason: "denied" });
				expect(fixture.launched).toHaveLength(2);
				expect((yield* fleet.get("one")).value.attempts).toEqual([]);
			}),
		));
	test("an unresolved delivery submission cannot be archived into a new cycle", () =>
		withEngine({ deliveryFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const ambiguous = yield* fleet.reconcile("one");
				fixture.editWork("one", "board-one-next");
				fixture.approveWork("one", "board-one-next");
				expect(yield* Effect.flip(prepareWork("one"))).toMatchObject({ _tag: "FleetFailure", reason: "denied" });
				expect((yield* fleet.get("one")).value.deliverySubmitted).toBe(true);
				expect((yield* fleet.get("one")).value.attempts).toEqual(ambiguous.value.attempts);
				expect((yield* fleet.get("one")).value.history).toBeUndefined();
			}),
		));
	test("renewal conserves an adopted open PR reservation and blocks overlapping dispatch", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const denied = yield* fleet.reconcile("one");
				const renewed = yield* prepareWork("one");
				expect(renewed.value.history?.[0]?.resultObservations).toEqual([denied.value.result]);
				expect(renewed.value.history?.[0]?.result).toMatchObject({ kind: "change", pr: "https://example.invalid/pr/one" });
				expect((yield* fleet.dispatch("one")).value.stage).toBe("needs-human");
				expect(fixture.launched).toHaveLength(2);
				yield* prepareWork("two");
				expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
			}),
		));
});
