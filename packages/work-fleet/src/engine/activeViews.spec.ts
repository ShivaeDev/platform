import { Effect } from "effect";
import { expect } from "vitest";
import { occupiedBacklogConfiguration, unknownProviderQuotaConfiguration } from "#test/activeViewsTraits.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { humanMergeRequired, oneExecutionSlot } from "#test/engineTraits.ts";

const occupiedBacklog = engineConfiguration("occupied backlog", occupiedBacklogConfiguration());

const unknownProviderQuota = engineConfiguration("unknown provider quota", unknownProviderQuotaConfiguration());

for (const type of ["clarify", "not_now"] as const) {
	isolatedEngine.it(
		`native Orchestrator waiting query shows ${type} response blockers while retaining its decision`,
		[humanMergeRequired()],
		function* ({ rpcDispatch, rpcReconcileRequest, rpcResolve, rpcViews, finishWorkers, prepareWork, respond }) {
			yield* prepareWork("one");
			yield* rpcDispatch("one");
			finishWorkers();
			const denied = yield* rpcReconcileRequest({ workId: "one" });
			const decisionId = denied.decision?.id ?? "missing";
			const responseId = respond(decisionId, "retry", type);
			yield* rpcResolve({ decisionId, responseId, workId: "one" });
			const item = (yield* rpcViews()).waiting.orchestrator[0];
			expect(item?.stage).toBe("waiting");
			expect(item?.blocker).toBe(type === "clarify" ? `Human requested clarification: ${responseId}` : `Human deferred this decision: ${responseId}`);
			expect(item?.decision?.reason).toBe(denied.decision?.reason);
			expect(item?.decision?.reason).not.toBe(item?.blocker);
		},
	);
}

isolatedEngine.it(
	"native Automation waiting query exposes backlog admission blockers with the prepared step",
	[occupiedBacklog],
	function* ({ rpcDispatch, rpcViews, prepareWork }) {
		yield* prepareWork("one");
		yield* rpcDispatch("one").pipe(Effect.result);
		const item = (yield* rpcViews()).waiting.automation[0];
		expect(item?.stage).toBe("waiting");
		expect(item?.blocker).toBe("backlog capacity is occupied (limit 1)");
		expect(item?.sessions).toEqual([]);
	},
);

isolatedEngine.it(
	"native Automation waiting query exposes the exact quota admission blocker",
	[unknownProviderQuota],
	function* ({ rpcDispatch, rpcViews, prepareWork }) {
		yield* prepareWork("one");
		yield* rpcDispatch("one").pipe(Effect.result);
		const result = yield* rpcViews();
		expect(result.waiting.automation[0]?.stage).toBe("waiting");
		expect(result.waiting.automation[0]?.blocker).toBe("Fresh available provider quota is required");
	},
);

isolatedEngine.it(
	"native Automation waiting query preserves dependency blockers without preventing unrelated dispatch",
	[],
	function* ({ rpcDispatch, rpcViews, prepareWork }) {
		yield* prepareWork("dependent");
		yield* prepareWork("two");
		yield* rpcDispatch("dependent").pipe(Effect.result);
		yield* rpcDispatch("two");
		const result = yield* rpcViews();
		expect(result.waiting.automation.find((item) => item.workId === "dependent")?.blocker).toContain(
			"dependency one: not done on the Board; no accepted outcome",
		);
		expect(result.waiting.orchestrator).toEqual([]);
		expect(result.active.find((item) => item.workId === "two")?.stage).toBe("working");
	},
);

isolatedEngine.it(
	"native Active query clears capacity blockers after successful replacement admission",
	[oneExecutionSlot],
	function* ({ rpcDispatch, rpcReconcileRequest, rpcViews, finishWorkers, prepareWork }) {
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* rpcDispatch("one");
		yield* rpcDispatch("two").pipe(Effect.result);
		expect((yield* rpcViews()).waiting.automation.find((item) => item.workId === "two")?.blocker).toContain(
			"execution capacity is occupied (limit 1)",
		);
		finishWorkers();
		yield* rpcReconcileRequest({ workId: "one" });
		yield* rpcDispatch("two");
		const result = yield* rpcViews();
		expect(result.completed.find((item) => item.workId === "one")?.outcome).toBeDefined();
		expect(result.active.find((item) => item.workId === "two")?.stage).toBe("working");
		expect(result.active.find((item) => item.workId === "two")?.blocker).toBeUndefined();
	},
);

isolatedEngine.it(
	"native Maintainer waiting query prioritizes its concrete decision over previous admission failure",
	[],
	function* ({ rpcDispatch, rpcViews, editWork, prepareWork }) {
		yield* prepareWork("dependent");
		yield* rpcDispatch("dependent").pipe(Effect.result);
		editWork("dependent", "changed-context");
		yield* rpcDispatch("dependent");
		const item = (yield* rpcViews()).waiting.maintainer[0];
		expect(item?.stage).toBe("waiting");
		expect(item?.blocker).toBe("Work is no longer approved");
		expect(item?.decision?.reason).toBe(item?.blocker);
	},
);
