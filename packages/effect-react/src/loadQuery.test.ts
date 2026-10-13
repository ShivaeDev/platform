import { Deferred, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expect, it, onTestFinished, vi } from "vitest";
import { loadQuery } from "#loadQuery.ts";

function owner() {
	const registry = AtomRegistry.make();
	onTestFinished(() => registry.dispose());
	return registry;
}

it("waits for a refresh instead of returning its retained success", async () => {
	const registry = owner();
	let gate = Effect.runSync(Deferred.make<string>());
	const atom = Atom.make(Effect.suspend(() => Deferred.await(gate)));
	const release = registry.mount(atom);
	onTestFinished(release);
	const first = loadQuery(registry, atom, { abortController: new AbortController() });
	Effect.runSync(Deferred.succeed(gate, "first"));
	expect(await first).toBe("first");
	gate = Effect.runSync(Deferred.make<string>());
	registry.refresh(atom);
	let settled = false;
	const second = loadQuery(registry, atom, { abortController: new AbortController() }).then((value) => {
		settled = true;
		return value;
	});
	await new Promise<void>((resolve) => setTimeout(resolve, 10));
	expect(settled).toBe(false);
	Effect.runSync(Deferred.succeed(gate, "second"));
	expect(await second).toBe("second");
});

it("aborting a loader releases its subscription without interrupting another reader", async () => {
	const registry = owner();
	const gate = Effect.runSync(Deferred.make<string>());
	const atom = Atom.make(Deferred.await(gate)).pipe(Atom.setIdleTTL(0));
	const abortController = new AbortController();
	const canceled = loadQuery(registry, atom, { abortController });
	const rejection = expect(canceled).rejects.toMatchObject({ name: "AbortError" });
	const remaining = loadQuery(registry, atom, { abortController: new AbortController() });
	abortController.abort();
	await rejection;
	Effect.runSync(Deferred.succeed(gate, "shared"));
	expect(await remaining).toBe("shared");
});

it("defects stay failures instead of becoming typed RPC errors", async () => {
	const defect = new Error("broken client");
	const atom = Atom.make(Effect.die(defect));
	await expect(loadQuery(owner(), atom, { abortController: new AbortController() })).rejects.toThrow("broken client");
});

it("an aborted loader releases the last reader so native atom work can be interrupted", async () => {
	let interrupted = false;
	const atom = Atom.make(
		Effect.never.pipe(
			Effect.onInterrupt(() =>
				Effect.sync(() => {
					interrupted = true;
				}),
			),
		),
	).pipe(Atom.setIdleTTL(0));
	const abortController = new AbortController();
	const loading = loadQuery(owner(), atom, { abortController });
	const rejection = expect(loading).rejects.toMatchObject({ name: "AbortError" });
	abortController.abort();
	await rejection;
	await vi.waitFor(() => expect(interrupted).toBe(true));
});
