import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen, routedScreen } from "#test/screenTraits.ts";
import { LibraryContents } from "./LibraryContents.tsx";

expectNoReactWarnings();
screenStory.it(
	"shows how long ago each listed document changed",
	[
		routedScreen({ "home.md": "# Home", "note.md": "# Note" }, "/_board/library?view=recently-changed", {
			home: "home.md",
			modified: new Map([["note.md", Effect.runSync(Clock.currentTimeMillis) - 2 * 60 * 60 * 1000]]),
		}),
	],
	function* ({ readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText('#doc li:has(a[href="/note.md"]) [data-updated]')).toBe("Updated 2h ago")));
	},
);
const files = [
	{ href: "/a.md", kind: "document", modified: 1000, path: "a.md", status: "not recorded", title: "Alphabetical first" },
	{ href: "/z.md", kind: "document", modified: 3000, path: "z.md", status: "not recorded", title: "Newest title" },
	{ href: "/b.md", kind: "document", modified: 2000, path: "b.md", status: "not recorded", title: "Middle title" },
];
screenStory.it(
	"orders Recently changed by file modification time, independent of title order",
	[
		boardScreen({}, (api) => (
			<LibraryContents api={api} data={{ files, fleetCount: 0, folders: [], kinds: [], statuses: [] }} filters={{}} view="recently changed" />
		)),
	],
	({ findElements }) => {
		expect([...findElements("a")].map((link) => link.textContent)).toEqual(["Newest title", "Middle title", "Alphabetical first"]);
	},
);
