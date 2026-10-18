import { existsSync } from "node:fs";
import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { inboxQuestion } from "./inboxFixture.ts";
import type { BoardEngine } from "./storyEngine.ts";
import { storyEngineStory } from "./storyEngineStory.ts";

for (const fails of [false, true]) {
	storyEngineStory.it(
		`closes the page and server, removes the project and retains its reader view after ${fails ? "failure" : "success"}`,
		[],
		function* ({ connected, createBoard, inspectBoard, openReader, serveProject }) {
			const lease: { engine?: BoardEngine } = {};
			const exit = yield* Effect.gen(function* () {
				const engine = yield* createBoard();
				lease.engine = engine;
				engine.notes.write("question.md", inboxQuestion);
				engine.path = "/_board/item/question.storage/";
				yield* serveProject(engine);
				yield* openReader(engine);
				expect(connected(engine).page.document.body.textContent).toContain("Where should the project documents live?");
				if (fails) {
					return yield* Effect.fail("the reader's assertion failed");
				}
			}).pipe(Effect.scoped, Effect.exit);
			const engine = lease.engine;
			if (!engine) {
				throw new Error("The story never acquired its project");
			}
			expect(Exit.isFailure(exit)).toBe(fails);
			expect(existsSync(engine.notes.root)).toBe(false);
			expect(connected(engine).page.document.body.innerHTML).toBe("");
			expect(inspectBoard(engine)).toMatchObject({ inbox: ["1", "1"], text: expect.stringContaining("Where should the project documents live?") });
			yield* Effect.promise(() => expect(fetch(connected(engine).board.url)).rejects.toThrow());
		},
	);
}
