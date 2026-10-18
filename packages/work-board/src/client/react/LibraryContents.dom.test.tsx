import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { LibraryContents } from "./LibraryContents.tsx";

expectNoReactWarnings();
screenStory.it("orders Recently changed by file modification time, independent of title order", [], function* ({ renderBoard }) {
	const files = [
		{ href: "/a.md", kind: "document", modified: 1000, path: "a.md", status: "not recorded", title: "Alphabetical first" },
		{ href: "/z.md", kind: "document", modified: 3000, path: "z.md", status: "not recorded", title: "Newest title" },
		{ href: "/b.md", kind: "document", modified: 2000, path: "b.md", status: "not recorded", title: "Middle title" },
	];
	const view = yield* Effect.promise(() =>
		renderBoard({}, (api) => (
			<LibraryContents api={api} data={{ files, fleetCount: 0, folders: [], kinds: [], statuses: [] }} filters={{}} view="recently changed" />
		)),
	);

	expect([...view.container.querySelectorAll("a")].map((link) => link.textContent)).toEqual(["Newest title", "Middle title", "Alphabetical first"]);
});
