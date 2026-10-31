import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Responses } from "#server/Responses.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";
import { incrementalIndex } from "./incrementalIndex.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function responseServiceVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		answerThroughFullRefresh: (id: string, body: string) => {
			tell(`a workspace whose changes offer only a full refresh saves ${id} for task.choice/direction`);
			const { client } = served(engine);
			return Effect.gen(function* () {
				const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "task.choice", request: "direction" })));
				const workspace = yield* incrementalIndex(engine.notes.root);
				const config = Layer.succeed(WorkspaceConfig, {
					changes: { ...workspace.changes, refresh: workspace.update() },
					index: workspace.read(),
					root: engine.notes.root,
					writable: engine.responses,
				});
				const answering = Responses.layer.pipe(Layer.provideMerge(Workspace.layer), Layer.provide(config), Layer.provide(NodeServices.layer));
				const saved = yield* Effect.flatMap(Responses, (responses) =>
					responses.answer({
						author: "maintainer",
						body,
						id,
						item: "task.choice",
						request: "direction",
						revision: preview.reviewedRevision,
						type: "answer",
					}),
				).pipe(Effect.provide(answering));
				return saved.id;
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer));
		},
	};
}
