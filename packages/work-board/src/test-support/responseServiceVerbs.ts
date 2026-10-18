import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { watchChanges } from "#server/files/changes.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { readingActions } from "#server/responses/readingActions.ts";
import { ResponseConfig, Responses } from "#server/responses/service.ts";
import { fullIndex } from "./fullIndex.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function responseServiceVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const options = Layer.effect(
		ResponseConfig,
		Effect.gen(function* () {
			const changes = yield* watchChanges(engine.notes.root);
			return {
				changes,
				enabled: engine.responses,
				index: fullIndex(engine.notes.root).pipe(Effect.provide(NodeServices.layer)),
				root: engine.notes.root,
			};
		}),
	);
	const service = Responses.layer.pipe(Layer.provide(options), Layer.provide(NodeServices.layer));
	return {
		readHistory: (preview: QuestionPreview) => {
			tell(`the reader reads recorded history for ${preview.item}/${preview.request}`);
			return Effect.flatMap(Responses, (responses) => responses.history(preview)).pipe(Effect.provide(service));
		},
		readQuestionActions: (file: string) => {
			tell(`the reader reads the answer actions in ${file}`);
			const source = readFileSync(join(engine.notes.root, file), "utf8");
			const document = { file, parsed: metadataParse(source) };
			return readingActions(document, source, engine.responses, document.parsed.fields.id).pipe(Effect.provide(service));
		},
	};
}
