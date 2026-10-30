import { Effect, Fiber } from "effect";
import type { AnswerInput } from "#browser/responses/schema.ts";
import { browserClient } from "#browserClient.ts";
import { socketStartup } from "#test/socketStartup.ts";
import { type BoardEngine, served } from "#test/storyEngine.ts";

export function restartAnswerVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		beginAnswer: (input: AnswerInput) => {
			tell(`the reader starts saving ${input.id}`);
			const client = served(engine).client;
			const finished = client.mutate(client.responses.answerQuestion.run(input)).catch((error: unknown) => error);
			return Effect.succeed({ finished: Effect.promise(() => finished) });
		},
		beginShutdown: () => {
			tell("the Board closes its listeners and drains accepted saves");
			return served(engine)
				.board.stop()
				.pipe(
					Effect.forkScoped,
					Effect.map((fiber) => Fiber.join(fiber)),
				);
		},
		startPublicationWriter: (phase: "temporary" | "published") =>
			Effect.gen(function* () {
				tell(`a Board process pauses answer publication at ${phase}`);
				const writer = yield* socketStartup(engine.notes.root, phase, new URL("./answerPublicationChild.ts", import.meta.url));
				const ready = yield* writer.next();
				if (ready.url === undefined) {
					return yield* Effect.die("Board process has no listener");
				}
				const client = browserClient(ready.url);
				yield* Effect.addFinalizer(() => Effect.sync(() => client.registry.dispose()));
				return {
					...writer,
					answer: (input: AnswerInput) => {
						tell(`the reader submits ${input.id} to the Board process`);
						const finished = client.mutate(client.responses.answerQuestion.run(input)).catch((error: unknown) => error);
						return Effect.succeed({ finished: Effect.promise(() => finished) });
					},
					preview: () => Effect.promise(() => client.run(client.responses.question.run({ item: "task.choice", request: "direction" }))),
				};
			}),
	};
}
