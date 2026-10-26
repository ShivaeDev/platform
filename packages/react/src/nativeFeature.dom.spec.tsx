import { expect } from "vitest";
import { nativeNotes, nativeStory } from "#test/nativeStories.ts";

nativeStory.it(
	"rendered create persists through RPC and refreshes its query; rejected saves preserve the list",
	[nativeNotes()],
	function* ({ click, notes, observe, persisted }) {
		const container = notes();
		yield* observe("the initial list settles", () => {
			expect(JSON.parse(container.querySelector("output")?.textContent ?? "null")).toEqual({
				error: false,
				loading: false,
				saving: false,
				titles: [],
			});
		});
		yield* click("Save");
		yield* observe("the save refreshes the list", () => {
			expect(JSON.parse(container.querySelector("output")?.textContent ?? "null")).toEqual({
				error: false,
				loading: false,
				saving: false,
				titles: ["Morning walk"],
			});
		});
		yield* click("Save empty");
		yield* observe("the rejected save keeps the list", () => {
			expect(JSON.parse(container.querySelector("output")?.textContent ?? "null")).toEqual({
				error: true,
				loading: false,
				saving: false,
				titles: ["Morning walk"],
			});
		});
		expect(yield* persisted()).toEqual([{ id: 1, title: "Morning walk" }]);
	},
);
