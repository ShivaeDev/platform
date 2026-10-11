import { Effect, FileSystem, Layer, Path, Schema } from "effect";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { acknowledgeDecision } from "#board/acknowledgeDecision.ts";
import { decisionReading } from "#board/decisionReading.ts";
import { boundDocuments, boundSnapshot, snapshotDocument } from "#board/documents.ts";
import { boardDiagnostics, fleetApproved, fleetDeliverable } from "#board/fleetField.ts";
import { publishBoard } from "#board/publish.ts";
import { publishReport } from "#board/publishReport.ts";
import { workMetadata } from "#board/readPass.ts";
import { BoardFailure, BoardGateway } from "#policy.ts";
import { RepositoryPath } from "#preparation/schema.ts";

export function markdownBoard(root: string) {
	return Layer.effect(
		BoardGateway,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const realRoot = yield* fs.realPath(root);
			const documents = boundDocuments(root, realRoot, fs, path);
			const snapshot = boundSnapshot(root, realRoot, fs, path);
			const get = Effect.fn("FleetBoard.get")(function* (workId: string) {
				const found = yield* snapshotDocument(yield* snapshot, workId);
				const deliverable = fleetDeliverable(found.parsed);
				if (deliverable !== undefined && deliverable !== "report") {
					return yield* Effect.fail(new BoardFailure({ message: "Invalid fleet-deliverable; use report or omit the field for pull requests." }));
				}
				return {
					approved: fleetApproved(found.parsed),
					areas: found.parsed.fields.areas,
					status: found.parsed.fields.status,
					...(deliverable === "report" ? { deliverable: "report" as const } : {}),
					context: found.source,
					dependsOn: (found.parsed.fields.relationships ?? [])
						.filter((relation) => relation.kind === "depends_on")
						.map((relation) => relation.target),
					revision: revisionOf(found.source),
					sourcePath: path.join(realRoot, found.file),
					workId,
				};
			});
			const publish = publishBoard(root, realRoot, documents);
			return BoardGateway.of({
				acknowledgeDecision: acknowledgeDecision(root, realRoot, documents),
				decision: Effect.fn("FleetBoard.decision")(function* (workId, input, originalContext) {
					const work = originalContext ?? (yield* get(workId));
					const parsed = yield* workMetadata(work);
					const relativeSource = path.relative(realRoot, work.sourcePath);
					if (
						work.workId !== workId
						|| work.revision !== revisionOf(work.context)
						|| parsed.fields.id !== workId
						|| boardDiagnostics(parsed).length > 0
						|| relativeSource === "."
						|| !Schema.is(RepositoryPath)(relativeSource)
					) {
						return yield* Effect.fail(
							new BoardFailure({ message: "The original Board publication context does not match its identity, revision or source boundary." }),
						);
					}
					return yield* publish(work, input);
				}),
				get,
				readDecision: decisionReading(realRoot, documents, get),
				report: publishReport(root, realRoot, documents),
			});
		}),
	);
}
