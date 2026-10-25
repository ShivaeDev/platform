import { existsSync } from "node:fs";
import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { inboxQuestion } from "#test/inboxFixture.ts";
import type { BoardEngine } from "#test/storyEngine.ts";
import { storyEngineStory } from "#test/storyEngineStory.ts";

storyEngineStory.it(
	"closes a delayed bundle page and server and retains the reader view after an assertion fails",
	[],
	function* ({ connected, createBoard, inspectBoard, openSlowReader, serveProject }) {
		const lease: { engine?: BoardEngine } = {};
		const exit = yield* Effect.gen(function* () {
			const engine = yield* createBoard();
			lease.engine = engine;
			engine.notes.write("question.md", inboxQuestion);
			engine.path = "/_board/item/question.storage/";
			yield* serveProject(engine);
			yield* openSlowReader(engine);
			expect(connected(engine).page.document.body.textContent).toContain("Where should the project documents live?");
			return yield* Effect.fail("the reader's assertion failed");
		}).pipe(Effect.scoped, Effect.exit);
		const engine = lease.engine;
		if (!engine) {
			throw new Error("The story never acquired its project");
		}
		expect(exit).toEqual(Exit.fail("the reader's assertion failed"));
		expect(existsSync(engine.notes.root)).toBe(false);
		expect(connected(engine).page.document.body.innerHTML).toBe("");
		expect(inspectBoard(engine)).toMatchObject({ inbox: ["1", "1"], text: expect.stringContaining("Where should the project documents live?") });
		yield* Effect.promise(() => expect(fetch(connected(engine).board.url)).rejects.toThrow());
	},
);
