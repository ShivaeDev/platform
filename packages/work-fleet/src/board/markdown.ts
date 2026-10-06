import { Effect, FileSystem, Layer, Path } from "effect";
import { listMarkdown } from "@shivaedev/work-board/files/list.ts";
import { markdownPath } from "@shivaedev/work-board/files/markdownPath.ts";
import { metadataModel } from "@shivaedev/work-board/metadata/model.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { publish } from "@shivaedev/work-board/responses/publish.ts";
import { questionFrom, questionId, questionMarkdown, revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { BoardFailure, BoardGateway } from "#policy.ts";

export function markdownBoard(root: string) {
	return Layer.effect(
		BoardGateway,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const realRoot = yield* fs.realPath(root);
			const documents = Effect.gen(function* () {
				const files = yield* listMarkdown(root, realRoot);
				return yield* Effect.forEach(files, (file) =>
					Effect.gen(function* () {
						const real = yield* markdownPath(root, realRoot, file.path);
						if (!real) {
							return yield* Effect.fail(new BoardFailure({ message: `Board source is unavailable: ${file.path}` }));
						}
						const source = yield* fs.readFileString(real);
						const parsed = metadataParse(source);
						if (parsed.diagnostics.length > 0) {
							return yield* Effect.fail(new BoardFailure({ message: `Board metadata is invalid: ${file.path}` }));
						}
						return { file: file.path, parsed, source };
					}),
				);
			}).pipe(
				Effect.mapError(() => new BoardFailure({ message: "Board sources could not be read completely." })),
				Effect.provideService(FileSystem.FileSystem, fs),
				Effect.provideService(Path.Path, path),
			);
			const get = Effect.fn("FleetBoard.get")(function* (workId: string) {
				const all = yield* documents;
				const model = metadataModel(all);
				const matches = model.ids.get(workId);
				if (matches?.length !== 1) {
					return yield* Effect.fail(new BoardFailure({ message: `Board identity is missing or ambiguous: ${workId}` }));
				}
				const found = all.find((document) => document.file === matches[0]?.file);
				if (!found) {
					return yield* Effect.fail(new BoardFailure({ message: `Board source is unavailable: ${workId}` }));
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
			return BoardGateway.of({
				decision: Effect.fn("FleetBoard.decision")(function* (workId, input) {
					const work = yield* get(workId);
					const context = `${work.context}\n\n## Fleet decision\n\n${input.reason}\n\nRecommendation: ${input.recommendation}\n${input.links.map((link) => `\nRelevant work: ${link}\n`).join("")}`;
					const revision = revisionOf(context);
					const id = questionId(workId, input.id, revision, work.sourcePath);
					const all = yield* documents;
					if (all.some((document) => questionFrom(document)?.id === id)) {
						return id;
					}
					const registeredAt = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
					const question = {
						context,
						id,
						question: {
							deadline: registeredAt + 48 * 60 * 60 * 1000,
							item: workId,
							reason: input.reason,
							registeredAt,
							request: input.id,
							reviewedRevision: revision,
							source: work.sourcePath,
						},
					};
					yield* publish(root, realRoot, id, questionMarkdown(question)).pipe(
						Effect.mapError(() => new BoardFailure({ message: "Fleet decision could not be recorded on Board." })),
					);
					return id;
				}),
				get,
			});
		}),
	);
}
