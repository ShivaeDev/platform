import { RegistryContext } from "@effect/atom-react";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, type ReactNode, useContext } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { SessionBoundary } from "#index.ts";
import { InvoiceLine, makeInvoiceLineServer } from "#test/invoice-line-editor/backend.ts";
import { makeInvoiceLineViews } from "#test/invoice-line-editor/frontend.ts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) {
		await cleanup();
	}
});

const stapler = new InvoiceLine({ id: 1, name: "Stapler", quantity: 150 });
const notebook = new InvoiceLine({ id: 2, name: "Notebook", quantity: 180 });

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
		alerts: () => [...container.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent),
		click: (label: string) => act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === label)?.click()),
		container,
		error: (name: string) => container.querySelector(`[data-error="${name}"]`)?.textContent,
		render: (node: ReactNode) => act(async () => root.render(node)),
		status: () => container.querySelector('[role="status"]')?.textContent,
		text: () => container.textContent ?? "",
		type: (name: string, value: string) =>
			act(async () => {
				const field = input(name);
				if (!field) {
					throw new Error(`Missing ${name}`);
				}
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
				field.dispatchEvent(new Event("input", { bubbles: true }));
			}),
		value: (name: string) => input(name)?.value,
	};
};

const settle = (assert: () => void) =>
	vi.waitFor(async () => {
		await act(async () => {});
		assert();
	});

const editing = async (id = 1) => {
	const server = makeInvoiceLineServer([stapler, notebook]);
	const { InvoiceLineEditor } = makeInvoiceLineViews(server);
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
				children: () => [createElement(Probe, { key: "probe" }), createElement(InvoiceLineEditor, { id: current, key: "editor" })],
				connect: () => undefined,
				identify: (session) => session,
				recheck: () => {},
				session: "s1",
			}),
		);
	await show(id);
	expect(view.text()).toContain("Loading");
	expect(view.value("name")).toBeUndefined();
	release();
	await settle(() => expect(view.value("name")).toBe("Stapler"));
	return { registry: () => registry, server, show, view };
};

it("loading, then a refresh failure keeps the data and dirty edits; retry recovers", async () => {
	const { server, view } = await editing();
	await view.type("name", "Blue stapler");
	server.control.mode = "unavailable";
	await view.click("Refresh");
	await settle(() => expect(view.alerts()).toContain("Could not load"));
	expect(view.text()).toContain("Stapler / 150");
	expect(view.value("name")).toBe("Blue stapler");
	server.control.mode = "ok";
	await view.click("Refresh");
	await settle(() => expect(view.alerts()).toEqual([]));
	expect(view.value("name")).toBe("Blue stapler");
	expect(view.status()).toBe("Unsaved");
});

it("a refresh while dirty adopts untouched fields and keeps edited ones", async () => {
	const { server, view } = await editing();
	await view.type("name", "Black stapler");
	server.edit(new InvoiceLine({ id: 1, name: "Stapler", quantity: 175 }));
	await view.click("Refresh");
	await settle(() => expect(view.value("quantity")).toBe("175"));
	expect(view.value("name")).toBe("Black stapler");
});

it("save shows server normalization, keeps edits made while saving and ignores a second submit", async () => {
	const { server, view } = await editing();
	await view.type("name", "  blue stapler ");
	const release = server.hold();
	await view.click("Save");
	await settle(() => expect(view.status()).toBe("Saving"));
	await view.type("quantity", "160");
	await view.click("Save");
	release();
	await settle(() => expect(view.value("name")).toBe("Blue stapler"));
	expect(view.value("quantity")).toBe("160");
	expect(view.status()).toBe("Unsaved");
	expect(server.control.saves).toBe(1);
	expect(server.stored(1)).toEqual(new InvoiceLine({ id: 1, name: "Blue stapler", quantity: 150 }));
});

