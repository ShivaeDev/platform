import type { Effect } from "effect";
import type { CodexCloudConfiguration } from "#providers/codexCloud.ts";
import type { SessionService } from "#session/service.ts";
import type { captureLogs } from "#test/captureLogs.ts";
import { WireRejection, type WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import { receipt, type sessionPersistence } from "#test/sessionPersistence.ts";

export interface ProviderSessionState {
	cloud: boolean;
	logs: ReturnType<typeof captureLogs>;
	metadata: boolean;
	mutations: { method: string; attempts: Effect.Success<Effect.Success<typeof sessionPersistence>["read"]> }[];
	nameFailure: "rejected" | "timeout" | undefined;
	options: Partial<CodexCloudConfiguration>;
	persistence: Effect.Success<typeof sessionPersistence> | undefined;
	reply: (request: WireRequest) => unknown;
	requests: WireRequest[];
	sessions: typeof SessionService.Service | undefined;
}
export function metadataReply(state: ProviderSessionState, request: WireRequest): unknown {
	switch (request.method) {
		case "thread/start":
			return { thread: { id: receipt.sessionId } };
		case "thread/read":
			return cloudThread();
		case "turn/start":
			return { turn: { id: receipt.turnId } };
		case "thread/name/set":
			if (state.nameFailure === "timeout") {
				return undefined;
			}
			if (state.nameFailure === "rejected") {
				return new WireRejection("Name rejected");
			}
			return {};
		default:
			return state.reply(request);
	}
}
