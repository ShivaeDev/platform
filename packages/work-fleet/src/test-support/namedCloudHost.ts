import { Schema } from "effect";
import type { Attempt, FleetRecord } from "#model.ts";
import { WireRejection, type WireRequest } from "#test/codex.ts";
import { cloudThread, SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { prepared } from "#test/preparation.ts";

const Params = Schema.Struct({ name: Schema.optional(Schema.String), threadId: Schema.String });
export function namedRecord(workId: string, attempts: readonly Attempt[], context = "# Readable title"): FleetRecord {
	return {
		attempts,
		boardContext: context,
		boardRevision: "synthetic-revision",
		cwd: SYNTHETIC_WORKSPACE,
		preparation: prepared(),
		prompt: "Synthetic work",
		stage: "working",
		step: "working",
		workId,
	};
}
export function namedAttempt(role: Attempt["role"], sessionId?: string): Attempt {
	return {
		operationId: `synthetic-${role}`,
		role,
		...(sessionId === undefined ? {} : { sessionId }),
		status: "submitting",
		submittedAt: 1,
	};
}

function threadMetadata(request: WireRequest, names: Map<string, string | null>, failures: ReadonlySet<string>) {
	const params = Schema.decodeUnknownSync(Params)(request.params);
	if (failures.has(`${request.method}:${params.threadId}`)) {
		return new WireRejection("Synthetic naming failure");
	}
	if (request.method === "thread/name/set") {
		names.set(params.threadId, params.name ?? null);
		return {};
	}
	return { thread: { ...cloudThread().thread, id: params.threadId, name: names.get(params.threadId) ?? null } };
}

export function namingBackend() {
	const names = new Map<string, string | null>();
	const failures = new Set<string>();
	const requests: WireRequest[] = [];
	return {
		failures,
		handle(request: WireRequest) {
			requests.push(request);
			if (request.method === "thread/start") {
				const id = `synthetic-session-${names.size}`;
				names.set(id, null);
				return { thread: { id } };
			}
			if (request.method === "thread/read" || request.method === "thread/name/set") {
				return threadMetadata(request, names, failures);
			}
			return request.method === "turn/start" ? { turn: { id: "synthetic-turn" } } : {};
		},
		names,
		requests,
	};
}
