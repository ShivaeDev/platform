import { expect } from "@effect/vitest";
import { views } from "#engine/views.ts";
import { settled, WAIT_EXIT } from "#host/waitOutcome.ts";
import { boardAcknowledgementFailsOnce } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired } from "#test/engineTraits.ts";

engine.it(
	"released work waits visibly on the orchestrator until its Board acknowledgement succeeds",
	[boardAcknowledgementFailsOnce(), humanMergeRequired()],
	function* ({ fleet, prepareWork, finishWorkers, respond }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const ready = yield* fleet.reconcile("one");
		const decisionId = ready.value.decision?.id ?? "missing";
		const released = yield* fleet.resolve("one", decisionId, respond(decisionId, "release"));
		expect(released.value.step).toBe("released");
		expect(released.value.attentionOwner).toBe("orchestrator");
		expect(views([released.value]).waiting.orchestrator).toMatchObject([{ stage: "released", workId: "one" }]);
		expect(settled("one", released.value)).toEqual({ code: WAIT_EXIT.released, summary: "one released (waiting on orchestrator)" });
		const closed = yield* fleet.reconcile("one");
		expect(closed.value.attentionOwner).toBeUndefined();
		expect(views([closed.value]).waiting.orchestrator).toEqual([]);
		expect(settled("one", closed.value)).toEqual({ code: WAIT_EXIT.released, summary: "one released" });
	},
);
