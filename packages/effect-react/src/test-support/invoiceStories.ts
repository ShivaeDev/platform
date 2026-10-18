import { Effect } from "effect";
import { creating, editing, switching } from "./invoiceScreens.tsx";
import { screenKit } from "./screenKit.ts";

interface State {
	invoice?: Awaited<ReturnType<typeof editing>> | Awaited<ReturnType<typeof creating>>;
	sessions?: ReturnType<typeof switching>;
}
function invoice(state: State) {
	if (!state.invoice) {
		throw new Error("No invoice screen");
	}
	return state.invoice;
}
function sessions(state: State) {
	if (!state.sessions) {
		throw new Error("No invoice session screen");
	}
	return state.sessions;
}
export const invoices = screenKit(
	"invoice screen",
	(): State => ({}),
	(state, screen) => ({
		click: (label: string) => screen.act(`click ${label}`, () => (state.invoice ?? sessions(state)).view.click(label)),
		finishLoad: () =>
			screen.act("the invoice load responds", () => {
				const current = invoice(state);
				if (!("release" in current)) {
					throw new Error("Expected a loading editor");
				}
				current.release();
			}),
		invoice: () => invoice(state),
		sessions: () => sessions(state),
		show: (id: number) =>
			screen.act(`navigate to invoice line ${id}`, () => {
				const current = invoice(state);
				if (!("show" in current)) {
					throw new Error("Expected an editor");
				}
				return current.show(id);
			}),
		showSession: (session: "alice" | "bob" | undefined) => screen.act(`show session ${session}`, () => sessions(state).show(session)),
		type: (name: string, value: string) => screen.act(`type ${name}: ${value}`, () => (state.invoice ?? sessions(state)).view.type(name, value)),
	}),
);
export function editingLine() {
	return invoices.trait("screen", "the invoice editor loads Stapler through native RPC", function* ({ screen, state }) {
		const root = yield* screen.open();
		state.invoice = yield* Effect.promise(() => editing(root));
	});
}
export function creatingLine() {
	return invoices.trait("screen", "the invoice create form", function* ({ screen, state }) {
		const root = yield* screen.open();
		state.invoice = yield* Effect.promise(() => creating(root));
	});
}
export function invoiceSessions() {
	return invoices.trait("screen", "Alice and Bob own separate invoice clients", function* ({ screen, state }) {
		const root = yield* screen.open();
		state.sessions = switching(root);
	});
}
