import { Cause, Option } from "effect";
import { expect } from "vitest";
import {
	activity,
	activityMounted,
	registryActivity,
	registryActivityMounted,
	replay,
	replayMounted,
	rotation,
	rotationMounted,
	tracked,
	trackedMounted,
} from "#test/lifecycleStories.ts";
import { resultProbe, results } from "#test/resultStories.ts";
import { orderSessions, sessionScreens } from "#test/sessionStories.ts";

results.it(
	"an Unauthorized action rechecks once per failed result and retains data and typed cause",
	[resultProbe("action", "unauthorized")],
	function* ({ result, execute, rejectNext, rerender }) {
		const view = result();
		yield* execute();
		expect(view.current().data).toEqual(Option.some("Saved order"));
		expect(view.rechecks).toEqual([]);
		rejectNext();
		for (let failures = 1; failures <= 2; failures += 1) {
			yield* execute();
			expect(view.rechecks).toHaveLength(failures);
			expect(view.current().data).toEqual(Option.some("Saved order"));
			expect(Option.getOrThrow(Option.flatMap(view.current().cause, Cause.findErrorOption))).toBe(view.denied);
			yield* rerender();
			expect(view.rechecks).toHaveLength(failures);
		}
	},
);
sessionScreens.it(
	"each session generation owns a fresh client and registry; switching, signing out and re-entering discard the previous one",
	[orderSessions()],
	function* ({ session, show, type, observe, close }) {
		const view = session();

		yield* show({ id: "a1", token: "alice-token" }, 1);
		yield* observe("the session screen settles", () => expect(view.container.textContent).toContain("Printer paper / 300"));
		yield* type("Alice draft");
		yield* show({ id: "a1", token: "alice-token" }, 1);
		expect(view.input()?.value).toBe("Alice draft");
		expect(view.registries).toHaveLength(1);
		yield* show({ id: "b1", token: "bob-token" }, 2);
		yield* observe("the session screen settles", () => expect(view.input()?.value).toBe("Desk lamps"));
		expect(view.container.textContent).not.toContain("Printer paper");
		expect(view.registries[0]?.getNodes().size).toBe(0);
		yield* show(undefined, 1);
		expect(view.container.textContent).toBe("Signed out");
		expect(view.registries[1]?.getNodes().size).toBe(0);
		yield* show({ id: "a2", token: "alice-token" }, 1);
		yield* observe("the session screen settles", () => expect(view.input()?.value).toBe("Printer paper"));
		expect(view.container.textContent).not.toContain("Unsaved changes");
		expect(view.registries).toHaveLength(3);
		expect(view.rechecks).toEqual([]);
		yield* close();
		expect(view.registries[2]?.getNodes().size).toBe(0);
	},
);
sessionScreens.it(
	"Unauthorized keeps the retained screen and asks the auth owner to re-check; its expiry verdict tears the session down",
	[orderSessions()],
	function* ({ session, show, type, refresh, observe, expire }) {
		const view = session();

		yield* show({ id: "a1", token: "alice-token" }, 1);
		yield* observe("the session screen settles", () => expect(view.container.textContent).toContain("Printer paper / 300"));
		yield* type("Unsaved order");
		expire();
		yield* refresh();
		yield* observe("the session screen settles", () => expect(view.rechecks).toEqual(["a1"]));
		expect(view.container.textContent).toContain("Printer paper / 300");
		expect(view.input()?.value).toBe("Unsaved order");
		yield* show(undefined, 1);
		expect(view.container.textContent).toBe("Signed out");
		expect(view.registries[0]?.getNodes().size).toBe(0);
		expect(view.rechecks).toEqual(["a1"]);
	},
);
sessionScreens.it(
	"refresh retry recovers without losing the session's dirty form",
	[orderSessions()],
	function* ({ session, show, type, refresh, observe, expire, restore }) {
		const view = session();

		yield* show({ id: "a1", token: "alice-token" }, 1);
		yield* observe("the session screen settles", () => expect(view.container.textContent).toContain("Printer paper / 300"));
		yield* type("Unsaved order");
		expire();
		yield* refresh();
		yield* observe("the session screen settles", () =>
			expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("Could not load"),
		);
		expect(view.input()?.value).toBe("Unsaved order");
		restore();
		yield* refresh();
		yield* observe("the session screen settles", () => expect(view.container.querySelector('[role="alert"]')).toBeNull());
		expect(view.input()?.value).toBe("Unsaved order");
	},
);

