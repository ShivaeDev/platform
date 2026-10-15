import { relative } from "node:path";
import { Effect } from "effect";
import { board } from "@shivaedev/work-board/integration/board.ts";
import { responses } from "@shivaedev/work-board/integration/responses.ts";
import { briefRevision } from "#board/briefRevision.ts";
import type { BoardDocument } from "#board/documents.ts";
import { recordBoardSource, workMetadata } from "#board/readPass.ts";
import { reportContent } from "#board/reportContent.ts";
import { reportIdentity } from "#board/reportIdentity.ts";
import { workRevision } from "#board/workRevision.ts";
import { BoardFailure, type BoardWork } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";

const { metadataModel } = board;
const { publish, revisionOf } = responses;

export function publishReport(root: string, realRoot: string, documents: Effect.Effect<readonly BoardDocument[], BoardFailure>) {
	return Effect.fn("FleetBoard.report")(function* (work: BoardWork, observation: SessionObservation) {
		const all = yield* documents;
		const matches = metadataModel(all).ids.get(work.workId);
		const source = all.find((document) => document.file === relative(realRoot, work.sourcePath));
		const parsed = yield* workMetadata(work);
		if (
			matches?.length !== 1
			|| source?.parsed.fields.id !== work.workId
			|| parsed.fields.id !== work.workId
			|| parsed.diagnostics.length > 0
			|| briefRevision(source.parsed) !== workRevision(work.revision, work.context)
			|| workRevision(work.revision, work.context) !== briefRevision(parsed)
			|| observation.execution !== "completed"
			|| !observation.output.trim()
		) {
			return yield* Effect.fail(new BoardFailure({ message: "Report needs nonempty completed output and the exact current Board context." }));
		}
		const { itemId } = reportIdentity(work, observation.receipt);
		const content = yield* reportContent(work, observation);
		yield* publish(root, realRoot, itemId, content).pipe(
			Effect.mapError(() => new BoardFailure({ message: "The worker report could not be recorded on Board; retry the same completed attempt." })),
		);
		yield* recordBoardSource(realRoot, `responses/${itemId}.md`, content);
		return { itemId, receipt: observation.receipt, revision: revisionOf(content), sourcePath: `responses/${itemId}.md`, workRevision: work.revision };
	});
}
