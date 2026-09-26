// @vitest-environment happy-dom
import { RegistryContext } from "@effect/atom-react";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, type ReactNode, useContext } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { SessionBoundary } from "../src/index.ts";
import { Food, makeFoodServer } from "./food-editor/backend.ts";
import { makeFoodViews } from "./food-editor/frontend.ts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const apple = new Food({ id: 1, name: "Apple", grams: 150 });
const pear = new Food({ id: 2, name: "Pear", grams: 180 });

const mount = () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	cleanups.push(async () => {
		await act(async () => root.unmount());
		container.remove();
	});
	const input = (name: string) => container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
	return {
		container,
		render: (node: ReactNode) => act(async () => root.render(node)),
		text: () => container.textContent ?? "",
		value: (name: string) => input(name)?.value,
		error: (name: string) => container.querySelector(`[data-error="${name}"]`)?.textContent,
		status: () => container.querySelector('[role="status"]')?.textContent,
		alerts: () => [...container.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent),
		type: (name: string, value: string) =>
			act(async () => {
				const field = input(name);
				if (!field) throw new Error(`Missing ${name}`);
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
				field.dispatchEvent(new Event("input", { bubbles: true }));
			}),
		click: (label: string) => act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === label)?.click()),
	};
};

const settle = (assert: () => void) =>
	vi.waitFor(async () => {
		await act(async () => {});
		assert();
	});

const editing = async (id = 1) => {
	const server = makeFoodServer([apple, pear]);
	const { FoodEditor } = makeFoodViews(server);
	const view = mount();
	const release = server.hold();
	let registry: AtomRegistry.AtomRegistry | undefined;
	const Probe = () => {
		registry = useContext(RegistryContext);
		return null;
	};
	const show = (current: number) =>
		view.render(
			createElement(SessionBoundary<string, undefined>, {
				session: "s1",
				identify: (session) => session,
				connect: () => undefined,
				recheck: () => {},
				children: () => [createElement(Probe, { key: "probe" }), createElement(FoodEditor, { key: "editor", id: current })],
			}),
		);
	await show(id);
	expect(view.text()).toContain("Loading");
	expect(view.value("name")).toBeUndefined();
	release();
	await settle(() => expect(view.value("name")).toBe("Apple"));
	return { server, view, show, registry: () => registry };
};

test("loading, then a refresh failure keeps the data and dirty edits; retry recovers", async () => {
	const { server, view } = await editing();
	await view.type("name", "Green apple");
	server.control.mode = "unavailable";
	await view.click("Refresh");
	await settle(() => expect(view.alerts()).toContain("Could not load"));
	expect(view.text()).toContain("Apple / 150");
	expect(view.value("name")).toBe("Green apple");
	server.control.mode = "ok";
	await view.click("Refresh");
	await settle(() => expect(view.alerts()).toEqual([]));
	expect(view.value("name")).toBe("Green apple");
	expect(view.status()).toBe("Unsaved");
});

test("a refresh while dirty adopts untouched fields and keeps edited ones", async () => {
	const { server, view } = await editing();
	await view.type("name", "Red apple");
	server.edit(new Food({ id: 1, name: "Apple", grams: 175 }));
	await view.click("Refresh");
	await settle(() => expect(view.value("grams")).toBe("175"));
	expect(view.value("name")).toBe("Red apple");
});

test("save shows server normalization, keeps edits made while saving and ignores a second submit", async () => {
	const { server, view } = await editing();
	await view.type("name", "  green apple ");
	const release = server.hold();
	await view.click("Save");
	await settle(() => expect(view.status()).toBe("Saving"));
	await view.type("grams", "160");
	await view.click("Save");
	release();
	await settle(() => expect(view.value("name")).toBe("Green apple"));
	expect(view.value("grams")).toBe("160");
	expect(view.status()).toBe("Unsaved");
	expect(server.control.saves).toBe(1);
	expect(server.stored(1)).toEqual(new Food({ id: 1, name: "Green apple", grams: 150 }));
});

