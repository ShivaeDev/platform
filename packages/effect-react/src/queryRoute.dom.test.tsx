import { expect, vi } from "vitest";
import { NoteMissing, NotFound } from "#test/routerClient.ts";
import { noteRoute, routes } from "#test/routerStories.tsx";

for (const initial of ["/notes/first", "/notes/first?page=invalid"]) {
	routes.it(
		`validated search defaults reach the query and its first rendered frame at ${initial}`,
		[noteRoute(initial)],
		function* ({ route, observe, succeed }) {
			const { client, root } = route();
			yield* observe("the default page is requested", () => expect(client.calls).toEqual([{ id: "first", page: 1 }]));
			yield* succeed("first", "First page");
			yield* observe("the loaded query is rendered", () => expect(root.container.querySelector("[data-query]")?.textContent).toBe("First page"));
			expect(client.frames[0]).toBe("First page");
			expect(client.calls).toEqual([{ id: "first", page: 1 }]);
		},
	);
}

routes.it("NotFound renders the route's not-found component", [noteRoute("/notes/missing")], function* ({ route, observe, missing }) {
	const { client, root } = route();
	yield* observe("the missing note is requested", () => expect(client.calls).toEqual([{ id: "missing", page: 1 }]));
	yield* missing(new NotFound({ id: "missing" }));
	yield* observe("the not-found screen is rendered", () => expect(root.container.querySelector("h1")?.textContent).toBe("Note not found"));
	expect(root.container.querySelector("[role=alert]")).toBeNull();
});

routes.it("changing search loads the query with the new payload", [noteRoute()], function* ({ route, observe, succeed, search }) {
	const { client, root } = route();
	yield* succeed("first", "First page");
	yield* observe("the first page is rendered", () => expect(root.container.querySelector("h1")?.textContent).toBe("First page"));
	yield* search(2);
	yield* observe("the changed page is requested", () =>
		expect(client.calls).toEqual([
			{ id: "first", page: 1 },
			{ id: "first", page: 2 },
		]),
	);
	yield* succeed("first", "Second page", 2);
	yield* observe("the changed query is rendered", () => expect(root.container.querySelector("[data-query]")?.textContent).toBe("Second page"));
});

routes.it("a loader and rendered query share native execution and runtime", [noteRoute()], function* ({ route, observe, succeed }) {
	const { client, root } = route();
	yield* observe("one loader request", () => expect(client.calls).toEqual([{ id: "first", page: 1 }]));
	yield* succeed("first", "First note");
	yield* observe("the first note is rendered", () => expect(root.container.querySelector("h1")?.textContent).toBe("First note"));
	expect(root.container.querySelector("[data-query]")?.textContent).toBe("First note");
	expect(client.calls).toEqual([{ id: "first", page: 1 }]);
	expect(client.builds()).toBe(1);
});

routes.it(
	"a declared RPC failure reaches the route error component as its tagged error",
	[noteRoute("/notes/missing")],
	function* ({ route, observe, missing }) {
		const { client, root, router } = route();
		yield* observe("the missing note is requested", () => expect(client.calls).toEqual([{ id: "missing", page: 1 }]));
		const failure = new NoteMissing({ id: "missing" });
		yield* missing(failure);
		yield* observe("the tagged error is visible", () =>
			expect(root.container.querySelector("[role=alert]")?.textContent).toBe("NoteMissing:missing"),
		);
		expect(router.state.matches.at(-1)?.error).toBe(failure);
		expect(vi.mocked(console.error).mock.calls).toEqual([
			[
				expect.any(String),
				failure,
				"The above error occurred in the <MatchInnerImpl> component.",
				"React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundary.",
			],
		]);
		vi.mocked(console.error).mockClear();
	},
);

routes.it(
	"navigation keeps previous contract data during pending state until the new query settles",
	[noteRoute()],
	function* ({ route, succeed, navigate, observe }) {
		const { client, root } = route();
		yield* succeed("first", "First note");
		yield* observe("the first note is rendered", () => expect(root.container.querySelector("h1")?.textContent).toBe("First note"));
		yield* navigate();
		yield* observe("the second note is requested", () =>
			expect(client.calls).toEqual([
				{ id: "first", page: 1 },
				{ id: "second", page: 1 },
			]),
		);
		yield* observe("navigation is pending", () => expect(root.container.querySelector("[data-pending]")?.textContent).toBe("true"));
		expect(root.container.querySelector("h1")?.textContent).toBe("First note");
		expect(root.container.querySelector("[data-query]")?.textContent).toBe("First note");
		yield* succeed("second", "Second note");
		yield* observe("the second note is rendered", () => expect(root.container.querySelector("h1")?.textContent).toBe("Second note"));
		yield* observe("navigation settled", () => expect(root.container.querySelector("[data-pending]")?.textContent).toBe("false"));
		expect(root.container.querySelector("[data-query]")?.textContent).toBe("Second note");
		expect(client.builds()).toBe(1);
	},
);
