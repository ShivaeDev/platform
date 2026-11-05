import { Effect, Exit, Scope } from "effect";
import { TestClock } from "effect/testing";
import { codexDelivery } from "#test/codexDelivery.ts";
import { codexObservations } from "#test/codexObservations.ts";
import type { CodexState } from "#test/codexState.ts";
export function codexVerbs(state: CodexState, tell: (line: string) => void) {
	return {
		...codexDelivery(state, tell),
		...codexObservations(state),
		anotherOperationCompleted: () => Effect.sync(() => state.peer.anotherOperationCompleted()),
		callTool: (threadId?: string) => Effect.sync(() => state.peer.tool(threadId)),
		clearProviderHistory: () => Effect.sync(() => state.peer.clearHistory()),
		closeAdapter: () => Scope.close(state.adapterScope, Exit.void),
		closeSession: () => Scope.close(state.callerScope, Exit.void),
		duplicateOperation: () => Effect.sync(() => state.peer.duplicateOperation()),
		finish: () => Effect.sync(() => state.peer.finish("turn-1")),
		notify: (method: string, params: unknown) => Effect.sync(() => state.peer.notify(method, params)),
		processEvents: () => Effect.sync(() => [...state.peer.processEvents]),
		providerExit: () => Effect.sync(() => state.peer.exit()),
		requestTimeoutPasses: () => TestClock.adjust("1001 millis"),
		secondPasses: () => TestClock.adjust("1234 millis"),
		sendItem: (item: unknown) => Effect.sync(() => state.peer.item(item)),
		serverRequest: (method: string, params: unknown) => Effect.sync(() => state.peer.serverRequest(method, params)),
	};
}
