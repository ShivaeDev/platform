import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { Activity, act, createElement, StrictMode, useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SessionBoundary } from "#session-boundary.ts";
import { startOrderServer } from "#test/order-example/http-test.ts";
import { sessions, shell } from "#test/support/session.ts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const eventually = (assert: () => void) =>
	vi.waitFor(async () => {
		await act(async () => {});
		assert();
	});

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
	let registry: AtomRegistry.AtomRegistry | undefined;
	const Probe = () => {
		registry = useContext(RegistryContext);
		const value = useAtomValue(count);
		return createElement("output", null, value._tag === "Success" ? value.value + 1 : "…");
	};
	const render = (session: string | undefined) =>
		act(async () => {
			root.render(
				createElement(
					StrictMode,
					null,
					createElement(SessionBoundary<string, undefined>, {
						children: () => createElement(Probe),
						connect: () => undefined,
						identify: (id) => id,
						recheck: () => {},
						session,
					}),
				),
			);
		});
	await render("s1");
	expect(container.textContent).toBe("42");
	expect(registry?.getNodes().size).toBeGreaterThan(0);
	const first = registry;
	await render(undefined);
	expect(container.textContent).toBe("");
	expect(first?.getNodes().size).toBe(0);
	await act(async () => root.unmount());
});

const activity = async (hoisted: boolean) => {
	const count = Atom.make(Effect.succeed(41));
	const registries: AtomRegistry.AtomRegistry[] = [];
	const Probe = () => {
		const registry = useContext(RegistryContext);
		if (!registries.includes(registry)) {
			registries.push(registry);
		}
		const [draft] = useState(() => `draft-${registries.length}`);
		const value = useAtomValue(count);
		return createElement("output", null, `${draft}:${value._tag === "Success" ? value.value + 1 : "…"}`);
	};
	const boundary = () =>
		createElement(SessionBoundary<string, undefined>, {
			children: () => createElement(Probe),
			connect: () => undefined,
			identify: (id) => id,
			recheck: () => {},
			session: "s1",
		});
	const kept = boundary();
	const container = document.createElement("div");
	const root = createRoot(container);
	const errors: unknown[] = [];
	const render = (mode: "visible" | "hidden") =>
		act(async () => {
			root.render(createElement(Activity, { children: hoisted ? kept : boundary(), mode }));
		}).then(
			() => {},
			(error: unknown) => {
				errors.push(error);
			},
		);
	await render("visible");
	expect(container.textContent).toBe("draft-1:42");
	await render("hidden");
	await render("visible");
	expect(errors).toEqual([]);
	expect(container.textContent).toBe("draft-1:42");
	expect(registries.at(-1)?.getNodes().size).toBeGreaterThan(0);
	await act(async () => root.unmount());
	expect(registries.map((registry) => registry.getNodes().size)).toEqual(registries.map(() => 0));
};

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
	const Probe = ({ round }: { readonly round: number }) => {
		rendered.push(round);
		return createElement("output", null, `${round}:${useAtomValue(held)}`);
	};
	const container = document.createElement("div");
	const root = createRoot(container);
	const render = (mode: "visible" | "hidden", round: number) =>
		act(async () => {
			root.render(
				createElement(Activity, {
					children: createElement(SessionBoundary<string, undefined>, {
						children: () => createElement(Probe, { round }),
						connect: () => undefined,
						identify: (id) => id,
						recheck: () => {},
						session: "s1",
					}),
					mode,
				}),
			);
		});
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
	const show = (session: Rotating, identify: (session: Rotating) => string) =>
		act(async () => {
			root.render(
				createElement(SessionBoundary<Rotating, string>, {
					children: (token) => createElement("output", null, token),
					connect: (current) => {
						connected.push(current.token);
						return current.token;
					},
					identify,
					recheck: () => {},
					session,
				}),
			);
		});
	const byId = (session: Rotating) => session.id;
	await show({ credential: 1, id: "a1", token: "t1" }, byId);
	await show({ credential: 2, id: "a1", token: "t2" }, byId);
	expect(container.textContent).toBe("t1");
	const byCredential = (session: Rotating) => `${session.id}:${session.credential}`;
	await show({ credential: 2, id: "a1", token: "t2" }, byCredential);
	await show({ credential: 3, id: "a1", token: "t3" }, byCredential);
	expect(container.textContent).toBe("t3");
	expect(connected).toEqual(["t1", "t2", "t3"]);
	await act(async () => root.unmount());
});
