import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { abortableRpc } from "#test/app-host/abortableRpc.ts";
import { hostOptions } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const cancellation = storyKit(hostOptions({ database: true }));

cancellation.it(
	"the browser aborting a held transaction interrupts its handler, rolls back its row and frees the only pool connection",
	[abortableRpc("transaction")],
	function* ({ browserAborts, connectionStates, handlerEnding, holdTransaction, storedRows }) {
		yield* holdTransaction();
		expect(yield* connectionStates()).toEqual(["idle in transaction"]);

		yield* browserAborts();

		yield* outcomes({
			"handler ending": [handlerEnding(), "interrupted"],
			"rows read over the freed connection": [storedRows(), []],
		});
	},
);

cancellation.it(
	"the browser aborting a live subscription interrupts its stream and releases its Reactivity registrations",
	[abortableRpc("subscription")],
	function* ({ browserAborts, handlerEnding, openWatch, subscriptionRegistrations }) {
		yield* openWatch();
		expect(yield* subscriptionRegistrations()).toEqual([["abort_items"], ["a resync key"]]);

		yield* browserAborts();

		yield* outcomes({
			"handler ending": [handlerEnding(), "interrupted"],
			registrations: [subscriptionRegistrations(), []],
		});
	},
);

cancellation.it(
	"a commit after the browser aborts a subscription is stored but no longer notifies it",
	[abortableRpc("subscription")],
	function* ({ browserAborts, commitChange, nextHint, openWatch, storedRows, subscriptionCallbacks }) {
		yield* openWatch();
		yield* commitChange();
		expect(yield* nextHint()).toBe("changed");
		yield* browserAborts();
		const notified = yield* subscriptionCallbacks();

		yield* commitChange();

		yield* outcomes({
			"stored rows": [storedRows(), ["committed", "committed"]],
			"subscription callbacks": [subscriptionCallbacks(), notified],
		});
	},
);

for (const [mode, method] of [
	["transaction", "hold"],
	["subscription", "watch"],
] as const) {
	cancellation.it(
		`the browser aborting the ${method} RPC logs one Debug interruption with its request ID, redacted payload and duration, and no failure`,
		[abortableRpc(mode)],
		function* ({ browserAborts, failureLogs, holdTransaction, interruptionLogs, logMentions, openWatch }) {
			yield* mode === "transaction" ? holdTransaction() : openWatch();

			yield* browserAborts();

			yield* outcomes({
				"failure logs": [failureLogs(), []],
				"interruption logs": [
					interruptionLogs(),
					[
						{
							annotations: { requestId: `abort-${method}`, "rpc.method": method, "rpc.payload": { password: "<redacted>" } },
							duration: "recorded",
							level: "Debug",
						},
					],
				],
				"leaked secrets": [logMentions("abort-secret"), []],
			});
		},
	);

	cancellation.it(
		`the browser aborting the ${method} RPC marks only its server span interrupted, with its request ID and an unset status`,
		[abortableRpc(mode), collector()],
		function* ({ browserAborts, close, commitChange, completedRpc, holdTransaction, openWatch, rpcSpanMarks, serverSpan }) {
			yield* mode === "transaction" ? holdTransaction() : openWatch();

			yield* browserAborts();
			yield* mode === "transaction" ? completedRpc() : commitChange();

			yield* close();

			yield* outcomes({
				"aborted span": [
					serverSpan(method),
					expect.objectContaining({ attributes: expect.objectContaining({ "request.id": `abort-${method}` }), status: "unset" }),
				],
				"span marks": [
					rpcSpanMarks(),
					mode === "transaction" ? { hold: "interrupted", rows: "completed" } : { commit: "completed", watch: "interrupted" },
				],
			});
		},
	);
}
