import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { subjectStory, titled } from "#test/subject/story.ts";

const titles = [titled("manager", "Manager's title"), titled("bob", "Bob's title"), titled("carol", "Carol's title")];

subjectStory.it(
	"a manager's browser socket, signed in by its first frame, shows bob's title and bob's own later rename",
	titles,
	function* ({ browserWatches, rename, shownTitle }) {
		expect(yield* browserWatches("manager", "bob")).toBe("bob: Bob's title");

		yield* rename("delegated", "bob", "Bob's new title");

		expect(yield* shownTitle("manager", "bob")).toBe("bob: Bob's new title");
	},
);

subjectStory.it(
	"one browser socket carries the manager's own, bob's and carol's titles, and bob's rename changes only bob's view",
	titles,
	function* ({ browserSocketsOpened, browserWatches, rename, shownTitle }) {
		yield* outcomes([
			["manager's own view", () => browserWatches("manager"), "manager: Manager's title"],
			["bob's view", () => browserWatches("manager", "bob"), "bob: Bob's title"],
			["carol's view", () => browserWatches("manager", "carol"), "carol: Carol's title"],
		]);

		yield* rename("delegated", "bob", "Bob's new title");

		yield* outcomes([
			["manager's own view", () => shownTitle("manager"), "manager: Manager's title"],
			["bob's view", () => shownTitle("manager", "bob"), "bob: Bob's new title"],
			["carol's view", () => shownTitle("manager", "carol"), "carol: Carol's title"],
			["sockets opened", () => browserSocketsOpened("manager"), 1],
		]);
	},
);

subjectStory.it(
	"a manager's browser renames bob's account by naming bob on the call while the socket stays the manager's",
	titles,
	function* ({ browserRetitles, storedTitles }) {
		const answer = yield* browserRetitles("manager", "Bob's new title", "bob");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "bob is Bob's new title"],
			["stored titles", () => storedTitles(), { bob: "Bob's new title", carol: "Carol's title", manager: "Manager's title" }],
		]);
	},
);

subjectStory.it(
	"alice's browser is refused bob's title and bob's rename per call with the declared refusal while her own title answers on the same socket",
	[titled("alice", "Alice's title"), ...titles],
	function* ({ browserRetitles, browserWatches, storedTitles }) {
		yield* outcomes([
			["bob's view", () => browserWatches("alice", "bob"), "failed with cannot act for bob"],
			["bob's rename", () => browserRetitles("alice", "Alice's takeover", "bob"), "failed with cannot act for bob"],
			["alice's own view", () => browserWatches("alice"), "alice: Alice's title"],
			["bob's stored title", () => Effect.map(storedTitles(), ({ bob }) => bob), "Bob's title"],
		]);
	},
);

subjectStory.it(
	"a manager's live view of bob ends with the declared refusal at the recheck after delegation is revoked, and the manager's own view stays",
	titles,
	function* ({ browserWatches, revokeDelegation, shownTitle, titleRevalidationPasses }) {
		yield* outcomes([
			["manager's own view", () => browserWatches("manager"), "manager: Manager's title"],
			["bob's view", () => browserWatches("manager", "bob"), "bob: Bob's title"],
		]);

		yield* revokeDelegation("manager");
		const ending = yield* titleRevalidationPasses("manager", "bob");

		yield* outcomes([
			["bob's view", () => Effect.succeed(ending), "failed with cannot act for bob"],
			["manager's own view", () => shownTitle("manager"), "manager: Manager's title"],
		]);
	},
);

subjectStory.it(
	"alice's browser call that names bob and claims the manager's authorization in its message is refused as alice",
	titles,
	function* ({ browserWatchesWithForgedAuthorization }) {
		expect(yield* browserWatchesWithForgedAuthorization("alice", "manager", "bob")).toBe("failed with cannot act for bob");
	},
);

subjectStory.it(
	"a page hydrating a server render keeps bob's and carol's titles apart under one serialization key",
	titles,
	function* ({ hydratedTitles }) {
		expect(yield* hydratedTitles("manager", ["bob", "carol"])).toEqual({ bob: "bob: Bob's title", carol: "carol: Carol's title" });
	},
);

subjectStory.it(
	"after the manager closes bob's view, carol's new view starts loading while reopening bob's shows bob's retained title",
	titles,
	function* ({ browserLeavesAndOpens }) {
		expect(yield* browserLeavesAndOpens("manager", "bob", "carol")).toEqual({
			"bob again": "bob: Bob's title while loading",
			"carol first": "loading",
		});
	},
);
