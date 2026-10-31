import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { mountedInApplication } from "#test/liveTraits.ts";

const embedded = [
	projectFiles({ "evidence.md": "# Recorded evidence", "plan.md": "# Embedded project\n\n[Evidence](evidence.md)" }),
	mountedInApplication,
];

boardStory.it(
	"an application that mounts the board answers its own health route and serves the board's reading pages",
	embedded,
	function* ({ httpAnswer }) {
		yield* outcomes([
			["health", () => httpAnswer("/health"), "healthy"],
			["the evidence page", () => httpAnswer("/evidence.md"), "reading shell"],
			["the plan page", () => httpAnswer("/plan.md"), "reading shell"],
		]);
	},
);

boardStory.it("the mounted board serves its browser script and stylesheet", embedded, function* ({ assetAnswer }) {
	yield* outcomes([
		["the script", () => assetAnswer("/_board/react.js"), "text/javascript"],
		["the stylesheet", () => assetAnswer("/_board/react.css"), "text/css"],
	]);
});

boardStory.it("the mounted board renders its Templates page from its RPC data", embedded, function* ({ viewHtml }) {
	expect(yield* viewHtml("/_board/start")).toContain(">Templates</h1>");
});

boardStory.it(
	"under an untrusted Host the mounted board forbids its pages and script while the application's health route still answers",
	embedded,
	function* ({ httpAnswer }) {
		yield* outcomes([
			["health", () => httpAnswer("/health", "untrusted.example"), "healthy"],
			["the home page", () => httpAnswer("/", "untrusted.example"), "403 Forbidden"],
			["the plan page", () => httpAnswer("/plan.md", "untrusted.example"), "403 Forbidden"],
			["the script", () => httpAnswer("/_board/react.js", "untrusted.example"), "403 Forbidden"],
		]);
	},
);

boardStory.it("once the application stops the mounted board, its listener refuses connections", embedded, function* ({ boardStops, listenerState }) {
	expect(yield* listenerState()).toBe("answering");

	yield* boardStops();

	expect(yield* listenerState()).toBe("refusing connections");
});
