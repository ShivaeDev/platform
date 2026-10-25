import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";

engine.it(
	"commands and queries preserve exact session receipts and decision details",
	[humanMergeRequired()],
	function* ({ rpcPrepare, rpcDispatch, rpcReconcile, rpcViews, rpcResolve, rpcGet, finishWorkers, respond }) {
		yield* rpcPrepare({
			cwd: "/synthetic",
			preparation: prepared({ ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
			prompt: "Implement one",
			workId: "one",
		});
		const dispatched = yield* rpcDispatch("one");
		expect(dispatched.attempts[0]?.receipt).toEqual({ sessionId: "session-operation-1", turnId: "turn-operation-1" });
		finishWorkers();
		yield* rpcReconcile("one");
		const view = yield* rpcViews();
		expect(view.waiting.orchestrator[0]?.sessions).toHaveLength(2);
		expect(view.waiting.orchestrator[0]?.decision?.recommendation).toContain("Merge the reviewed, green PR");
		const decisionId = view.waiting.orchestrator[0]?.decision?.id ?? "missing";
		const responseId = respond(decisionId, "release");
		const released = yield* rpcResolve({ decisionId, responseId, workId: "one" });
		expect(released.step).toBe("released");
		expect((yield* rpcGet("one")).step).toBe("released");
	},
);
