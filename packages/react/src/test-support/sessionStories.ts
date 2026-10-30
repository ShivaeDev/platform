import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { sessionCookie } from "#test/live-session/cookie.ts";
import { openHost } from "#test/live-session/openHost.ts";
import { shell as scopedShell } from "#test/live-session/shell.tsx";
import { hasPostgres, orderDatabase } from "#test/order-example/postgres.ts";
import { startHost } from "#test/order-example/startHost.ts";
import { screenKit } from "./screenKit.ts";
import { sessions, shell } from "./session.tsx";

interface State {
	active: ReturnType<typeof sessions>;
	private?: { readonly browser: boolean; readonly view: ReturnType<typeof scopedShell>; readonly host: Awaited<ReturnType<typeof openHost>> };
	view?: ReturnType<typeof shell>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No session screen");
	}
	return state.view;
}
function privateSession(state: State) {
	if (!state.private) {
		throw new Error("No private session screen");
	}
	return state.private;
}
const sessionKit = screenKit(
	"session screen",
	(): State => ({ active: sessions() }),
	(state, screen) => ({
		close: () => screen.act("unmount the session screen", () => current(state).close()),
		expire: () => {
			screen.tell("Alice's session expires");
			state.active.delete("alice-token");
		},
		refresh: () => screen.act("refresh the session's order", () => current(state).refresh()),
		renameScoped: (title: string) => screen.act(`rename the private note to ${title}`, () => privateSession(state).host.rename(title)),
		restore: () => {
			screen.tell("Alice's session is valid again");
			state.active.set("alice-token", { user: { id: "alice" } });
		},
		scoped: () => privateSession(state),
		session: () => current(state),
		show: (session: Parameters<ReturnType<typeof shell>["show"]>[0], id: number) =>
			screen.act(`show session ${session?.id ?? "signed out"}, order ${id}`, () => current(state).show(session, id)),
		showScoped: (session: Parameters<ReturnType<typeof scopedShell>["show"]>[0]) =>
			Effect.gen(function* () {
				const privateScreen = privateSession(state);
				if (privateScreen.browser) {
					yield* sessionCookie(session?.token);
				}
				yield* screen.act(`show private session ${session?.id ?? "signed out"}`, () => privateScreen.view.show(session));
			}),
		type: (value: string) => screen.act(`type name: ${value}`, () => current(state).edit(value)),
	}),
);
export const sessionScreens = storyKit(sessionKit);
export const orderSessionScreens = storyKit({ ...sessionKit, around: withIsolatedDatabase, layer: orderDatabase, runIf: hasPostgres });
export function orderSessions() {
	return orderSessionScreens.trait("screen", "order sessions over loopback HTTP", function* ({ screen, state }) {
		const database = yield* PostgresTestDatabase;
		const sql = yield* SqlClient.SqlClient;
		// Orders already exist when the signed-in session opens its editor.
		yield* sql`insert into orders ("ownerId", name, quantity) values ('alice', 'Printer paper', 300), ('bob', 'Desk lamps', 200)`;
		const server = yield* startHost(database.url, state.active);
		const root = yield* screen.open();
		state.view = shell(server.url, root);
	});
}

export function scopedSessions(browser = false) {
	return sessionScreens.trait(
		"screen",
		`session-owned private notes over a ${browser ? "cookie" : "bearer"} WebSocket`,
		function* ({ screen, state }) {
			const host = yield* Effect.acquireRelease(Effect.promise(openHost), (value) => Effect.promise(value.close));
			window.location.href = host.url;
			state.private = { browser, host, view: scopedShell(host.url, yield* screen.open(), browser) };
			if (browser) {
				yield* Effect.addFinalizer(() => sessionCookie());
			}
		},
	);
}
