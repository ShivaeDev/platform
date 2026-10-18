import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { folder } from "#test/board.ts";
import { bundleBoard } from "#test/bundleBoard.ts";

const assets = [
	["react.js", "text/javascript", "data-board-react-root"],
	["react.css", "text/css", "--background:"],
] as const;

for (const [missing, type, content] of assets) {
	it.live(`explains missing ${missing} once at startup and in every failed response, then serves it when built`, function* () {
		const notes = folder({ "plan.md": "# Plan\n" });
		const board = yield* bundleBoard(notes.root, [missing]);
		const message = `Work Board browser bundle assets/${missing} is missing. Run pnpm --filter @shivaedev/work-board build:browser from the repository root to build it.`;
		try {
			expect(board.logged.filter(({ level }) => level === "Warn")).toEqual([{ level: "Warn", message: [message] }]);
			expect((yield* Effect.promise(() => fetch(board.url))).status).toBe(200);
			for (const [asset, healthyType, healthyContent] of assets.filter(([candidate]) => candidate !== missing)) {
				const response = yield* Effect.promise(() => fetch(`${board.url}/_board/${asset}`));
				expect(response.status).toBe(200);
				expect(response.headers.get("content-type")).toBe(healthyType);
				expect(yield* Effect.promise(() => response.text())).toContain(healthyContent);
			}
			for (let request = 0; request < 2; request += 1) {
				const response = yield* Effect.promise(() => fetch(`${board.url}/_board/${missing}`));
				expect(response.status).toBe(500);
				expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
				expect(yield* Effect.promise(() => response.text())).toBe(message);
			}
			expect(board.logged.filter(({ level }) => level === "Warn")).toEqual([{ level: "Warn", message: [message] }]);
			notes.write(missing, content);
			const response = yield* Effect.promise(() => fetch(`${board.url}/_board/${missing}`));
			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(type);
			expect(yield* Effect.promise(() => response.text())).toBe(content);
		} finally {
			yield* board.stop();
			notes.remove();
		}
	});
}
