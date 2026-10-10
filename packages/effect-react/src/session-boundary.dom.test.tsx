import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { Activity, act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SessionBoundary } from "#session-boundary.ts";
import { activityRegistry } from "#test/activityRegistry.ts";
import { startOrderServer } from "#test/order-example/http-test.ts";
import { sessions, shell } from "#test/session.ts";
import { DraftProbe, type RegistryHolder, ReplayProbe, TrackedProbe } from "#test/sessionProbes.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

function eventually(assert: () => void) {
	return vi.waitFor(async () => {
		await act(async (): Promise<void> => undefined);
		assert();
	});
}

it("each session generation owns a fresh client and registry; switching, signing out and re-entering discard the previous one", async () => {
	const server = await startOrderServer({ sessions: sessions() });
	const view = shell(server.url);
	try {
		await view.show({ id: "a1", token: "alice-token" }, 1);
		await eventually(() => expect(view.container.textContent).toContain("Printer paper / 300"));
		await view.edit("Alice draft");
		await view.show({ id: "a1", token: "alice-token" }, 1);
		expect(view.input()?.value).toBe("Alice draft");
		expect(view.registries).toHaveLength(1);

		await view.show({ id: "b1", token: "bob-token" }, 2);
		await eventually(() => expect(view.input()?.value).toBe("Desk lamps"));
		expect(view.container.textContent).not.toContain("Printer paper");
		expect(view.registries[0]?.getNodes().size).toBe(0);

		await view.show(undefined, 1);
		expect(view.container.textContent).toBe("Signed out");
		expect(view.registries[1]?.getNodes().size).toBe(0);

		await view.show({ id: "a2", token: "alice-token" }, 1);
		await eventually(() => expect(view.input()?.value).toBe("Printer paper"));
		expect(view.container.textContent).not.toContain("Unsaved changes");
		expect(view.registries).toHaveLength(3);
		expect(view.rechecks).toEqual([]);
	} finally {
		await view.close();
		await server.close();
	}
	expect(view.registries[2]?.getNodes().size).toBe(0);
});

it("Unauthorized keeps the retained screen and asks the auth owner to re-check; its expiry verdict tears the session down", async () => {
	const active = sessions();
	const server = await startOrderServer({ sessions: active });
	const view = shell(server.url);
	try {
		await view.show({ id: "a1", token: "alice-token" }, 1);
		await eventually(() => expect(view.container.textContent).toContain("Printer paper / 300"));
		await view.edit("Unsaved order");
		active.delete("alice-token");
		await view.refresh();
		await eventually(() => expect(view.rechecks).toEqual(["a1"]));
		expect(view.container.textContent).toContain("Printer paper / 300");
		expect(view.input()?.value).toBe("Unsaved order");

		await view.show(undefined, 1);
		expect(view.container.textContent).toBe("Signed out");
		expect(view.registries[0]?.getNodes().size).toBe(0);
		expect(view.rechecks).toEqual(["a1"]);
	} finally {
		await view.close();
		await server.close();
	}
});

it("refresh retry recovers without losing the session's dirty form", async () => {
	const active = sessions();
	const server = await startOrderServer({ sessions: active });
	const view = shell(server.url);
	try {
		await view.show({ id: "a1", token: "alice-token" }, 1);
		await eventually(() => expect(view.container.textContent).toContain("Printer paper / 300"));
		await view.edit("Unsaved order");
		active.delete("alice-token");
		await view.refresh();
		await eventually(() => expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("Could not load"));
		expect(view.input()?.value).toBe("Unsaved order");
		active.set("alice-token", { expiresAt: Number.POSITIVE_INFINITY, userId: "alice" });
		await view.refresh();
		await eventually(() => expect(view.container.querySelector('[role="alert"]')).toBeNull());
		expect(view.input()?.value).toBe("Unsaved order");
	} finally {
		await view.close();
		await server.close();
	}
});

it("StrictMode's effect replay keeps the generation's registry alive until the real unmount", async () => {
	const container = document.createElement("div");
	const root = createRoot(container);
	const count = Atom.make(Effect.succeed(41));
	const held: RegistryHolder = {};
	function render(session: string | undefined) {
		return act(async () => {
			root.render(
				<StrictMode>
					<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={session}>
						{() => <ReplayProbe count={count} held={held} />}
					</SessionBoundary>
				</StrictMode>,
			);
			await Promise.resolve();
		});
	}
	await render("s1");
	expect(container.textContent).toBe("42");
	expect(held.registry?.getNodes().size).toBeGreaterThan(0);
	const first = held.registry;
	await render(undefined);
	expect(container.textContent).toBe("");
	expect(first?.getNodes().size).toBe(0);
	await act(async () => root.unmount());
});

