import { Context, Deferred, Effect, Exit, Layer, Scope } from "effect";
import { Backend } from "@shivaedev/agent/backend.ts";
import type { Receipt } from "@shivaedev/agent/run.ts";
import { ProcessSpawner } from "#adapters/process.ts";
import { Codex } from "#codex/service.ts";
import { codexLayer } from "#codexLayer.ts";
import { CodexConfig } from "#config.ts";
import { scriptedPeer } from "#test/scriptedPeer.ts";
export const codexState = Effect.fn("CodexStory.codexState")(function* () {
	const peer = yield* scriptedPeer();
	const callerScope = yield* Scope.make();
	yield* Effect.addFinalizer(() => Scope.close(callerScope, Exit.void));
	const adapterScope = yield* Scope.make();
	yield* Effect.addFinalizer(() => Scope.close(adapterScope, Exit.void));
	const toolStarted = yield* Deferred.make<void>();
	const blockTool = { value: false };
	const execute = Effect.fn("Story.execute")(function* (input: unknown) {
		yield* Deferred.succeed(toolStarted, undefined);
		if (blockTool.value) {
			return yield* Effect.never;
		}
		return { ok: true, text: JSON.stringify(input) };
	});
	const context = yield* Layer.buildWithScope(
		codexLayer.pipe(
			Layer.provide(
				Layer.succeed(CodexConfig)({
					requestTimeoutMs: 1000,
					tools: [{ description: "look up docs", execute, inputSchema: { type: "object" }, name: "lookup" }],
				}),
			),
			Layer.provide(Layer.succeed(ProcessSpawner)({ spawn: peer.spawn })),
		),
		adapterScope,
	);
	const runtime = Context.get(context, Codex);
	const backend = Context.get(context, Backend);
	const receipt: { value: Receipt | undefined } = { value: undefined };
	return { adapterScope, backend, blockTool, callerScope, peer, receipt, runtime, toolStarted };
});
export type CodexState = Effect.Success<ReturnType<typeof codexState>>;
