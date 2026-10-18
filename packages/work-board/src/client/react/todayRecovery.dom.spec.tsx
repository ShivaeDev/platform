import { useAtomValue } from "@effect/atom-react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Cause } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act, useMemo } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { renderBoard } from "#test/react.tsx";
import { todayFixture } from "#test/todayFixture.ts";
import { activeRead } from "./activeRead.ts";
import { boardRouter } from "./boardRouter.ts";
import { routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => browserStorage());
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

it.each(["inbox", "goals", "fleetItems"] as const)(
	"retries Today's failed %s query and tracks its health without reading document('/')",
	async (kind) => {
		let actions: { readonly recover: () => void; readonly pending: () => void; readonly settle: () => void } | undefined;
		const reads: string[] = [];
		const view = await renderBoard(
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
		);
		try {
			if (!actions) {
				throw new Error("Missing query controls");
			}
			await eventually(() => expect(view.container.querySelector('[aria-label="Page health"]')?.textContent).toBe("failed"));
			await eventually(() => expect(view.container.querySelector("#doc")?.getAttribute("data-route")).toBe("/"));
			expect(view.container.textContent).toContain(kind === "inbox" ? "could not be opened" : "unavailable");
			actions.recover();
			await act(async () => view.container.querySelector<HTMLAnchorElement>("#home-open")?.click());
			await eventually(() => expect(view.container.querySelector('[aria-label="Page health"]')?.textContent).toBe("settled"));
			expect(view.container.querySelector("#doc h1")?.textContent).toBe("Today");
			expect(view.container.querySelector("#doc")?.getAttribute("data-status")).toBe("200");
			expect(view.container.querySelectorAll("[data-attention-id]")).toHaveLength(7);
			expect(view.container.querySelectorAll("[data-goal-id]")).toHaveLength(4);
			expect(reads).not.toContain("/");
			act(actions.pending);
			await eventually(() => expect(view.container.querySelector('[aria-label="Page health"]')?.textContent).toBe("pending"));
			act(actions.settle);
			await eventually(() => expect(view.container.querySelector('[aria-label="Page health"]')?.textContent).toBe("settled"));
		} finally {
			await view.unmount();
		}
	},
);
