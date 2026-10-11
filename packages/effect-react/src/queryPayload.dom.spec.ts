import { Exit } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { expect, it, onTestFinished } from "vitest";
import { finishQuery, queryRequests, queryView } from "#test/queryView.ts";
import { eventually, expectNoReactWarnings } from "#test/react.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("an opted-in payload change retains the last success through failure and a superseding request", async () => {
	const requests = queryRequests();
	const view = await queryView(requests.queries("first"), { keepPreviousData: true });
	await finishQuery(requests.gate(), Exit.succeed("First payload"));
	const failed = requests.next();
	await view.render(requests.queries("second"));
	expect(view.snapshot()).toEqual({ data: "First payload", failure: null, pending: true, refreshing: true });
	const failure = { _tag: "Unavailable", message: "New payload unavailable" } as const;
	await finishQuery(failed, Exit.fail(failure));
	expect(view.snapshot()).toEqual({ data: "First payload", failure, pending: false, refreshing: false });
	const superseded = requests.next();
	await view.refresh();
	const latest = requests.next();
	await view.render(requests.queries("third"));
	expect(view.snapshot()).toEqual({ data: "First payload", failure: null, pending: true, refreshing: true });
	await eventually(() => expect(requests.interrupted).toEqual(["second"]));
	await finishQuery(latest, Exit.succeed("Third payload"));
	await finishQuery(superseded, Exit.succeed("Stale payload"));
	expect(view.snapshot()).toEqual({ data: "Third payload", failure: null, pending: false, refreshing: false });
});

it.each([undefined, false])("payload changes reset by default or with keepPreviousData %s", async (keepPreviousData) => {
	const requests = queryRequests();
	const view = await queryView(requests.queries("first"), keepPreviousData === undefined ? {} : { keepPreviousData });
	await finishQuery(requests.gate(), Exit.succeed("First payload"));
	const gate = requests.next();
	await view.render(requests.queries("second"));
	expect(view.snapshot()).toEqual({ data: null, failure: null, pending: true, refreshing: false });
	await finishQuery(gate, Exit.fail({ _tag: "Unavailable", message: "Offline" }));
	expect(view.snapshot().data).toBeNull();
});

it("an opted-in query clears retained data when its registry changes", async () => {
	const requests = queryRequests();
	const view = await queryView(requests.queries("first"), { keepPreviousData: true });
	await finishQuery(requests.gate(), Exit.succeed("Previous owner"));
	requests.next();
	const registry = AtomRegistry.make();
	onTestFinished(() => registry.dispose());
	await view.render(requests.queries("first"), { keepPreviousData: true }, registry);
	expect(view.snapshot()).toEqual({ data: null, failure: null, pending: true, refreshing: false });
});

it("turning off retention drops an inherited value but keeps the current query's next success", async () => {
	const requests = queryRequests();
	const view = await queryView(requests.queries("first"), { keepPreviousData: true });
	await finishQuery(requests.gate(), Exit.succeed("First payload"));
	const gate = requests.next();
	const next = requests.queries("second");
	await view.render(next);
	expect(view.snapshot().data).toBe("First payload");
	await view.render(next, { keepPreviousData: false });
	expect(view.snapshot()).toEqual({ data: null, failure: null, pending: true, refreshing: false });
	await finishQuery(gate, Exit.succeed("Second payload"));
	requests.next();
	await view.refresh();
	expect(view.snapshot()).toEqual({ data: "Second payload", failure: null, pending: true, refreshing: true });
});
