import { useAtomValue } from "@effect/atom-react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Cause, Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act, useMemo } from "react";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { todayFixture } from "#test/todayFixture.ts";
import { activeRead } from "./activeRead.ts";
import { boardRouter } from "./boardRouter.ts";
import { routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";

expectNoReactWarnings();
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function Health({ api }: { readonly api: ShellApi }) {
	const atom = useMemo(() => activeRead(api, "today", "/"), [api]);
	const reading = useAtomValue(atom);
	const settled = reading.pending ? "pending" : "settled";
	const state = reading.failed ? "failed" : settled;
	return <output aria-label="Page health">{state}</output>;
}

function controlled<A, E>(source: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
	let state: "failed" | "pending" | "ready" = "failed";
	const atom = Atom.make((get) => {
		if (state === "failed") {
			return AsyncResult.failure<A>(Cause.die("Query unavailable"));
		}
		return state === "pending" ? AsyncResult.initial<A>() : get(source);
	});
	return {
		atom,
		change: (next: typeof state) => {
			state = next;
		},
	};
}

for (const kind of ["inbox", "goals", "fleetItems"] as const) {
	screenStory.it(`retries Today's failed ${kind} query and tracks its health without reading document('/')`, [], function* ({ renderBoard, click }) {
		let actions: { readonly recover: () => void; readonly pending: () => void; readonly settle: () => void } | undefined;
		const reads: string[] = [];
		const view = yield* Effect.promise(() =>
			renderBoard(
				todayFixture(),
				(api, registry) => {
					const inbox = controlled(api.inbox.query(undefined, routeQueryOptions));
					const goals = controlled(api.goals.query(undefined, routeQueryOptions));
					const fleet = controlled(api.fleetItems.query(undefined, routeQueryOptions));
					if (kind !== "fleetItems") {
						fleet.change("ready");
					}
					if (kind !== "goals") {
						goals.change("ready");
					}
					if (kind !== "inbox") {
						inbox.change("ready");
					}
					vi.spyOn(api.inbox, "query").mockReturnValue(inbox.atom);
					vi.spyOn(api.goals, "query").mockReturnValue(goals.atom);
					vi.spyOn(api.fleetItems, "query").mockReturnValue(fleet.atom);
					const queries = { fleetItems: fleet, goals, inbox };
					const query = queries[kind];
					actions = {
						pending: () => {
							query.change("pending");
							registry.refresh<unknown>(query.atom);
						},
						recover: () => query.change("ready"),
						settle: () => {
							query.change("ready");
							registry.refresh<unknown>(query.atom);
						},
					};
					const documentQuery = api.document.query;
					vi.spyOn(api.document, "query").mockImplementation((input) => {
						reads.push(input.url);
						return documentQuery(input);
					});
					const router = boardRouter({ api, registry });
					router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/"] }) });
					return (
						<>
							<RouterProvider router={router} />
							<Health api={api} />
						</>
					);
				},
				{ home: "home.md" },
			),
		);

		if (!actions) {
			throw new Error("Missing query controls");
		}
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector('[aria-label="Page health"]')?.textContent).toBe("failed")));
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc")?.getAttribute("data-route")).toBe("/")));
		expect(view.container.textContent).toContain(kind === "inbox" ? "could not be opened" : "unavailable");
		actions.recover();
		click(view.container.querySelector<HTMLAnchorElement>("#home-open"));
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector('[aria-label="Page health"]')?.textContent).toBe("settled")));
		expect(view.container.querySelector("#doc h1")?.textContent).toBe("Today");
		expect(view.container.querySelector("#doc")?.getAttribute("data-status")).toBe("200");
		expect(view.container.querySelectorAll("[data-attention-id]")).toHaveLength(7);
		expect(view.container.querySelectorAll("[data-goal-id]")).toHaveLength(4);
		expect(reads).not.toContain("/");
		act(actions.pending);
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector('[aria-label="Page health"]')?.textContent).toBe("pending")));
		act(actions.settle);
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector('[aria-label="Page health"]')?.textContent).toBe("settled")));
	});
}
