import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { askWorker } from "#test/workerQuestion.ts";

it.effect.skipIf(storageDatabaseUrl === undefined)(
	"continuation archives owner and supersession receipts without copying them into the new cycle",
	() =>
		withEngine({ acknowledgeFailure: true }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const old = yield* askWorker(fixture);
				const reassigned = yield* fleet.reassign("one", old.decision.id, "maintainer");
				expect(reassigned.value.blocker).toContain("Board request acknowledgement pending");
				const continued = yield* fleet.continue("one", "Continue the current work");
				expect(continued.value.attentionOwner).toBeUndefined();
				expect(continued.value.supersededDecisions).toBeUndefined();
				expect(continued.value.history?.[0]).toMatchObject({
					attentionOwner: "maintainer",
					decision: { attentionOwner: "maintainer", id: reassigned.value.decision?.id },
					supersededDecisions: [{ published: old.published }],
				});
				const reconciled = yield* fleet.reconcile("one");
				expect(reconciled.value.history?.[0]?.supersededDecisions?.[0]?.boardAcknowledged).toBe(true);
				expect(reconciled.value.history?.[0]?.decisionAcknowledged).toBe(true);
				expect(fixture.acknowledgements).toHaveLength(2);
				expect(fixture.acknowledgements.filter((acknowledgement) => acknowledgement.decision.request === old.decision.id)).toHaveLength(1);
			}),
		),
);
