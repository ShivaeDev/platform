import { Effect, PubSub, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { vi } from "vitest";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { QueryWindowPage } from "./QueryWindowPage.tsx";
import { clickButton, Screen } from "./Screen.ts";

const notes = collection("notes", Schema.Number);
const Get = query("get", {
	payload: { id: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: () => [notes.list],
	success: Schema.Number,
});
const Notes = contract("notes", { queries: [Get] });

export const queryWindowScreen = storyKit({
	clock: "live",
	*create() {
		const hints = yield* PubSub.unbounded<LiveHint>();
		const screen = new Screen(() => undefined);
		const reads = new Map<string, number>();
		let value = 0;
		let connections = 0;
		const subscriptions: unknown[] = [];
		const handlers = Notes.toLayer(
			Effect.succeed({
				"notes.$changes": (request) =>
					Stream.unwrap(
						Effect.sync(() => {
							connections += 1;
							subscriptions.push(request);
							return Stream.fromPubSub(hints);
						}),
					),
				"notes.get": ({ id }: typeof Get.payload.Type) =>
					Effect.sync(() => {
						reads.set(id, (reads.get(id) ?? 0) + 1);
						return value;
					}),
			}),
		);
		class Client extends AtomRpc.Service<Client>()("query-window/Client", {
			group: Notes,
			makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
			protocol: handlers,
		}) {}
		const api = bind(Notes, Client);
		const detail = api.get.query({ id: "detail" });
		const dashboard = api.get.query({ id: "dashboard" });
		const inherited = api.get.query({ id: "inherited" });
		return {
			api,
			connections: () => connections,
			hints,
			queries: { dashboard, detail, inherited },
			reads,
			screen,
			setValue: (next: number) => {
				value = next;
			},
			subscriptions,
		};
	},
	inspect: (engine) => ({ connections: engine.connections(), reads: Object.fromEntries(engine.reads), ...engine.screen.inspect() }),
	name: "per-query live coalescing",
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.screen.tell = story.tell;
		function container() {
			const root = engine.screen.roots[0];
			if (root === undefined) {
				throw new Error("The query window page is not open");
			}
			return root.container;
		}
		return {
			advance: (millis: number) => engine.screen.act(`advance ${millis} ms`, () => vi.advanceTimersByTimeAsync(millis)),
			changeWindow: () => engine.screen.act("slow the detail query's window", () => clickButton(container(), "Slow detail")),
			connections: engine.connections,
			fakeTime: () => {
				vi.useFakeTimers();
			},
			observe: (check: () => void) => engine.screen.observe("the query values settle", check),
			open: () =>
				engine.screen.open(
					<SessionBoundary connect={() => engine.api} identify={(id) => id} liveCoalesceWindow="500 millis" recheck={() => undefined} session="ada">
						{() => <QueryWindowPage {...engine.queries} />}
					</SessionBoundary>,
				),
			publish: (next: number) =>
				engine.screen.act("publish a changed value", () => {
					engine.setValue(next);
					return Effect.runPromise(PubSub.publish(engine.hints, { _tag: "Changed", keys: [notes.list] }));
				}),
			reads: () => ({
				dashboard: engine.reads.get("dashboard") ?? 0,
				detail: engine.reads.get("detail") ?? 0,
				inherited: engine.reads.get("inherited") ?? 0,
			}),
			resync: () => engine.screen.act("reconcile the live connection", () => Effect.runPromise(PubSub.publish(engine.hints, { _tag: "Resync" }))),
			subscriptions: () => [...engine.subscriptions],
			values: () => [...container().querySelectorAll("output")].map((output) => output.textContent),
		};
	},
});
