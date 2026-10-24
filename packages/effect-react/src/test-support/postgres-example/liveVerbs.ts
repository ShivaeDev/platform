import { Deferred, Effect } from "effect";
import { eventually } from "#client/testing.ts";
import { type LiveEngine, rejectedSave, view } from "./liveEngine.ts";
import { makeClient } from "./makeClient.ts";
import { call } from "./view.tsx";

export function liveVerbs(engine: LiveEngine, tell: (line: string) => void) {
	const { server, gate, baseline } = engine;
	return {
		beginRejectedSave: () =>
			Effect.sync(() => {
				tell("Alice submits a write that will roll back");
				engine.saving.pending = rejectedSave(server.url);
			}),
		commitHasEntered: () => {
			tell("the write waits inside its transaction");
			return Deferred.await(gate.entered);
		},
		deliveriesSinceBaseline: () => server.delivered.slice(baseline.deliveries),
		editName: (editor: string, name: string) => {
			tell(`${editor} enters the name ${name}`);
			return Effect.promise(() => view(engine, editor).edit("name", name));
		},
		editor: (name: string) => {
			const screen = view(engine, name);
			return {
				connection: screen.registry.get(screen.status).connection,
				name: screen.input("name").value,
				quantity: screen.input("quantity").value,
				serverOrder: screen.container.querySelector("output")?.textContent,
				status: screen.container.querySelector('[role="status"]')?.textContent,
				waiting: screen.registry.get(screen.query).waiting,
			};
		},
		editQuantity: (editor: string, quantity: string) => {
			tell(`${editor} enters the quantity ${quantity}`);
			return Effect.promise(() => view(engine, editor).edit("quantity", quantity));
		},
		forbiddenSave: (token?: string) =>
			Effect.promise(async () => {
				tell(`${token ?? "an anonymous caller"} tries to overwrite the order`);
				const client = makeClient(server.url, token);
				return await call(client, client.api.save.run({ id: 1, name: "Forbidden", quantity: 1 }).pipe(Effect.result));
			}),
		observe: (line: string, check: () => void) => {
			tell(line);
			return Effect.promise(() => eventually(check));
		},
		publications: () => [...server.publications],
		reads: () => [...server.reads],
		readsSinceBaseline: () => server.reads.slice(baseline.reads),
		recordBaseline: () =>
			Effect.sync(() => {
				baseline.reads = server.reads.length;
				baseline.deliveries = server.delivered.length;
			}),
		releaseCommit: () => {
			tell("the transaction may finish");
			return Deferred.succeed(gate.released, undefined);
		},
		revertOrder: (editor: string) => {
			tell(`${editor} reverts the draft`);
			return Effect.promise(() => view(engine, editor).click("Revert"));
		},
		saveResult: () =>
			Effect.promise(async () => {
				tell("the caller receives the save result");
				if (engine.saving.pending === undefined) {
					throw new Error("No save is pending");
				}
				return await engine.saving.pending;
			}),
		storedOrder: () => Effect.promise(server.read),
		submitOrder: (editor: string) => {
			tell(`${editor} submits the order`);
			return Effect.promise(() => view(engine, editor).click("Save"));
		},
	};
}
