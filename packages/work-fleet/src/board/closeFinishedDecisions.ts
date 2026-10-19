import { Effect } from "effect";
import { closePublishedDecision, publishedDecision } from "#board/closePublishedDecision.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardSnapshot } from "#board/readPass.ts";
import type { ClosedDecision } from "#board/schema.ts";
import type { BoardFailure } from "#policy.ts";

// Each closure syncs its file and directory, so a sweep in sequence waits on every sync in turn.
const WRITE_CONCURRENCY = 16;

export interface CloseFinishedOptions {
	readonly dryRun?: boolean;
	readonly workId?: string;
}

export function closeFinishedDecisions(root: string, realRoot: string, snapshot: Effect.Effect<BoardSnapshot, BoardFailure>) {
	return Effect.fn("FleetBoard.closeFinishedDecisions")(function* (options: CloseFinishedOptions = {}) {
		const current = yield* snapshot;
		const questions = new Map(
			current.documents.flatMap(({ parsed }) =>
				parsed.fields.question && parsed.fields.id ? [[parsed.fields.id, parsed.fields.question.source] as const] : [],
			),
		);
		const answered = new Set(
			current.documents.flatMap(({ parsed }) => (parsed.fields.response?.type === "answer" ? [questions.get(parsed.fields.response.question)] : [])),
		);
		const candidates = current.documents.flatMap((document) => {
			const candidate = finishedDecision(current, document, options.workId, answered);
			return candidate === undefined ? [] : [{ decision: { ...candidate, sourcePath: document.file } satisfies ClosedDecision, document }];
		});
		if (options.dryRun) {
			return candidates.map(({ decision }) => decision);
		}
		const closed = yield* Effect.forEach(
			candidates,
			({ decision, document }) =>
				closePublishedDecision(root, realRoot, document, decision.reason).pipe(Effect.map((updated) => (updated === undefined ? [] : [decision]))),
			{ concurrency: WRITE_CONCURRENCY },
		);
		return closed.flat();
	});
}

function finishedDecision(snapshot: BoardSnapshot, document: BoardDocument, workId: string | undefined, answered: ReadonlySet<string | undefined>) {
	const decision = publishedDecision(document);
	if (
		decision === undefined
		|| decision.request.state !== "open"
		|| snapshot.problems.has(document.file)
		|| (workId !== undefined && decision.workId !== workId)
		|| (workId === undefined && answered.has(document.file))
	) {
		return;
	}
	const matches = snapshot.model.ids.get(decision.workId);
	const work = matches?.length === 1 ? snapshot.files.get(matches[0]?.file ?? "") : undefined;
	const status = work?.parsed.fields.status;
	if (work === undefined || snapshot.problems.has(work.file) || !["done", "deferred", "superseded", "dropped"].includes(status ?? "")) {
		return;
	}
	return { reason: `Closed because Board work ${decision.workId} is ${status}.`, workId: decision.workId };
}