test("field rejections attach to their field; other failures are exposed separately", async () => {
	const { server, view } = await editing();
	await view.type("grams", "9000");
	await view.click("Save");
	await settle(() => expect(view.error("grams")).toBe("Too heavy"));
	expect(view.alerts()).toEqual([]);
	await view.type("grams", "200");
	expect(view.error("grams")).toBeUndefined();
	server.control.mode = "unavailable";
	await view.click("Save");
	await settle(() => expect(view.alerts()).toEqual(["Could not save"]));
	expect(view.value("grams")).toBe("200");
	expect(server.stored(1)).toEqual(apple);
});

test("a different key remounts the form without carrying the previous draft", async () => {
	const { view, show } = await editing();
	await view.type("name", "Draft");
	await show(2);
	await settle(() => expect(view.value("name")).toBe("Pear"));
	expect(view.status()).toBe("Saved");
	await show(1);
	await settle(() => expect(view.value("name")).toBe("Apple"));
});

test("create resets to its initial values after success, keeping fields edited during the save", async () => {
	const server = makeFoodServer([apple]);
	const { FoodCreate } = makeFoodViews(server);
	const view = mount();
	await view.render(
		createElement(SessionBoundary<string, undefined>, {
			session: "s1",
			identify: (session) => session,
			connect: () => undefined,
			recheck: () => {},
			children: () => createElement(FoodCreate),
		}),
	);
	await view.type("name", "banana");
	await view.type("grams", "120");
	const release = server.hold();
	await view.click("Save");
	await settle(() => expect(view.status()).toBe("Saving"));
	await view.type("name", "Kiwi");
	release();
	await settle(() => expect(view.text()).toContain("Created 2: Banana"));
	expect(view.value("name")).toBe("Kiwi");
	expect(view.value("grams")).toBe("");
	expect(view.error("grams")).toBeUndefined();
	expect(view.status()).toBe("Unsaved");
	await view.type("grams", "40");
	await view.click("Save");
	await settle(() => expect(view.text()).toContain("Created 3: Kiwi"));
	expect([view.value("name"), view.value("grams"), view.status()]).toEqual(["", "", "Saved"]);
});

test("switching session tears down the editor, its draft and its registry; Unauthorized asks for a re-check", async () => {
	const servers = { alice: makeFoodServer([apple]), bob: makeFoodServer([new Food({ id: 1, name: "Bread", grams: 80 })]) };
	const rechecks: string[] = [];
	const registries: AtomRegistry.AtomRegistry[] = [];
	const view = mount();
	const Probe = () => {
		const registry = useContext(RegistryContext);
		if (!registries.includes(registry)) registries.push(registry);
		return null;
	};
	const show = (session: "alice" | "bob" | undefined) =>
		view.render(
			createElement(SessionBoundary<"alice" | "bob", ReturnType<typeof makeFoodViews>>, {
				session,
				identify: (user) => user,
				connect: (user) => makeFoodViews(servers[user]),
				recheck: () => rechecks.push(session ?? "none"),
				signedOut: "Signed out",
				children: ({ FoodEditor }) => [createElement(Probe, { key: "probe" }), createElement(FoodEditor, { key: "editor", id: 1 })],
			}),
		);
	await show("alice");
	await settle(() => expect(view.value("name")).toBe("Apple"));
	await view.type("name", "Alice draft");
	servers.alice.control.mode = "unauthorized";
	await view.click("Refresh");
	await settle(() => expect(rechecks).toEqual(["alice"]));
	expect(view.value("name")).toBe("Alice draft");
	await show("bob");
	await settle(() => expect(view.value("name")).toBe("Bread"));
	expect(view.text()).not.toContain("Apple");
	expect(registries[0]?.getNodes().size).toBe(0);
	await show(undefined);
	expect(view.text()).toBe("Signed out");
	expect(registries[1]?.getNodes().size).toBe(0);
});
