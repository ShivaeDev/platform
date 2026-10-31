import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { task } from "@shivaedev/work-fleet/test-support/fleetHost.ts";
import { boardWork, host } from "@shivaedev/work-fleet/test-support/hostStory.ts";
import { openPane } from "#test/fleetPane.ts";

const files = Object.fromEntries(
	["holder", "one", "two", "three", "four", "five", "short"].map((id) => [
		`${id}.md`,
		task(id, "approved").replace("kind: task", `kind: task\nareas: [${id === "short" ? "work-board" : "work-fleet"}]`),
	]),
);

host.it("the plugin's area chips read live Fleet ownership and queues through Board HTTP", [boardWork(files)], function* ({ approve, admit, story }) {
	yield* approve("holder");
	yield* admit();
	const pane = yield* openPane(story);
	yield* pane.refresh();
	yield* outcomes([
		["Held area", () => pane.areaState("work-fleet"), { color: "#d74253", state: "held · 5 queued" }],
		["Short queue", () => pane.areaState("work-board"), { color: "#ad7400", state: "unheld · 1 queued" }],
		["Idle area", () => pane.areaState("free"), { color: "#16853f", state: "free" }],
	]);
});
