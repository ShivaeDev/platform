import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import type { AnswerInput, QuestionPreview } from "#browser/responses/schema.ts";
import { watchChanges } from "#server/files/changes.ts";
import { Responses } from "#server/Responses.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";
import { fullIndex } from "./fullIndex.ts";
import { incrementalIndex } from "./incrementalIndex.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function responseServiceVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const options = Layer.effect(
		WorkspaceConfig,
		Effect.gen(function* () {
			const changes = yield* watchChanges(engine.notes.root);
			return {
				changes,
				index: fullIndex(engine.notes.root).pipe(Effect.provide(NodeServices.layer)),
				root: engine.notes.root,
				writable: engine.responses,
			};
		}),
	);
	const service = Responses.layer.pipe(Layer.provideMerge(Workspace.layer), Layer.provide(options), Layer.provide(NodeServices.layer));
	return {
		answerThroughFullRefresh: (input: AnswerInput) => {
			tell(`a workspace whose changes offer only a full refresh saves an answer to ${input.item}/${input.request}`);
			return Effect.gen(function* () {
				const workspace = yield* incrementalIndex(engine.notes.root);
				const config = Layer.succeed(WorkspaceConfig, {
					changes: { ...workspace.changes, refresh: workspace.update() },
					index: workspace.read(),
					root: engine.notes.root,
					writable: engine.responses,
				});
				const answering = Responses.layer.pipe(Layer.provideMerge(Workspace.layer), Layer.provide(config), Layer.provide(NodeServices.layer));
				return yield* Effect.flatMap(Responses, (responses) => responses.answer(input)).pipe(Effect.provide(answering));
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer));
		},
		readHistory: (preview: QuestionPreview) => {
			tell(`the reader reads recorded history for ${preview.item}/${preview.request}`);
			return Effect.flatMap(Responses, (responses) => responses.history(preview)).pipe(Effect.provide(service));
		},
		readQuestionActions: (file: string) => {
			tell(`the reader reads the answer actions in ${file}`);
			return Effect.gen(function* () {
				const workspace = yield* Workspace;
				const document = yield* workspace.document(`/${file}`);
				return new Map(Object.entries(document.questionActions));
			}).pipe(Effect.provide(service));
		},
	};
}
