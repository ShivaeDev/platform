import { expect, vi } from "vitest";
import { NoteMissing } from "#test/routerClient.ts";
import { noteRoute, routes } from "#test/routerStories.tsx";

routes.it("a loader and rendered query share native execution and runtime", [noteRoute()], function* ({ route, observe, succeed }) {
	const { client, root } = route();
	yield* observe("one loader request", () => expect(client.calls).toEqual(["first"]));
	yield* succeed("first", "First note");
	yield* observe("the first note is rendered", () => expect(root.container.querySelector("h1")?.textContent).toBe("First note"));
	expect(root.container.querySelector("[data-query]")?.textContent).toBe("First note");
	expect(client.calls).toEqual(["first"]);
	expect(client.builds()).toBe(1);
});

routes.it(
	"a declared RPC failure reaches the route error component as its tagged error",
	[noteRoute("/notes/missing")],
	function* ({ route, observe, missing }) {
		const { client, root, router } = route();
		yield* observe("the missing note is requested", () => expect(client.calls).toEqual(["missing"]));
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
	function* ({ route, succeed, navigate, observe, waitForPending }) {
		const { client, root } = route();
		yield* succeed("first", "First note");
		yield* observe("the first note is rendered", () => expect(root.container.querySelector("h1")?.textContent).toBe("First note"));
		yield* navigate();
		yield* observe("the second note is requested", () => expect(client.calls).toEqual(["first", "second"]));
		yield* waitForPending();
		expect(root.container.querySelector("[data-pending]")?.textContent).toBe("true");
		expect(root.container.querySelector("h1")?.textContent).toBe("First note");
		expect(root.container.querySelector("[data-query]")?.textContent).toBe("First note");
		yield* succeed("second", "Second note");
		yield* observe("the second note is rendered", () => expect(root.container.querySelector("h1")?.textContent).toBe("Second note"));
		yield* observe("navigation settled", () => expect(root.container.querySelector("[data-pending]")?.textContent).toBe("false"));
		expect(root.container.querySelector("[data-query]")?.textContent).toBe("Second note");
		expect(client.builds()).toBe(1);
	},
);
