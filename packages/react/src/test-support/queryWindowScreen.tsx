import { Effect, PubSub, Schema, Stream } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { queryCoalesceWindow } from "@shivaedev/contract/queryCoalesceWindow.ts";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { QueryWindowPage } from "./QueryWindowPage.tsx";
import { clickButton } from "./Screen.ts";
import { SessionRegistry } from "./SessionRegistry.tsx";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

const notes = collection("notes", Schema.Number);
const Get = query("get", {
	payload: { id: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: () => [notes.list],
	success: Schema.Number,
});
const Notes = contract("notes", { queries: [Get] });
const names = ["detail", "dashboard", "inherited"] as const;
type Name = (typeof names)[number];

function server() {
	const hints = Effect.runSync(PubSub.unbounded<LiveHint>());
	const reads = new Map<string, number>();
	let subscriptions = 0;
	const handlers = Notes.toLayer(
		Effect.succeed({
			"notes.$changes": () =>
				Stream.unwrap(
					Effect.sync(() => {
						subscriptions += 1;
						return Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.fromPubSub(hints));
					}),
				),
			"notes.get": ({ id }: typeof Get.payload.Type) =>
				Effect.sync(() => {
					reads.set(id, (reads.get(id) ?? 0) + 1);
					return 0;
				}),
		}),
	);
	class Client extends AtomRpc.Service<Client>()("query-window/Client", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers,
	}) {}
	const api = bind(Notes, Client);
	const queries: Record<Name, Atom.Atom<AsyncResult.AsyncResult<number, unknown>>> = {
		dashboard: api.get.query({ id: "dashboard" }),
		detail: api.get.query({ id: "detail" }),
		inherited: api.get.query({ id: "inherited" }),
	};
	return { api, queries, reads, subscriptions: () => subscriptions };
}

interface State {
	registry?: AtomRegistry.AtomRegistry;
	root?: Rendered;
	readonly server: ReturnType<typeof server>;
}

function root(state: State) {
	if (!state.root) {
		throw new Error("The query window page is not open");
	}
	return state.root.container;
}

function registry(state: State) {
	if (!state.registry) {
		throw new Error("The session never rendered");
	}
	return state.registry;
}

function loading(state: State) {
	return [...root(state).querySelectorAll("output")].some((output) => output.textContent === "loading");
}

function perQuery<A>(read: (name: Name) => A) {
	return { dashboard: read("dashboard"), detail: read("detail"), inherited: read("inherited") } satisfies Record<Name, A>;
}

function remember(state: State, found: AtomRegistry.AtomRegistry) {
	state.registry = found;
}

export const queryWindows = storyKit(
	screenKit(
		"query coalesce windows",
		(): State => ({ server: server() }),
		(state, screen) => ({
			reads: () => Effect.sync(() => perQuery((name) => state.server.reads.get(name) ?? 0)),
			slowDetail: () =>
				screen
					.act("slow the detail query's window to 300 millis", () => clickButton(root(state), "Slow detail"))
					.pipe(Effect.andThen(settleScreen(root(state), () => loading(state), screen.tell))),
			subscriptions: () => Effect.sync(() => state.server.subscriptions()),
			windows: () => Effect.sync(() => perQuery((name) => registry(state).get(queryCoalesceWindow(state.server.queries[name])))),
		}),
	),
);

export function queryWindowPageShown() {
	return queryWindows.trait(
		"screen",
		"a session with a 500 millis window showing detail at 100 millis, dashboard at 2 seconds and inherited without its own window",
		function* ({ screen, state }) {
			state.root = yield* screen.open(
				<SessionBoundary
					connect={() => state.server.api}
					identify={(id) => id}
					liveCoalesceWindow="500 millis"
					recheck={() => undefined}
					session="ada"
				>
					{() => (
						<>
							<SessionRegistry onRegistry={(found) => remember(state, found)} />
							<QueryWindowPage {...state.server.queries} />
						</>
					)}
				</SessionBoundary>,
			);
			yield* settleScreen(root(state), () => loading(state), screen.tell);
		},
	);
}
