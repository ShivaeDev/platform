import { expect, it } from "vitest";
import { folder } from "#test/board.ts";
import { bundleBoard } from "#test/bundleBoard.ts";

it("explains a missing browser bundle once at startup and in every failed bundle response", async () => {
	const notes = folder({ "plan.md": "# Plan\n" });
	const board = await bundleBoard(notes.root);
	const message =
		"Work Board browser bundle assets/native.js is missing. Run pnpm --filter @shivaedev/work-board build:browser from the repository root to build it.";
	try {
		expect(board.logged.filter(({ level }) => level === "Warn")).toEqual([{ level: "Warn", message: [message] }]);
		expect((await fetch(board.url)).status).toBe(200);
		for (let request = 0; request < 2; request += 1) {
			const response = await fetch(`${board.url}/_board/native.js`);
			expect(response.status).toBe(500);
			expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
			expect(await response.text()).toBe(message);
		}
		expect(board.logged.filter(({ level }) => level === "Warn")).toEqual([{ level: "Warn", message: [message] }]);
		notes.write("native.js", "export const built = true;");
		const response = await fetch(`${board.url}/_board/native.js`);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/javascript");
		expect(await response.text()).toBe("export const built = true;");
	} finally {
		await board.stop();
		notes.remove();
	}
});
