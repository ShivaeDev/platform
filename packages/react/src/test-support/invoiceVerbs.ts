import { Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import type { InvoiceLine, makeInvoiceLineServer } from "#test/invoice-line-editor/backend.ts";
import type { editing, Session, switching } from "./invoiceScreens.tsx";
import { clickButton, type Screen, typeInput } from "./Screen.ts";
import { settleScreen } from "./settleScreen.ts";

type Server = ReturnType<typeof makeInvoiceLineServer>;
export type Field = "name" | "quantity";

export interface State {
	editor?: ReturnType<typeof editing>;
	held?: () => void;
	inputs?: readonly (Element | null)[];
	root?: Rendered;
	server?: Server | undefined;
	sessions?: ReturnType<typeof switching>;
}

export function root(state: State) {
	if (!state.root) {
		throw new Error("No invoice screen");
	}
	return state.root;
}

export function server(state: State) {
	if (!state.server) {
		throw new Error("No invoice server");
	}
	return state.server;
}

export function sessions(state: State) {
	if (!state.sessions) {
		throw new Error("No invoice session screen");
	}
	return state.sessions;
}

export function inputs(container: Element) {
	return [container.querySelector("form"), container.querySelector('input[name="name"]'), container.querySelector('input[name="quantity"]')];
}

function busy(container: Element) {
	return (
		container.querySelector('[data-pending="true"]') !== null
		|| container.textContent?.includes("Loading") === true
		|| container.querySelector('[role="status"]')?.textContent === "Saving"
	);
}

function settle(state: State, screen: Screen) {
	return Effect.suspend(() => {
		const { container } = root(state);
		return settleScreen(container, () => state.held === undefined && busy(container), screen.tell);
	});
}

export function invoiceVerbs(state: State, screen: Screen) {
	function click(label: string) {
		return screen.act(`click ${label}`, () => clickButton(root(state).container, label)).pipe(Effect.andThen(settle(state, screen)));
	}
	return {
		finishHeld: () =>
			screen
				.act("the held invoice request responds", () => {
					const release = state.held;
					if (!release) {
						throw new Error("No held invoice request");
					}
					delete state.held;
					release();
				})
				.pipe(Effect.andThen(settle(state, screen))),
		holdNextRequest: () =>
			Effect.sync(() => {
				screen.tell("the invoice server holds its next request");
				state.held = server(state).hold();
			}),
		markForm: () =>
			Effect.sync(() => {
				state.inputs = inputs(root(state).container);
			}),
		refresh: () => click("Refresh"),
		retry: () => click("Retry"),
		save: () => click("Save"),
		serverEdits: (row: InvoiceLine) =>
			Effect.sync(() => {
				screen.tell(`the server stores invoice line ${row.id} as ${row.name} / ${row.quantity} at version ${row.version}`);
				server(state).edit(row);
			}),
		serverIs: (mode: "available" | "unavailable") =>
			Effect.sync(() => {
				screen.tell(`the invoice server is ${mode}`);
				server(state).control.mode = mode === "available" ? "ok" : "unavailable";
			}),
		show: (id: number) => {
			const editor = state.editor;
			if (!editor) {
				return Effect.die(new Error("Expected an invoice editor"));
			}
			return screen.act(`navigate to invoice line ${id}`, () => editor.show(id)).pipe(Effect.andThen(settle(state, screen)));
		},
		showSession: (session: Session | undefined) =>
			screen
				.act(session ? `show ${session}'s session` : "sign out", () => sessions(state).show(session))
				.pipe(
					Effect.andThen(
						Effect.sync(() => {
							state.server = session ? sessions(state).servers[session] : undefined;
						}),
					),
					Effect.andThen(settle(state, screen)),
				),
		type: (name: Field, value: string) => screen.act(`type ${name}: ${JSON.stringify(value)}`, () => typeInput(root(state).container, name, value)),
		unauthorized: (session: Session) =>
			Effect.sync(() => {
				screen.tell(`${session}'s invoice requests are Unauthorized`);
				sessions(state).servers[session].control.mode = "unauthorized";
			}),
	};
}

export function text(state: State) {
	return root(state).container.textContent ?? "";
}
