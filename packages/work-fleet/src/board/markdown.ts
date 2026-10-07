import { Effect, FileSystem, Layer, Path, Schema } from "effect";
import { metadataModel } from "@shivaedev/work-board/metadata/model.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { acknowledgeDecision } from "#board/acknowledgeDecision.ts";
import { decisionReading } from "#board/decisionReading.ts";
import { boundDocuments } from "#board/documents.ts";
import { publishBoard } from "#board/publish.ts";
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
			const get = Effect.fn("FleetBoard.get")(function* (workId: string) {
				const all = yield* documents;
				const matches = metadataModel(all).ids.get(workId);
				const found = matches?.length === 1 ? all.find((document) => document.file === matches[0]?.file) : undefined;
				if (!found) {
					return yield* Effect.fail(new BoardFailure({ message: `Board identity is missing or ambiguous: ${workId}` }));
				}
				return {
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
					const parsed = metadataParse(work.context);
					const relativeSource = path.relative(realRoot, work.sourcePath);
					if (
						work.workId !== workId
						|| work.revision !== revisionOf(work.context)
						|| parsed.fields.id !== workId
						|| parsed.diagnostics.length > 0
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
			});
		}),
	);
}
