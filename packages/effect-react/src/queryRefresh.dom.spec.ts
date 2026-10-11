import { Cause, Exit, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { act } from "react";
import { expect, it } from "vitest";
import { finishQuery, queryRequests, queryView, type Unavailable } from "#test/queryView.ts";
import { expectNoReactWarnings } from "#testing.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("same-identity refreshes retain data even when native results drop their previous success", async () => {
	const query = Atom.make<AsyncResult.AsyncResult<string, Unavailable>>(AsyncResult.success("Last success"));
	const view = await queryView(query);
	await act(async () => view.registry.set(query, AsyncResult.initial(true)));
	expect(view.snapshot()).toEqual({ data: "Last success", failure: null, pending: true, refreshing: true });
	expect(Option.isNone(AsyncResult.value(view.registry.get(query)))).toBe(true);
	const failure: Unavailable = { _tag: "Unavailable", message: "Offline" };
	await act(async () => view.registry.set(query, AsyncResult.failure(Cause.fail(failure))));
	expect(view.snapshot()).toEqual({ data: "Last success", failure, pending: false, refreshing: false });
});

it("live invalidation retains the rendered value and interrupts the superseded refresh", async () => {
	const requests = queryRequests();
	const view = await queryView(requests.queries("first"));
	expect(view.snapshot()).toEqual({ data: null, failure: null, pending: true, refreshing: false });
	await finishQuery(requests.gate(), Exit.succeed("Last success"));
	const superseded = requests.next();
	await view.invalidate(requests.invalidation);
	expect(view.snapshot()).toEqual({ data: "Last success", failure: null, pending: true, refreshing: true });
	const latest = requests.next();
	await view.invalidate(requests.invalidation);
	expect(requests.interrupted).toEqual(["first"]);
	expect(view.snapshot()).toEqual({ data: "Last success", failure: null, pending: true, refreshing: true });
	await finishQuery(latest, Exit.succeed("Fresh value"));
	await finishQuery(superseded, Exit.succeed("Stale value"));
	expect(view.snapshot()).toEqual({ data: "Fresh value", failure: null, pending: false, refreshing: false });
});

it("a failed manual refresh keeps the rendered success next to its typed failure", async () => {
	const requests = queryRequests();
	const view = await queryView(requests.queries("first"));
	await finishQuery(requests.gate(), Exit.succeed("Last success"));
	const gate = requests.next();
	await view.refresh();
	expect(view.snapshot()).toEqual({ data: "Last success", failure: null, pending: true, refreshing: true });
	const failure = { _tag: "Unavailable", message: "Offline" } as const;
	await finishQuery(gate, Exit.fail(failure));
	expect(view.snapshot()).toEqual({ data: "Last success", failure, pending: false, refreshing: false });
	const retry = requests.next();
	await view.refresh();
	expect(view.snapshot().data).toBe("Last success");
	expect(view.snapshot().refreshing).toBe(true);
	await finishQuery(retry, Exit.succeed("Recovered"));
	expect(view.snapshot()).toEqual({ data: "Recovered", failure: null, pending: false, refreshing: false });
});
