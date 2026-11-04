import { Deferred, Effect, Exit, Scope } from "effect";
import type { Receipt } from "@shivaedev/agent/run.ts";
import { engine } from "#adapters/engine.ts";
import { scriptedPeer } from "#test/scriptedPeer.ts";
export const codexState = Effect.fn("CodexStory.codexState")(function* () {
	const peer = yield* scriptedPeer();
	const callerScope = yield* Scope.make();
	yield* Effect.addFinalizer(() => Scope.close(callerScope, Exit.void));
	const toolStarted = yield* Deferred.make<void>();
	const blockTool = { value: false };
	const execute = Effect.fn("Story.execute")(function* (input: unknown) {
		yield* Deferred.succeed(toolStarted, undefined);
		if (blockTool.value) {
			return yield* Effect.never;
		}
		return { ok: true, text: JSON.stringify(input) };
	});
	const runtime = yield* engine(
		{ requestTimeoutMs: 1000, tools: [{ description: "look up docs", execute, inputSchema: { type: "object" }, name: "lookup" }] },
		peer.spawn,
	);
	const backend = yield* runtime.backend();
	const receipt: { value: Receipt | undefined } = { value: undefined };
	return { backend, blockTool, callerScope, peer, receipt, runtime, toolStarted };
});
export type CodexState = Effect.Success<ReturnType<typeof codexState>>;
