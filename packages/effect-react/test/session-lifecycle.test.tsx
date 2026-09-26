// @vitest-environment happy-dom
import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { makeOrderEditor } from "./order-example/frontend.tsx";
import { startOrderServer } from "./order-example/http-test.ts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const eventually = (assert: () => void) =>
	vi.waitFor(async () => {
		await act(async () => {});
		assert();
	});

const mountSessions = (url: string) => {
	window.location.href = url;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	let previous: AtomRegistry.AtomRegistry | undefined;
	let generation = 0;
	return {
		container,
		enter: async (token: string, id: number) => {
			const old = previous;
			const registry = AtomRegistry.make();
			const { api, Editor } = makeOrderEditor({ url, token });
			previous = registry;
			await act(async () => {
				root.render(createElement(RegistryContext.Provider, { key: ++generation, value: registry }, createElement(Editor, { id })));
			});
			old?.dispose();
			return { registry, query: api.get.query({ id }) };
		},
		edit: async (value: string) => {
			const input = container.querySelector<HTMLInputElement>('input[name="name"]');
			if (!input) throw new Error("Missing name input");
			await act(async () => {
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
				input.dispatchEvent(new Event("input", { bubbles: true }));
				input.dispatchEvent(new Event("change", { bubbles: true }));
			});
		},
		refresh: async () => {
			const button = [...container.querySelectorAll("button")].find((button) => button.textContent === "Refresh");
			if (!button) throw new Error("Missing refresh button");
			await act(async () => button.click());
		},
		close: async () => {
			await act(async () => root.unmount());
			previous?.dispose();
			container.remove();
		},
	};
};

const sessions = () =>
	new Map([
		["alice-session", { userId: "alice", expiresAt: Number.POSITIVE_INFINITY }],
		["bob-session", { userId: "bob", expiresAt: Number.POSITIVE_INFINITY }],
	]);

test("replacing an authenticated session discards its cached data and dirty form, including on reentry", async () => {
	const server = await startOrderServer({ sessions: sessions() });
	const view = mountSessions(server.url);
	try {
		const alice = await view.enter("alice-session", 1);
		await eventually(() => expect(view.container.textContent).toContain("Printer paper / 300"));
		await view.edit("Alice private draft");
		expect(view.container.textContent).toContain("Unsaved changes");
		expect(view.container.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe("Alice private draft");
		const bobDenied = await view.enter("bob-session", 1);
		expect(view.container.querySelector("input")).toBeNull();
		expect(view.container.textContent).not.toContain("Printer paper");
		expect(alice.registry.getNodes().size).toBe(0);
		expect(() => alice.registry.get(alice.query)).toThrow("registry is disposed");
		await eventually(() => expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("Could not load"));
		expect(view.container.querySelector("input")).toBeNull();
		const bob = await view.enter("bob-session", 2);
		await eventually(() => expect(view.container.textContent).toContain("Desk lamps / 200"));
		expect(bobDenied.registry.getNodes().size).toBe(0);
		expect(view.container.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe("Desk lamps");
		await view.enter("alice-session", 1);
		await eventually(() => expect(view.container.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe("Printer paper"));
		expect(view.container.textContent).not.toContain("Unsaved changes");
		expect(bob.registry.getNodes().size).toBe(0);
	} finally {
		await view.close();
		await server.close();
	}
});

test("refresh failure retains the same-session draft and previous value; retry recovers and teardown clears the registry", async () => {
	const active = sessions();
	const server = await startOrderServer({ sessions: active });
	const view = mountSessions(server.url);
	const alice = await view.enter("alice-session", 1);
	try {
		await eventually(() => expect(view.container.textContent).toContain("Printer paper / 300"));
		await view.edit("Unsaved order");
		active.delete("alice-session");
		await view.refresh();
		await eventually(() => expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("Could not load"));
		expect(view.container.textContent).toContain("Printer paper / 300");
		expect(view.container.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe("Unsaved order");
		active.set("alice-session", {
			userId: "alice",
			expiresAt: Number.POSITIVE_INFINITY,
		});
		await view.refresh();
		await eventually(() => expect(view.container.querySelector('[role="alert"]')).toBeNull());
		expect(view.container.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe("Unsaved order");
	} finally {
		await view.close();
		await server.close();
	}
	expect(alice.registry.getNodes().size).toBe(0);
	expect(() => alice.registry.get(alice.query)).toThrow("registry is disposed");
});
