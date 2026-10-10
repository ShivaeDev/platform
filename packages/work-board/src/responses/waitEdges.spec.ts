import { Clock, Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { ResponseFailed } from "#browser/responses/schema.ts";
import { waitForResponse } from "#responses/waitFor.ts";
import { recordedEdgeResponse, responseWorkspace } from "#test/responseEdges.ts";
import { waitReplies } from "#test/waitReplies.ts";

let workspace: Awaited<ReturnType<typeof responseWorkspace>>;
afterEach(async () => workspace?.stop());

it("preserves a nonretryable external RPC rejection without polling it again", async () => {
	const failure = new ResponseFailed({ code: "Conflict", message: "The registered question identity is ambiguous; response history is unknown." });
	const rpc = waitReplies([Effect.fail(failure)]);
	await expect(Effect.runPromise(waitForResponse(rpc.read, () => undefined))).rejects.toMatchObject({ code: failure.code, message: failure.message });
	expect(rpc.calls()).toBe(1);
});

it("reconnects after repeated external service failures and reports one outage before the reply arrives", async () => {
	workspace = await responseWorkspace();
	const question = await workspace.register();
	const response = recordedEdgeResponse(question);
	const unavailable = Effect.fail(new ResponseFailed({ code: "Unavailable", message: "The workspace could not be indexed." }));
	const rpc = waitReplies([
		unavailable,
		unavailable,
		Effect.succeed({ expired: false, question }),
		Effect.succeed({ expired: false, question, response }),
	]);
	const diagnostics: string[] = [];
	expect(await Effect.runPromise(waitForResponse(rpc.read, (text) => diagnostics.push(text)))).toEqual({ kind: "response", question, response });
	expect(rpc.calls()).toBe(4);
	expect(diagnostics).toEqual(["Local service unavailable; reconnecting to the same question."]);
});

it("does not invent an unanswered verdict when transport fails after the known durable deadline", async () => {
	workspace = await responseWorkspace();
	const registered = await workspace.register();
	const question = { ...registered, question: { ...registered.question, deadline: Effect.runSync(Clock.currentTimeMillis) - 1 } };
	const rpc = waitReplies([
		Effect.succeed({ expired: false, question }),
		Effect.fail(new ResponseFailed({ code: "Unavailable", message: "Connection lost." })),
	]);
	await expect(Effect.runPromise(waitForResponse(rpc.read, () => undefined))).rejects.toThrow(
		"The service is unavailable at the deadline; unanswered status could not be verified. Re-read this question when it returns.",
	);
	expect(rpc.calls()).toBe(2);
});