async function activity(hoisted: boolean) {
	const count = Atom.make(Effect.succeed(41));
	const registries: AtomRegistry.AtomRegistry[] = [];
	function boundary() {
		return (
			<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session="s1">
				{() => <DraftProbe count={count} registries={registries} />}
			</SessionBoundary>
		);
	}
	const kept = boundary();
	const container = document.createElement("div");
	const root = createRoot(container);
	const errors: unknown[] = [];
	async function render(mode: "visible" | "hidden") {
		try {
			await act(async () => {
				root.render(<Activity mode={mode}>{hoisted ? kept : boundary()}</Activity>);
				await Promise.resolve();
			});
		} catch (error) {
			errors.push(error);
		}
	}
	await render("visible");
	expect(errors).toEqual([]);
	expect(container.textContent).toBe("draft-1:42");
	await render("hidden");
	await render("visible");
	expect(errors).toEqual([]);
	expect(container.textContent).toBe("draft-1:42");
	expect(registries.at(-1)?.getNodes().size).toBeGreaterThan(0);
	await act(async () => root.unmount());
	expect(registries.map((registry) => registry.getNodes().size)).toEqual(registries.map(() => 0));
}

it("a generation hidden by <Activity> and revealed keeps its state on a live registry", () => activity(false));

it("a hoisted generation element hidden by <Activity> and revealed keeps its state on a live registry", () => activity(true));

it("a generation re-rendered while hidden by <Activity> and then unmounted disposes what the hidden render created", async () => {
	const built: number[] = [];
	const finalized: number[] = [];
	const rendered: number[] = [];
	const held = Atom.keepAlive(
		Atom.make((get) => {
			built.push(1);
			get.addFinalizer(() => finalized.push(1));
			return 1;
		}),
	);
	const container = document.createElement("div");
	const root = createRoot(container);
	function render(mode: "visible" | "hidden", round: number) {
		return act(async () => {
			root.render(
				<Activity mode={mode}>
					<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session="s1">
						{() => <TrackedProbe held={held} rendered={rendered} round={round} />}
					</SessionBoundary>
				</Activity>,
			);
			await Promise.resolve();
		});
	}
	await render("visible", 1);
	await render("hidden", 1);
	await render("hidden", 2);
	expect(rendered).toContain(2);
	expect(built.length).toBeGreaterThan(1);
	await act(async () => root.unmount());
	await eventually(() => expect(finalized).toHaveLength(built.length));
});

it("connect runs once per identity: a rotated credential reaches the client only when identify includes its generation", async () => {
	interface Rotating {
		readonly credential: number;
		readonly id: string;
		readonly token: string;
	}
	const container = document.createElement("div");
	const root = createRoot(container);
	const connected: string[] = [];
	function show(session: Rotating, identify: (session: Rotating) => string) {
		return act(async () => {
			root.render(
				<SessionBoundary
					connect={(current) => {
						connected.push(current.token);
						return current.token;
					}}
					identify={identify}
					recheck={() => undefined}
					session={session}
				>
					{(token) => <output>{token}</output>}
				</SessionBoundary>,
			);
			await Promise.resolve();
		});
	}
	function byId(session: Rotating) {
		return session.id;
	}
	await show({ credential: 1, id: "a1", token: "t1" }, byId);
	await show({ credential: 2, id: "a1", token: "t2" }, byId);
	expect(container.textContent).toBe("t1");
	function byCredential(session: Rotating) {
		return `${session.id}:${session.credential}`;
	}
	await show({ credential: 2, id: "a1", token: "t2" }, byCredential);
	await show({ credential: 3, id: "a1", token: "t3" }, byCredential);
	expect(container.textContent).toBe("t3");
	expect(connected).toEqual(["t1", "t2", "t3"]);
	await act(async () => root.unmount());
});

it("revealing an Activity before hidden cleanup runs preserves its registry, including atoms added after reveal", async () => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	const view = activityRegistry();
	try {
		await view.render("visible", 1);
		const outgoing = view.registry();
		await view.render("hidden", 1);
		await view.render("hidden", 2);
		const revealed = view.registry();
		expect(revealed).not.toBe(outgoing);
		expect(view.built).toEqual(["first", "first", "second"]);
		expect(view.finalized).toEqual(["first"]);
		await view.render("visible", 2);
		await act(async () => vi.runOnlyPendingTimers());
		expect(view.registry()).toBe(revealed);
		expect(view.finalized).toEqual(["first"]);
		await view.render("visible", 3);
		await act(async () => vi.runOnlyPendingTimers());
		expect(view.container.textContent).toBe("retained draftfirstsecondthird");
		expect(view.built).toEqual(["first", "first", "second", "third"]);
		expect(view.finalized).toEqual(["first"]);
	} finally {
		await view.close();
		vi.useRealTimers();
	}
	expect(view.finalized).toHaveLength(view.built.length);
});
