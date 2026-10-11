import { relative } from "node:path";
import { Effect } from "effect";
import { metadataModel } from "@shivaedev/work-board/metadata/model.ts";
import { publish } from "@shivaedev/work-board/responses/publish.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import type { BoardDocument } from "#board/documents.ts";
import { recordBoardSource } from "#board/readPass.ts";
import { BoardFailure, type BoardWork } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";

export function publishReport(root: string, realRoot: string, documents: Effect.Effect<readonly BoardDocument[], BoardFailure>) {
	return Effect.fn("FleetBoard.report")(function* (work: BoardWork, observation: SessionObservation) {
		const all = yield* documents;
		const matches = metadataModel(all).ids.get(work.workId);
		const source = all.find((document) => document.file === relative(realRoot, work.sourcePath));
		if (
			matches?.length !== 1
			|| source?.parsed.fields.id !== work.workId
			|| revisionOf(source.source) !== work.revision
			|| work.revision !== revisionOf(work.context)
			|| observation.execution !== "completed"
			|| !observation.output.trim()
		) {
			return yield* Effect.fail(new BoardFailure({ message: "Report needs nonempty completed output and the exact current Board context." }));
		}
		const provenance = { ...observation.receipt, workRevision: work.revision };
		const itemId = `fleet-report.${revisionOf(JSON.stringify({ workId: work.workId, ...provenance }))}`;
		const metadata = { id: itemId, kind: "result", relationships: [{ kind: "informs", target: work.workId }] };
		const content = `---\n${JSON.stringify(metadata)}\n---\n# Fleet report\n\n## Worker receipt\n\n\`\`\`json\n${JSON.stringify(provenance)}\n\`\`\`\n\n## Report\n\n${observation.output}`;
		if (new TextEncoder().encode(content).length > 256 * 1024) {
			return yield* Effect.fail(
				new BoardFailure({
					message: "Worker report exceeds Board’s 256 KiB context limit, including metadata and receipt; request a shorter report before retrying.",
				}),
			);
		}
		yield* publish(root, realRoot, itemId, content).pipe(
			Effect.mapError(() => new BoardFailure({ message: "The worker report could not be recorded on Board; retry the same completed attempt." })),
		);
		yield* recordBoardSource(realRoot, `responses/${itemId}.md`, content);
		return { itemId, receipt: observation.receipt, revision: revisionOf(content), sourcePath: `responses/${itemId}.md`, workRevision: work.revision };
	});
}
