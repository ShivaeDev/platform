import { useAtomValue } from "@effect/atom-react";
import { Clock, Effect, Option, Ref, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { act, createElement } from "react";
import { afterAll, expect, it, vi } from "vitest";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { useAction, useQuery } from "#result-state.ts";
import { eventually, expectNoReactWarnings, render } from "#testing.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
const originalError = console.error;
expectNoReactWarnings();
afterAll(() => {
	expect(console.error).toBe(originalError);
	expect(vi.isMockFunction(console.error)).toBe(false);
});
it("eventually rethrows its last assertion failure after the three-second deadline", async () => {
	const started = Effect.runSync(Clock.currentTimeMillis);
	let attempts = 0;
	let lastFailure: unknown;
	const thrown = await eventually(() => {
		attempts += 1;
		try {
			expect(attempts).toBe(0);
		} catch (error) {
			lastFailure = error;
			throw error;
		}
	}).catch((error: unknown) => error);
	expect(Effect.runSync(Clock.currentTimeMillis) - started).toBeGreaterThanOrEqual(3000);
	expect(attempts).toBeGreaterThan(1);
	expect(lastFailure).toBeInstanceOf(Error);
	expect(thrown).toBe(lastFailure);
});
const notes = collection("notes", Schema.Number);
const List = query("list", { reads: () => [notes.list], success: Schema.Array(Schema.String) });
const Add = command("add", { invalidates: () => [notes.list], payload: { title: Schema.String } });
const Notes = contract("notes", { commands: [Add], queries: [List] });
const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const stored = yield* Ref.make<readonly string[]>([]);
		return Notes.of({
			"notes.add": ({ title }) => Ref.update(stored, (all) => [...all, title]),
			"notes.list": () => Ref.get(stored).pipe(Effect.delay("20 millis")),
		});
	}),
);
class Client extends AtomRpc.Service<Client>()("test/Notes", {
	group: Notes,
	makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
	protocol: handlers,
}) {}
const api = bind(Notes, Client);
const add = Client.runtime.fn(api.add.run);
function NotesView() {
	const list = useQuery(api.list.query());
	const action = useAction(add);
	return createElement(
		"section",
		null,
		createElement("output", null, Option.getOrElse(list.data, () => []).join(", ")),
		createElement(
			"button",
			{
				disabled: list.pending || action.pending,
				onClick: () => action.dispatch({ title: "Morning walk" }),
				type: "button",
			},
			"Add",
		),
	);
}
it("renders a query and refetches it after a command through a test RPC layer", async () => {
	const view = await render(createElement(NotesView));
	try {
		await eventually(() => expect(view.container.querySelector("button")?.disabled).toBe(false));
		expect(view.container.querySelector("output")?.textContent).toBe("");
		await act(async () => view.container.querySelector("button")?.click());
		await eventually(() => {
			expect(view.container.querySelector("output")?.textContent).toBe("Morning walk");
			expect(view.container.querySelector("button")?.disabled).toBe(false);
		});
	} finally {
		await view.unmount();
	}
});
function Probe({ label, value }: { readonly label: string; readonly value: Atom.Atom<number> }) {
	return createElement("output", null, label, useAtomValue(value));
}
it("rerenders in the same registry, isolates mounts and disposes native resources on unmount", async () => {
	let acquired = 0;
	let released = 0;
	const value = Atom.keepAlive(
		Atom.make((get) => {
			acquired += 1;
			get.addFinalizer(() => {
				released += 1;
			});
			return acquired;
		}),
	);
	const first = await render(createElement(Probe, { label: "first:", value }));
	const second = await render(createElement(Probe, { label: "second:", value }));
	try {
		expect(first.registry).not.toBe(second.registry);
		expect(first.container.textContent).toBe("first:1");
		expect(second.container.textContent).toBe("second:2");
		await first.render(createElement(Probe, { label: "updated:", value }));
		expect(first.container.textContent).toBe("updated:1");
		expect(acquired).toBe(2);
		await first.unmount();
		expect(first.container.isConnected).toBe(false);
		expect(first.container.childNodes).toHaveLength(0);
		expect(released).toBe(1);
		await first.unmount();
		expect(released).toBe(1);
		expect(second.container.textContent).toBe("second:2");
	} finally {
		await first.unmount();
		await second.unmount();
	}
	expect(released).toBe(2);
});
it.fails("fails when the test logs to console.error and restores the spy afterwards", () => {
	vi.mocked(console.error)("Expected warning for the helper regression");
});
