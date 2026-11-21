import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { recordClientStory, watchingBoth } from "#test/record-client/story.ts";

recordClientStory.it(
	"one client over two contracts pushes both queries and settles both commands",
	[watchingBoth],
	function* ({ activity, bump, count, shelve, titles }) {
		yield* outcomes([
			["shelving", () => shelve("Dune"), "reflected"],
			["bumping", () => bump(), "reflected"],
			["titles", () => titles(), "Dune"],
			["count", () => count(), "1"],
			["activity", () => activity(), "live, settled"],
		]);
	},
);

recordClientStory.it("a page's client connects to /rpc beside the page when it names no URL", [], function* ({ shelve, titlesInPage }) {
	yield* outcomes([
		["shelving", () => shelve("Dune"), "reflected"],
		["titles in the page", () => titlesInPage("/shelf/books"), "Dune"],
	]);
});
