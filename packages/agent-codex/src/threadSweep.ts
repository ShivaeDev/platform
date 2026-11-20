import { Effect, Option, Schema } from "effect";
import type { ReadFailure as BackendFailure } from "@shivaedev/agent/failures.ts";
import { codexFailure } from "#codexFailure.ts";
import { ThreadListResponse, type ThreadStatus } from "#protocol.ts";

type Request = (method: string, params: unknown) => Effect.Effect<unknown, BackendFailure>;

export interface SpawnedChild {
	readonly agentNickname: string | undefined;
	readonly agentPath: string | undefined;
	readonly agentRole: string | undefined;
	readonly parentThreadId: string;
	readonly threadId: string;
	readonly working: boolean;
}

export type CensusSweep = readonly SpawnedChild[];

// Codex caps thread-list pages at 100 rows.
const PAGE = 100;
const PAGES = 200;

const decodeListing = Schema.decodeUnknownOption(ThreadListResponse);

function named(value: string | null | undefined): string | undefined {
	return value === null ? undefined : value;
}

function isWorking(status: typeof ThreadStatus.Type): boolean {
	return status.type === "active";
}

function childrenOf(listed: typeof ThreadListResponse.Type): readonly SpawnedChild[] {
	return listed.data.map((thread) => {
		const spawn = thread.source.subAgent.threadSpawn;
		return {
			agentNickname: named(spawn.agentNickname),
			agentPath: named(spawn.agentPath),
			agentRole: named(spawn.agentRole),
			parentThreadId: spawn.parentThreadId,
			threadId: thread.id,
			working: isWorking(thread.status),
		};
	});
}

// Codex thread/list with ancestorThreadId returns the descendant tree without attaching to it.
export const sweepSpawnedDescendants = Effect.fn("Codex.sweepSpawnedDescendants")(function* (
	request: Request,
	rootThreadId: string,
): Effect.fn.Return<CensusSweep, BackendFailure> {
	const found = new Map<string, SpawnedChild>();
	const cursors = new Set<string>();
	let cursor: string | undefined;
	for (let page = 0; page < PAGES; page += 1) {
		const response = yield* request("thread/list", {
			ancestorThreadId: rootThreadId,
			...(cursor === undefined ? {} : { cursor }),
			limit: PAGE,
		});
		const decoded = decodeListing(response);
		if (Option.isNone(decoded)) {
			return yield* Effect.fail(codexFailure("it answered in a shape this backend cannot read"));
		}
		for (const child of childrenOf(decoded.value)) {
			found.set(child.threadId, child);
		}
		const nextCursor = named(decoded.value.nextCursor);
		if (nextCursor === undefined) {
			return [...found.values()];
		}
		if (cursors.has(nextCursor)) {
			return yield* codexFailure("Repeated descendant pagination cursor");
		}
		cursors.add(nextCursor);
		cursor = nextCursor;
	}
	return yield* Effect.fail(codexFailure("its listing of this session's threads never ended"));
});
