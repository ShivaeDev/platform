import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"mounts the board shell and browser assets through the application's real HTTP handler",
	[projectFiles({ "plan.md": "# Plan" }), deferredServing],
	function* ({ startEmbedded, request, get }) {
		yield* startEmbedded();
		const page = yield* get("/plan.md");
		expect(page.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(page.body).toContain("data-board-react-root");
		for (const [path, type] of [
			["react.js", "javascript"],
			["react.css", "text/css"],
		]) {
			const response = yield* request(`/_board/${path}`);
			expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
			expect(response.headers.get("content-type")).toContain(type);
			expect(yield* Effect.promise(() => response.text())).not.toBe("");
		}
		expect((yield* get("/", "board.example")).status).toBe(HttpStatus.fromLiteral("Forbidden"));
	},
);
