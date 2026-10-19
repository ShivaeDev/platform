import { Effect } from "effect";
import { closePublishedDecision, publishedDecision } from "#board/closePublishedDecision.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardSnapshot } from "#board/readPass.ts";
import type { ClosedDecision } from "#board/schema.ts";
import type { BoardFailure } from "#policy.ts";

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
		const closed: ClosedDecision[] = [];
		for (const document of current.documents) {
			const candidate = finishedDecision(current, document, options.workId, answered);
			if (candidate === undefined) {
				continue;
			}
			const { reason, workId } = candidate;
			if (!options.dryRun) {
				const updated = yield* closePublishedDecision(root, realRoot, document, reason);
				if (updated === undefined) {
					continue;
				}
			}
			closed.push({ reason, sourcePath: document.file, workId });
		}
		return closed;
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
	if (work === undefined || snapshot.problems.has(work.file) || !["done", "deferred", "superseded"].includes(status ?? "")) {
		return;
	}
	return { reason: `Closed because Board work ${decision.workId} is ${status}.`, workId: decision.workId };
}
