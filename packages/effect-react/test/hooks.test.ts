// @vitest-environment happy-dom
import { RegistryContext } from "@effect/atom-react";
import { Deferred, Effect, Exit, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { useAction, useQuery } from "../src/index.ts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const mount = async (Component: () => React.ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const registry = AtomRegistry.make();
	cleanups.push(async () => {
		await act(async () => root.unmount());
		registry.dispose();
		container.remove();
	});
	await act(async () => {
		root.render(createElement(RegistryContext.Provider, { value: registry }, createElement(Component)));
	});
	return container;
};

const finish = async <A, E>(gate: Deferred.Deferred<A, E>, result: Exit.Exit<A, E>) => {
	await act(async () => {
		Effect.runSync(Deferred.done(gate, result));
	});
};

test("query renders retained data while refreshing and after a typed failure", async () => {
	let gate = Effect.runSync(Deferred.make<number, string>());
	const query = Atom.make(Effect.suspend(() => Deferred.await(gate)));
	const view = await mount(() => {
		const state = useQuery(query);
		return createElement(
			"button",
			{ type: "button", onClick: state.refresh },
			JSON.stringify({
				data: Option.getOrNull(state.data),
				pending: state.pending,
				refreshing: state.refreshing,
				failed: Option.isSome(state.cause),
			}),
		);
	});
	const snapshot = () => JSON.parse(view.textContent ?? "");
	expect(snapshot()).toEqual({
		data: null,
		pending: true,
		refreshing: false,
		failed: false,
	});
	await finish(gate, Exit.succeed(7));
	expect(snapshot()).toEqual({
		data: 7,
		pending: false,
		refreshing: false,
		failed: false,
	});
	gate = Effect.runSync(Deferred.make<number, string>());
	await act(async () => view.querySelector("button")?.click());
	expect(snapshot()).toEqual({
		data: 7,
		pending: true,
		refreshing: true,
		failed: false,
	});
	await finish(gate, Exit.fail("unavailable"));
	expect(snapshot()).toEqual({
		data: 7,
		pending: false,
		refreshing: false,
		failed: true,
	});
});

test("action renders ordinary success values and typed failures", async () => {
	let gate = Effect.runSync(Deferred.make<number, string>());
	const action = Atom.fn<number>()((input) => Effect.map(Deferred.await(gate), (value) => input + value));
	const view = await mount(() => {
		const state = useAction(action);
		return createElement(
			"button",
			{
				type: "button",
				onClick: () => {
					state.dispatch(5);
				},
			},
			JSON.stringify({
				pending: state.pending,
				data: Option.getOrNull(state.data),
				failed: Option.isSome(state.cause),
			}),
		);
	});
	await act(async () => view.querySelector("button")?.click());
	expect(JSON.parse(view.textContent ?? "")).toEqual({
		pending: true,
		data: null,
		failed: false,
	});
	await finish(gate, Exit.succeed(2));
	expect(JSON.parse(view.textContent ?? "")).toEqual({
		pending: false,
		data: 7,
		failed: false,
	});
	gate = Effect.runSync(Deferred.make<number, string>());
	await act(async () => view.querySelector("button")?.click());
	await finish(gate, Exit.fail("denied"));
	expect(JSON.parse(view.textContent ?? "")).toEqual({
		pending: false,
		data: 7,
		failed: true,
	});
});

test("changing query identity does not retain data from the previous query", async () => {
	const first = Atom.make(Effect.succeed("account A"));
	const next = Atom.make(Effect.never);
	const registry = AtomRegistry.make();
	const container = document.createElement("div");
	const root = createRoot(container);
	cleanups.push(async () => {
		await act(async () => root.unmount());
		registry.dispose();
	});
	const Component = ({ atom }: { readonly atom: typeof first }) => {
		const state = useQuery(atom);
		return createElement(
			"span",
			null,
			Option.getOrElse(state.data, () => "loading"),
		);
	};
	const render = async (atom: typeof first) => {
		await act(async () => root.render(createElement(RegistryContext.Provider, { value: registry }, createElement(Component, { atom }))));
	};
	await render(first);
	expect(container.textContent).toBe("account A");
	await render(next);
	expect(container.textContent).toBe("loading");
});

test("consumers of the same query share the native execution", async () => {
	let calls = 0;
	const query = Atom.make(Effect.sync(() => ++calls));
	const Child = () => createElement("span", null, Option.getOrNull(useQuery(query).data));
	const view = await mount(() => createElement("div", null, createElement(Child), createElement(Child)));
	expect(view.textContent).toBe("11");
	expect(calls).toBe(1);
});

test("overlapping dispatches expose the latest native result", async () => {
	const first = Effect.runSync(Deferred.make<number>());
	const second = Effect.runSync(Deferred.make<number>());
	let interrupted = false;
	const action = Atom.fn<number>()((input) =>
		Deferred.await(input === 0 ? first : second).pipe(
			Effect.onInterrupt(() =>
				Effect.sync(() => {
					interrupted = true;
				}),
			),
		),
	);
	let input = 0;
	const view = await mount(() => {
		const state = useAction(action);
		return createElement(
			"button",
			{ type: "button", onClick: () => state.dispatch(input++) },
			Option.getOrElse(state.data, () => -1),
		);
	});
	await act(async () => view.querySelector("button")?.click());
	await act(async () => view.querySelector("button")?.click());
	expect(interrupted).toBe(true);
	await finish(second, Exit.succeed(2));
	expect(view.textContent).toBe("2");
	await finish(first, Exit.succeed(1));
	expect(view.textContent).toBe("2");
});