replay.it("StrictMode replay keeps the registry alive until real unmount", [replayMounted()], function* ({ probe, signIn, signOut }) {
	const { root, held } = probe();
	yield* signIn("s1");
	expect(root.container.textContent).toBe("42");
	expect(held.registry?.getNodes().size).toBeGreaterThan(0);
	const first = held.registry;
	yield* signOut();
	expect(root.container.textContent).toBe("");
	expect(first?.getNodes().size).toBe(0);
});
for (const hoisted of [false, true]) {
	activity.it(
		`Activity preserves the draft and live registry (hoisted ${hoisted})`,
		[activityMounted(hoisted)],
		function* ({ probe, reveal, hide, close }) {
			const { root, errors, registries } = probe();
			yield* reveal();
			expect(errors).toEqual([]);
			expect(root.container.textContent).toBe("draft-1:42");
			yield* hide();
			yield* reveal();
			expect(errors).toEqual([]);
			expect(root.container.textContent).toBe("draft-1:42");
			expect(registries.at(-1)?.getNodes().size).toBeGreaterThan(0);
			yield* close();
			expect(registries.map((registry) => registry.getNodes().size)).toEqual(registries.map(() => 0));
		},
	);
}
tracked.it(
	"unmounting a generation rerendered while hidden disposes hidden-render resources",
	[trackedMounted()],
	function* ({ probe, reveal, hide, close, observe }) {
		const { rendered, built, finalized } = probe();
		yield* reveal(1);
		yield* hide(1);
		yield* hide(2);
		expect(rendered).toContain(2);
		expect(built.length).toBeGreaterThan(1);
		yield* close();
		yield* observe("all resources are finalized", () => expect(finalized).toHaveLength(built.length));
	},
);
rotation.it("credentials rotate only when identify includes their generation", [rotationMounted()], function* ({ probe, signIn }) {
	const { root, connected } = probe();
	function byId(session: { readonly id: string }) {
		return session.id;
	}
	function byCredential(session: { readonly id: string; readonly credential: number }) {
		return `${session.id}:${session.credential}`;
	}
	yield* signIn({ credential: 1, id: "a1", token: "t1" }, byId);
	yield* signIn({ credential: 2, id: "a1", token: "t2" }, byId);
	expect(root.container.textContent).toBe("t1");
	yield* signIn({ credential: 2, id: "a1", token: "t2" }, byCredential);
	yield* signIn({ credential: 3, id: "a1", token: "t3" }, byCredential);
	expect(root.container.textContent).toBe("t3");
	expect(connected).toEqual(["t1", "t2", "t3"]);
});
registryActivity.it(
	"revealing before hidden cleanup preserves the registry and newly added atoms",
	[registryActivityMounted()],
	function* ({ probe, reveal, hide, pauseCleanup, runCleanup, resumeCleanup, close }) {
		pauseCleanup();
		const view = probe();
		yield* reveal(1);
		const outgoing = view.registry();
		yield* hide(1);
		yield* hide(2);
		const revealed = view.registry();
		expect(revealed).not.toBe(outgoing);
		expect(view.built).toEqual(["first", "first", "second"]);
		expect(view.finalized).toEqual(["first"]);
		yield* reveal(2);
		yield* runCleanup();
		expect(view.registry()).toBe(revealed);
		expect(view.finalized).toEqual(["first"]);
		yield* reveal(3);
		yield* runCleanup();
		expect(view.container.textContent).toBe("retained draftfirstsecondthird");
		expect(view.built).toEqual(["first", "first", "second", "third"]);
		expect(view.finalized).toEqual(["first"]);
		yield* close();
		resumeCleanup();
		expect(view.finalized).toHaveLength(view.built.length);
	},
);
