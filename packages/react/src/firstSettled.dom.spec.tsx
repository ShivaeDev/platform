import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceOpens, aliceSeesFirstResults, firstSettledScreens } from "#test/first-settled/story.tsx";

const WAITING = "waiting for first results";
const SETTLED = "first results settled";

firstSettledScreens.it(
	"useFirstSettled stays false until every query on alice's first screen has answered",
	[aliceOpens()],
	function* ({ answers, signal }) {
		expect(yield* signal()).toBe(WAITING);
		yield* answers("title", "Groceries");
		expect(yield* signal()).toBe(WAITING);

		yield* answers("author", "alice");

		expect(yield* signal()).toBe(SETTLED);
	},
);

firstSettledScreens.it(
	"once true, useFirstSettled stays true while a later command is in flight and a later query awaits its first result",
	[aliceSeesFirstResults],
	function* ({ activity, showCount, signal, startRename }) {
		expect(yield* signal()).toBe(SETTLED);

		yield* startRename();
		yield* showCount();

		yield* outcomes([
			["client activity", () => activity(), { commands: 1, initialQueries: 1 }],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"a new session generation starts with useFirstSettled false and turns it true with its own first results",
	[aliceSeesFirstResults],
	function* ({ answers, signal, signIn }) {
		expect(yield* signal()).toBe(SETTLED);

		yield* signIn("bob");

		expect(yield* signal()).toBe(WAITING);
		yield* answers("title", "Errands");
		yield* answers("author", "bob");
		expect(yield* signal()).toBe(SETTLED);
	},
);

firstSettledScreens.it(
	"a screen that reads no query keeps useFirstSettled false, also after a command finished",
	[aliceOpens("no query")],
	function* ({ command, renameFinishes, signal, startRename }) {
		expect(yield* signal()).toBe(WAITING);

		yield* startRename();
		yield* renameFinishes();

		yield* outcomes([
			["command", () => command(), "finished"],
			["signal", () => signal(), WAITING],
		]);
	},
);

firstSettledScreens.it(
	"first results that arrive while a command is in flight turn useFirstSettled true only when the command finishes",
	[aliceOpens()],
	function* ({ answers, renameFinishes, signal, startRename }) {
		yield* startRename();
		yield* answers("title", "Groceries");
		yield* answers("author", "alice");
		expect(yield* signal()).toBe(WAITING);

		yield* renameFinishes();

		expect(yield* signal()).toBe(SETTLED);
	},
);

firstSettledScreens.it(
	"a warm query that no screen reads does not hold back useFirstSettled while it waits for its first result",
	[aliceOpens("title and author", "count")],
	function* ({ activity, answers, signal }) {
		yield* answers("title", "Groceries");

		yield* answers("author", "alice");

		yield* outcomes([
			["client activity", () => activity(), { commands: 0, initialQueries: 1 }],
			["signal", () => signal(), SETTLED],
		]);
	},
);
