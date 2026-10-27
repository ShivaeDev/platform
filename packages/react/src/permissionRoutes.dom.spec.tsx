import { expect } from "vitest";
import { permissionScreens, visitor } from "#test/permission-routes/story.tsx";

permissionScreens.it("a permitted session opens a guarded route and reads its data over HTTP", [visitor("reader")], function* ({ route, observe }) {
	const { host, view, router } = route();
	yield* observe("the RPC result is rendered", () => expect(view.container.querySelector("h1")?.textContent).toBe("Note first"));
	expect(router.state.location.href).toBe("/notes/first");
	expect(host.requests).toEqual(["POST /rpc/"]);
});

permissionScreens.it(
	"a refused route renders the fallback at its URL without requesting its loader query",
	[visitor("guest")],
	function* ({ route, observe }) {
		const { host, view, router } = route();
		yield* observe("the application's fallback is rendered", () => expect(view.container.querySelector("h1")?.textContent).toBe("Permission denied"));
		expect(router.state.location.href).toBe("/notes/first");
		expect(router.history.location.href).toBe("/notes/first");
		expect(host.requests).toEqual([]);
	},
);

permissionScreens.it(
	"a signed-out visitor signs in and returns to the full requested location",
	[visitor(undefined, "/notes/first?tab=history#latest")],
	function* ({ route, observe, signIn }) {
		const { host, view, router } = route();
		yield* observe("the app's sign-in page is rendered", () => expect(view.container.querySelector("h1")?.textContent).toBe("Sign in"));
		expect(router.state.location.pathname).toBe("/login");
		expect(router.state.location.search).toEqual({ returnTo: "/notes/first?tab=history#latest" });
		expect(host.requests).toEqual([]);
		yield* signIn();
		yield* observe("the requested note is rendered after sign-in", () => expect(view.container.querySelector("h1")?.textContent).toBe("Note first"));
		expect(router.state.location.href).toBe("/notes/first?tab=history#latest");
		expect(host.requests).toEqual(["POST /rpc/"]);
	},
);

for (const [role, buttons] of [
	[undefined, []],
	["guest", []],
	["reader", ["Read notes"]],
	["supervisor", ["Read anyone's notes"]],
] as const) {
	permissionScreens.it(`can shows only exact session grants for a ${role}`, [visitor(role, "/controls")], function* ({ route, observe }) {
		const { host, view } = route();
		yield* observe("the controls screen is rendered", () => expect(view.container.querySelector("h1")?.textContent).toBe("Controls"));
		expect([...view.container.querySelectorAll("button")].map((button) => button.textContent)).toEqual(buttons);
		expect(host.requests).toEqual([]);
	});
}

permissionScreens.it(
	"the same boundary renders a Forbidden from a loader's RPC",
	[visitor("reader", "/notes/first", "guest")],
	function* ({ route, observe }) {
		const { host, view, router } = route();
		yield* observe("the fallback handles the server's refusal", () =>
			expect(view.container.querySelector("h1")?.textContent).toBe("Permission denied"),
		);
		expect(router.state.location.href).toBe("/notes/first");
		expect(host.requests).toEqual(["POST /rpc/"]);
	},
);

permissionScreens.it("the same boundary renders a Forbidden from a component query", [visitor("guest", "/query")], function* ({ route, observe }) {
	const { host, view, router } = route();
	yield* observe("the fallback replaces the query screen", () => expect(view.container.querySelector("h1")?.textContent).toBe("Permission denied"));
	expect(router.state.location.href).toBe("/query");
	expect(host.requests).toEqual(["POST /rpc/"]);
});

permissionScreens.it(
	"unrelated query failures reach the app's normal error boundary",
	[visitor("reader", "/notes/offline")],
	function* ({ route, observe }) {
		const { host, view, router } = route();
		yield* observe("the application handles its unavailable query", () =>
			expect(view.container.querySelector("h1")?.textContent).toBe("Application unavailable"),
		);
		expect(router.state.location.href).toBe("/notes/offline");
		expect(host.requests).toEqual(["POST /rpc/"]);
	},
);

permissionScreens.it(
	"explicit sign-out drops the return target when guards rerun before the auth action resolves",
	[visitor("reader", "/notes/first?tab=history")],
	function* ({ route, observe, signOut }) {
		const { view, router } = route();
		yield* observe("the protected note is open", () => expect(view.container.querySelector("h1")?.textContent).toBe("Note first"));
		yield* signOut();
		yield* observe("the sign-in screen is open", () => expect(view.container.querySelector("h1")?.textContent).toBe("Sign in"));
		expect(router.state.location.href).toBe("/login");
		expect(router.state.location.search).toEqual({});
	},
);
