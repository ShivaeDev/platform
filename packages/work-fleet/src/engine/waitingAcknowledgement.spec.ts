import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { settled, WAIT_EXIT } from "#host/waitOutcome.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("released work waits visibly on the orchestrator until its Board acknowledgement succeeds", () =>
	withEngine({ acknowledgeFailure: true, denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const ready = yield* fleet.reconcile("one");
			const decisionId = ready.value.decision?.id ?? "missing";
			const released = yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "release"));
			expect(released.value.stage).toBe("released");
			expect(released.value.attentionOwner).toBe("orchestrator");
			expect(views([released.value]).waiting.orchestrator).toMatchObject([{ stage: "released", workId: "one" }]);
			expect(settled("one", released.value)).toEqual({ code: WAIT_EXIT.released, summary: "one released (waiting on orchestrator)" });
			const closed = yield* fleet.reconcile("one");
			expect(closed.value.attentionOwner).toBeUndefined();
			expect(views([closed.value]).waiting.orchestrator).toEqual([]);
			expect(settled("one", closed.value)).toEqual({ code: WAIT_EXIT.released, summary: "one released" });
		}),
	));
