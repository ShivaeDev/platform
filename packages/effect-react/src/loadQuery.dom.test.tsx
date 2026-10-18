import { expect } from "vitest";
import { noteRoute, routes } from "#test/routerStories.tsx";

routes.it("a loader and rendered query share native execution and runtime", [noteRoute()], function* ({ route, observe, succeed }) {
	const { client, root } = route();
	yield* observe("one loader request", () => expect(client.calls).toEqual(["first"]));
	yield* succeed("first", "First note");
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
		const failure = yield* missing("missing");
		yield* observe("the tagged error is visible", () =>
			expect(root.container.querySelector("[role=alert]")?.textContent).toBe("NoteMissing:missing"),
		);
		expect(router.state.matches.at(-1)?.error).toBe(failure);
	},
);

routes.it(
	"navigation keeps previous contract data during pending state until the new query settles",
	[noteRoute()],
	function* ({ route, succeed, navigate, observe, waitForPending }) {
		const { client, root } = route();
		yield* succeed("first", "First note");
		yield* navigate();
		yield* observe("the second note is requested", () => expect(client.calls).toEqual(["first", "second"]));
		yield* waitForPending();
		expect(root.container.querySelector("[data-pending]")?.textContent).toBe("true");
		expect(root.container.querySelector("h1")?.textContent).toBe("First note");
		expect(root.container.querySelector("[data-query]")?.textContent).toBe("First note");
		yield* succeed("second", "Second note");
		yield* observe("navigation settled", () => expect(root.container.querySelector("[data-pending]")?.textContent).toBe("false"));
		expect(root.container.querySelector("[data-query]")?.textContent).toBe("Second note");
		expect(client.builds()).toBe(1);
	},
);
