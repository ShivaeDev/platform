import { Deferred, Effect, Result } from "effect";
import { expect } from "vitest";
import { eventually } from "#testing.ts";
import { type LiveEngine, view } from "./liveEngine.ts";
import { makeClient } from "./makeClient.ts";
import { call } from "./view.tsx";

export function liveVerbs(engine: LiveEngine, tell: (line: string) => void) {
	const { server, gate, baseline } = engine;
	function storedOrderIs(name: string, quantity: number) {
		tell(`independent storage contains ${name} / ${quantity}`);
		return Effect.promise(async () => expect(await server.read()).toEqual([{ name, quantity }]));
	}
	return {
		beginRejectedSave: () =>
			Effect.sync(() => {
				tell("Alice submits a write that will roll back");
				const client = makeClient(server.url, "alice-session");
				engine.saving.pending = call(client, client.api.save.run({ id: 1, name: "Rolled back", quantity: 999 }).pipe(Effect.result));
			}),
		commitHasEntered: () => {
			tell("the write waits inside its transaction");
			return Deferred.await(gate.entered);
		},
		editName: (editor: string, name: string) => {
			tell(`${editor} enters the name ${name}`);
			return Effect.promise(() => view(engine, editor).edit("name", name));
		},
		editorShows: (editor: string, name: string, quantity: number, draftName = name, status = "Saved") => {
			tell(`${editor} sees ${name} / ${quantity}, draft ${draftName}, ${status}`);
			return Effect.promise(() =>
				eventually(() => {
					const screen = view(engine, editor);
					expect(screen.container.querySelector("output")?.textContent).toBe(`${name} / ${quantity}`);
					expect(screen.input("name").value).toBe(draftName);
					expect(screen.input("quantity").value).toBe(String(quantity));
					expect(screen.container.querySelector('[role="status"]')?.textContent).toBe(status);
					expect(screen.registry.get(screen.query).waiting).toBe(false);
				}),
			);
		},
		editQuantity: (editor: string, quantity: string) => {
			tell(`${editor} enters the quantity ${quantity}`);
			return Effect.promise(() => view(engine, editor).edit("quantity", quantity));
		},
		forbiddenSavesAreRejected: () =>
			Effect.promise(async () => {
				tell("anonymous and cross-owner saves are rejected without publication");
				for (const [token, tag] of [
					[undefined, "Unauthorized"],
					["bob-session", "Missing"],
				]) {
					const client = makeClient(server.url, token);
					const result = await call(client, client.api.save.run({ id: 1, name: "Forbidden", quantity: 1 }).pipe(Effect.result));
					expect(Result.isFailure(result) && result.failure._tag).toBe(tag);
				}
				expect(server.publications).toEqual(["orders:1", "orders:1"]);
			}),
		nothingWasPublished: () =>
			Effect.sync(() => {
				tell("no uncommitted change was published or delivered");
				expect(server.publications).toEqual([]);
				expect(server.delivered).toHaveLength(baseline.deliveries);
			}),
		orderWasDelivered: (name: string, quantity: number) =>
			Effect.sync(() => {
				tell("both live subscribers receive the committed order");
				expect(server.publications).toEqual(["orders:1"]);
				expect(server.delivered.slice(baseline.deliveries)).toEqual([[{ name, quantity }], [{ name, quantity }]]);
			}),
		releaseCommit: () => {
			tell("the transaction may finish");
			return Deferred.succeed(gate.released, undefined);
		},
		revertOrder: (editor: string, name: string) =>
			Effect.promise(async () => {
				tell(`${editor} reverts to ${name}`);
				const screen = view(engine, editor);
				await screen.click("Revert");
				expect(screen.input("name").value).toBe(name);
			}),
		saveWasRejected: () =>
			Effect.promise(async () => {
				tell("the caller receives the typed rejection without a query refresh");
				if (engine.saving.pending === undefined) {
					throw new Error("No save is pending");
				}
				expect(await engine.saving.pending).toMatchObject({ _tag: "Failure", failure: { _tag: "Rejected" } });
				expect(server.reads).toHaveLength(baseline.reads);
			}),
		storedOrderIs,
		submitOrder: (editor: string) => {
			tell(`${editor} submits the order`);
			return Effect.promise(() => view(engine, editor).click("Save"));
		},
	};
}
