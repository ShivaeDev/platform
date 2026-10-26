import { Effect, Schema } from "effect";
import { type CodexConnection, request } from "#providers/codexRpc.ts";
import type { SessionFailure } from "#session/schema.ts";

const ThreadEvent = Schema.Struct({ threadId: Schema.String });

function moving(method: string) {
	return method.startsWith("item/") || method.startsWith("turn/") || method.startsWith("rawResponseItem/") || method === "thread/tokenUsage/updated";
}

export interface CodexActivity {
	readonly at: (sessionId: string) => number | undefined;
	readonly follow: (sessionId: string) => Effect.Effect<void, SessionFailure>;
	readonly forget: (sessionId: string) => void;
}

// Codex Cloud hides a running turn's items until the turn ends, so live notifications are the only sign that a long turn still moves.
export function codexLive(now: () => number) {
	const activity = new Map<string, number>();
	const followed = new WeakMap<CodexConnection, Set<string>>();
	function threads(connection: CodexConnection) {
		const known = followed.get(connection) ?? new Set<string>();
		followed.set(connection, known);
		return known;
	}
	function follow(connection: CodexConnection, timeoutMs: number, sessionId: string) {
		return threads(connection).has(sessionId)
			? Effect.void
			: request(connection, timeoutMs, "thread/resume", { excludeTurns: true, threadId: sessionId }).pipe(
					Effect.andThen(Effect.sync(() => threads(connection).add(sessionId))),
					Effect.asVoid,
				);
	}
	return {
		activity: (open: Effect.Effect<CodexConnection, SessionFailure>, timeoutMs: number): CodexActivity => ({
			at: (sessionId) => activity.get(sessionId),
			follow: (sessionId) => open.pipe(Effect.flatMap((connection) => follow(connection, timeoutMs, sessionId))),
			forget: (sessionId) => {
				activity.delete(sessionId);
			},
		}),
		followed: (connection: CodexConnection, sessionId: string) => {
			threads(connection).add(sessionId);
		},
		notified: (method: string, params: unknown) => {
			if (!moving(method)) {
				return;
			}
			const event = Schema.decodeUnknownOption(ThreadEvent)(params);
			if (event._tag === "Some") {
				activity.set(event.value.threadId, now());
			}
		},
	};
}
