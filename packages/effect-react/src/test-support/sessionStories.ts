import { Effect } from "effect";
import { startOrderServer } from "#test/order-example/http-test.ts";
import { screenKit } from "./screenKit.ts";
import { sessions, shell } from "./session.tsx";

interface State {
	active: ReturnType<typeof sessions>;
	view?: ReturnType<typeof shell>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No session screen");
	}
	return state.view;
}
export const sessionScreens = screenKit(
	"session screen",
	(): State => ({ active: sessions() }),
	(state, screen) => ({
		close: () => screen.act("unmount the session screen", () => current(state).close()),
		expire: () => {
			screen.tell("Alice's session expires");
			state.active.delete("alice-token");
		},
		refresh: () => screen.act("refresh the session's order", () => current(state).refresh()),
		restore: () => {
			screen.tell("Alice's session is valid again");
			state.active.set("alice-token", { expiresAt: Number.POSITIVE_INFINITY, userId: "alice" });
		},
		session: () => current(state),
		show: (session: Parameters<ReturnType<typeof shell>["show"]>[0], id: number) =>
			screen.act(`show session ${session?.id ?? "signed out"}, order ${id}`, () => current(state).show(session, id)),
		type: (value: string) => screen.act(`type name: ${value}`, () => current(state).edit(value)),
	}),
);
export function orderSessions() {
	return sessionScreens.trait("screen", "order sessions over loopback HTTP", function* ({ screen, state }) {
		const server = yield* Effect.acquireRelease(
			Effect.promise(() => startOrderServer({ sessions: state.active })),
			(host) => Effect.promise(host.close),
		);
		const root = yield* screen.open();
		state.view = shell(server.url, root);
	});
}
