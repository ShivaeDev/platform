import { Effect } from "effect";
import { act } from "react";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { renderRouter } from "#test/renderRouter.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
const files = { "home.md": "# Home\n\n## Plans\n", "notes/first.md": "# First\n", "notes/next.md": "---\nid: note.next\n---\n# Next\n" };

const routes: ReadonlyArray<{ readonly url: string; readonly kind: "document" | "board" | "work" }> = [
	{ kind: "document", url: "/notes/next.md" },
	{ kind: "document", url: "/_board/item/note.next/" },
	{ kind: "document", url: "/missing.md" },
	{ kind: "board", url: "/" },
	{ kind: "board", url: "/home.md" },
	{ kind: "work", url: "/_board/work?item=note.next&view=board" },
];
it.live.each(routes)("preloads $url through the shared query registry before navigation", function* ({ url, kind }) {
	const reads: string[] = [];
	const view = yield* Effect.promise(() =>
		renderRouter(files, "/notes/first.md", {
			beforeRead: (readKind, target) => Effect.sync(() => reads.push(`${readKind}:${target}`)).pipe(Effect.asVoid),
			home: "home.md",
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector<HTMLElement>("#doc")?.dataset.route).toBe("/notes/first.md")));
		const header = view.container.querySelector("header.bar");
		yield* Effect.promise(() =>
			act(async () => {
				await view.router.preloadRoute(
					kind === "work" ? { params: { _splat: "_board/work" }, search: { item: "note.next", view: "board" }, to: "/$" } : { to: url },
				);
			}),
		);
		expect(reads.filter((read) => read === `document:${kind === "work" ? "/_board/item/note.next/" : url}`)).toHaveLength(1);
		expect(view.container.querySelector("#doc h1")?.textContent).toBe("First");
		yield* Effect.promise(() =>
			act(async () => {
				await view.router.navigate({ to: url });
			}),
		);
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector<HTMLElement>("#doc")?.dataset.route).toBe(url)));
		expect(view.container.querySelector("header.bar")).toBe(header);
		expect(reads.filter((read) => read === `document:${kind === "work" ? "/_board/item/note.next/" : url}`)).toHaveLength(1);
		expect(view.container.querySelector(kind === "document" ? "[data-react-document]" : "[data-react-projection]")).not.toBeNull();
		expect(reads).not.toContain(`page:${url}`);
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("loads the new projection query when only the search parameters change", function* () {
	const reads: string[] = [];
	const view = yield* Effect.promise(() =>
		renderRouter(files, "/_board/work?view=board", {
			beforeRead: (kind, url) => Effect.sync(() => reads.push(`${kind}:${url}`)).pipe(Effect.asVoid),
			home: "home.md",
		}),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector<HTMLElement>("#doc")?.dataset.route).toBe("/_board/work?view=board")),
		);
		yield* Effect.promise(() =>
			act(async () => {
				await view.router.preloadRoute({ params: { _splat: "_board/work" }, search: { view: "table" }, to: "/$" });
			}),
		);
		expect(reads).not.toContain("page:/_board/work?view=table");
		expect(view.container.querySelector(".work-eyebrow")?.textContent).toContain("BOARD");
		expect(view.container.querySelector<HTMLElement>("#doc")?.dataset.route).toBe("/_board/work?view=board");
		yield* Effect.promise(() =>
			act(async () => {
				await view.router.navigate({ to: "/_board/work?view=table" });
			}),
		);
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector<HTMLElement>("#doc")?.dataset.route).toBe("/_board/work?view=table")),
		);
		expect(view.container.querySelector(".work-table")).not.toBeNull();
		expect(view.container.querySelector(".work-eyebrow")?.textContent).toContain("TABLE");
		expect(reads).not.toContain("page:/_board/work?view=table");
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
