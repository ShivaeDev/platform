import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { InvoiceLine } from "#test/invoice-line-editor/backend.ts";
import { creating, editing, oneShot, type Session, switching } from "./invoiceScreens.tsx";
import { type Field, inputs, invoiceVerbs, root, type State, server, sessions, text } from "./invoiceVerbs.ts";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

export const invoices = storyKit(
	screenKit(
		"invoice screen",
		(): State => ({}),
		(state, screen) => ({
			...invoiceVerbs(state, screen),
			alerts: () => Effect.sync(() => [...root(state).container.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent)),
			completed: () =>
				Effect.sync(
					() =>
						[...root(state).container.querySelectorAll("output")]
							.map((output) => output.textContent ?? "")
							.find((line) => line.startsWith("Created") || line.startsWith("Completed")) ?? "none",
				),
			field: (name: Field) => Effect.sync(() => root(state).container.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? "missing"),
			fieldError: (name: Field) => Effect.sync(() => root(state).container.querySelector(`[data-error="${name}"]`)?.textContent ?? "none"),
			form: () =>
				Effect.sync(() => {
					const now = inputs(root(state).container);
					return state.inputs?.every((element, index) => element !== null && element === now[index]) ? "same form and inputs" : "remounted";
				}),
			lineReads: () => Effect.sync(() => server(state).control.gets),
			rechecks: () => Effect.sync(() => [...sessions(state).rechecks]),
			registry: (session: Session) =>
				Effect.sync(() => {
					const nodes = sessions(state).registries[session]?.getNodes().size;
					return nodes === 0 ? "released" : `holding ${nodes} atoms`;
				}),
			savedDrafts: () => Effect.sync(() => [...server(state).control.savedDrafts]),
			screenText: () => Effect.sync(() => text(state)),
			shownLine: () => Effect.sync(() => root(state).container.querySelector("section output")?.textContent ?? "none"),
			status: () => Effect.sync(() => root(state).container.querySelector('[role="status"]')?.textContent ?? "none"),
			storedLine: (id: number) => Effect.sync(() => ({ ...server(state).stored(id) })),
		}),
	),
);

interface Engine {
	readonly screen: Screen;
	readonly state: State;
}

function* openEditor({ screen, state }: Engine) {
	state.root = yield* screen.open();
	state.editor = editing(state.root);
	state.server = state.editor.server;
	state.held = state.server.hold();
	yield* screen.act("open the invoice editor on line 1", () => state.editor?.show(1));
}

function* loaded(engine: Engine) {
	yield* openEditor(engine);
	yield* invoiceVerbs(engine.state, engine.screen).finishHeld();
}

export function lineLoaded() {
	return invoices.trait("screen", "the invoice editor showing line 1, Stapler / 150", loaded);
}

export function lineEdited(field: Field, value: string) {
	return invoices.trait("screen", `the invoice editor showing Stapler / 150 with ${field} edited to ${JSON.stringify(value)}`, function* (engine) {
		yield* loaded(engine);
		const { markForm, type } = invoiceVerbs(engine.state, engine.screen);
		yield* type(field, value);
		yield* markForm();
	});
}

export function refreshFailedWithDraft() {
	return invoices.trait("screen", "the invoice editor holding the draft Blue stapler after a refresh failed", function* (engine) {
		yield* loaded(engine);
		const { markForm, refresh, serverIs, type } = invoiceVerbs(engine.state, engine.screen);
		yield* type("name", "Blue stapler");
		yield* markForm();
		yield* serverIs("unavailable");
		yield* refresh();
	});
}

export function editorSaveHeld() {
	return invoices.trait("screen", 'the invoice editor waiting on a held save of the name "  blue stapler "', function* (engine) {
		yield* loaded(engine);
		const { holdNextRequest, save, type } = invoiceVerbs(engine.state, engine.screen);
		yield* type("name", "  blue stapler ");
		yield* holdNextRequest();
		yield* save();
	});
}

export function quantityRejected() {
	return invoices.trait("screen", "the invoice editor after the server rejected the quantity 9000", function* (engine) {
		yield* loaded(engine);
		const { save, type } = invoiceVerbs(engine.state, engine.screen);
		yield* type("quantity", "9000");
		yield* save();
	});
}

export function draftDroppedForLineTwo() {
	return invoices.trait("screen", "the invoice editor moved to line 2 while line 1 held the draft name Draft", function* (engine) {
		yield* loaded(engine);
		const { show, type } = invoiceVerbs(engine.state, engine.screen);
		yield* type("name", "Draft");
		yield* show(2);
	});
}

function* openCreate({ screen, state }: Engine) {
	state.root = yield* screen.open();
	const created = creating(state.root);
	state.server = created.server;
	yield* screen.act("open the invoice create form", () => created.show());
}

export function createSaveHeld() {
	return invoices.trait("screen", "the invoice create form waiting on a held create of pencil / 120", function* (engine) {
		yield* openCreate(engine);
		const { holdNextRequest, save, type } = invoiceVerbs(engine.state, engine.screen);
		yield* type("name", "pencil");
		yield* type("quantity", "120");
		yield* holdNextRequest();
		yield* save();
	});
}

export function createdWhileFolderTyped() {
	return invoices.trait("screen", "the invoice create form after creating Pencil while Folder was typed", function* (engine) {
		yield* openCreate(engine);
		const { finishHeld, holdNextRequest, save, type } = invoiceVerbs(engine.state, engine.screen);
		yield* type("name", "pencil");
		yield* type("quantity", "120");
		yield* holdNextRequest();
		yield* save();
		yield* type("name", "Folder");
		yield* finishHeld();
	});
}

function* openOneShot({ screen, state }: Engine) {
	state.root = yield* screen.open();
	const opened = oneShot(state.root);
	state.server = opened.server;
	yield* screen.act("open the one-shot form", () => opened.show());
}

export function oneShotLine() {
	return invoices.trait("screen", "a one-shot invoice form that opens line 7 at version 3 without a query", openOneShot);
}

export function oneShotSaveHeld() {
	return invoices.trait("screen", "a one-shot invoice form waiting on a held save of Blue stapler", function* (engine) {
		yield* openOneShot(engine);
		const { holdNextRequest, save, type } = invoiceVerbs(engine.state, engine.screen);
		yield* type("name", "Blue stapler");
		yield* holdNextRequest();
		yield* save();
	});
}

function* openSessions({ screen, state }: Engine) {
	state.root = yield* screen.open();
	state.sessions = switching(state.root);
}

export function aliceEditing() {
	return invoices.trait("screen", "Alice editing her Stapler line with the draft name Alice draft", function* (engine) {
		yield* openSessions(engine);
		const { showSession, type } = invoiceVerbs(engine.state, engine.screen);
		yield* showSession("alice");
		yield* type("name", "Alice draft");
	});
}

export function bobAfterAlice() {
	return invoices.trait("screen", "Bob's session shown after Alice edited her line", function* (engine) {
		yield* openSessions(engine);
		const { showSession, type } = invoiceVerbs(engine.state, engine.screen);
		yield* showSession("alice");
		yield* type("name", "Alice draft");
		yield* showSession("bob");
	});
}

export const theirStapler = new InvoiceLine({ id: 7, name: "Their stapler", quantity: 200, version: 4 });