it("field rejections attach to their field; other failures are exposed separately", async () => {
	const { server, view } = await editing();
	await view.type("quantity", "9000");
	await view.click("Save");
	await settle(() => expect(view.error("quantity")).toBe("Quantity is too large"));
	expect(view.alerts()).toEqual([]);
	await view.type("quantity", "200");
	expect(view.error("quantity")).toBeUndefined();
	server.control.mode = "unavailable";
	await view.click("Save");
	await settle(() => expect(view.alerts()).toEqual(["Could not save"]));
	expect(view.value("quantity")).toBe("200");
	expect(server.stored(1)).toEqual(stapler);
});

it("a different key remounts the form without carrying the previous draft", async () => {
	const { view, show } = await editing();
	await view.type("name", "Draft");
	await show(2);
	await settle(() => expect(view.value("name")).toBe("Notebook"));
	expect(view.status()).toBe("Saved");
	await show(1);
	await settle(() => expect(view.value("name")).toBe("Stapler"));
});

it("create resets to its initial values after success, keeping fields edited during the save", async () => {
	const server = makeInvoiceLineServer([stapler]);
	const { InvoiceLineCreate } = makeInvoiceLineViews(server);
	const view = mount();
	await view.render(
		createElement(SessionBoundary<string, undefined>, {
			children: () => createElement(InvoiceLineCreate),
			connect: () => undefined,
			identify: (session) => session,
			recheck: () => {},
			session: "s1",
		}),
	);
	await view.type("name", "pencil");
	await view.type("quantity", "120");
	const release = server.hold();
	await view.click("Save");
	await settle(() => expect(view.status()).toBe("Saving"));
	await view.type("name", "Folder");
	release();
	await settle(() => expect(view.text()).toContain("Created 2: Pencil"));
	expect(view.value("name")).toBe("Folder");
	expect(view.value("quantity")).toBe("");
	expect(view.error("quantity")).toBeUndefined();
	expect(view.status()).toBe("Unsaved");
	await view.type("quantity", "40");
	await view.click("Save");
	await settle(() => expect(view.text()).toContain("Created 3: Folder"));
	expect([view.value("name"), view.value("quantity"), view.status()]).toEqual(["", "", "Saved"]);
});

it("switching session tears down the editor, its draft and its registry; Unauthorized asks for a re-check", async () => {
	const servers = {
		alice: makeInvoiceLineServer([stapler]),
		bob: makeInvoiceLineServer([new InvoiceLine({ id: 1, name: "Envelope", quantity: 80 })]),
	};
	const rechecks: string[] = [];
	const registries: AtomRegistry.AtomRegistry[] = [];
	const view = mount();
	const Probe = () => {
		const registry = useContext(RegistryContext);
		if (!registries.includes(registry)) {
			registries.push(registry);
		}
		return null;
	};
	const show = (session: "alice" | "bob" | undefined) =>
		view.render(
			createElement(SessionBoundary<"alice" | "bob", ReturnType<typeof makeInvoiceLineViews>>, {
				children: ({ InvoiceLineEditor }) => [createElement(Probe, { key: "probe" }), createElement(InvoiceLineEditor, { id: 1, key: "editor" })],
				connect: (user) => makeInvoiceLineViews(servers[user]),
				identify: (user) => user,
				recheck: () => rechecks.push(session ?? "none"),
				session,
				signedOut: "Signed out",
			}),
		);
	await show("alice");
	await settle(() => expect(view.value("name")).toBe("Stapler"));
	await view.type("name", "Alice draft");
	servers.alice.control.mode = "unauthorized";
	await view.click("Refresh");
	await settle(() => expect(rechecks).toEqual(["alice"]));
	expect(view.value("name")).toBe("Alice draft");
	await show("bob");
	await settle(() => expect(view.value("name")).toBe("Envelope"));
	expect(view.text()).not.toContain("Stapler");
	expect(registries[0]?.getNodes().size).toBe(0);
	await show(undefined);
	expect(view.text()).toBe("Signed out");
	expect(registries[1]?.getNodes().size).toBe(0);
});
