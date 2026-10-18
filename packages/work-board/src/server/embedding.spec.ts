import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"embeds reading routes beside application health without relaxing the board boundary",
	[projectFiles({ "evidence.md": "# Recorded evidence", "plan.md": "# Embedded project\n\n[Evidence](evidence.md)" }), deferredServing],
	function* ({ startEmbedded, get, viewHtml }) {
		const board = yield* startEmbedded();
		expect((yield* get("/health")).body).toBe("healthy");
		for (const path of ["/plan.md", "/evidence.md"]) {
			expect((yield* get(path)).body).toContain("data-board-react-root");
		}
		expect(yield* viewHtml("/_board/start")).toContain("Project and report templates");
		for (const path of ["/plan.md", "/_board/react.js"]) {
			expect((yield* get(path, "untrusted.example")).status).toBe(403);
		}
		expect((yield* get("/health", "untrusted.example")).body).toBe("healthy");
		yield* board.stop();
		yield* Effect.promise(() => expect(fetch(`${board.url}/health`)).rejects.toThrow());
	},
);
