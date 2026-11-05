import { Effect, Fiber } from "effect";
import { act } from "react";
import { expectNoReactWarnings, render } from "#client/adapters/react.ts";
import { domFetch } from "#server/domFetch.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";
import { domHost } from "#test/domHost.ts";
import { FetchPage } from "./FetchPage.tsx";

expectNoReactWarnings();

export const fetchScreen = storyKit({
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const requests = new Map(
			["first", "second"].map((name) => [
				name,
				{ arrived: Promise.withResolvers<void>(), loaded: Promise.withResolvers<void>(), response: Promise.withResolvers<void>() },
			]),
		);
		const url = yield* domHost(async (request, response) => {
			const name = (request.url ?? "").slice(1);
			const held = requests.get(name);
			if (held === undefined) {
				throw new Error(`Unknown request ${name}`);
			}
			held.arrived.resolve();
			await held.response.promise;
			response.end(name);
		});
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				for (const held of requests.values()) {
					held.response.resolve();
				}
			}),
		);
		const fetch = domFetch(url);
		const view = yield* Effect.acquireRelease(
			Effect.promise(() =>
				render(<FetchPage controller={new AbortController()} fetch={fetch} loaded={(name) => requests.get(name)?.loaded.resolve()} />),
			),
			(mounted) => Effect.promise(mounted.unmount),
		);
		return { fetch, requests, view };
	},
	inspect: ({ view }) => ({ text: view.container.textContent }),
	name: "document fetch screen",
	stages: [],
	verbs: ({ fetch, requests, view }, story) => {
		const driver = screenDriver({ act, pending: fetch.pending, root: view.container, tell: story.tell });
		function request(name: string) {
			const held = requests.get(name);
			if (held === undefined) {
				throw new Error(`Unknown request ${name}`);
			}
			return held;
		}
		return {
			cancel: () => driver.click({ name: "Cancel first", role: "button" }),
			load: (name: string) =>
				driver.click({ name: `Load ${name}`, role: "button" }).pipe(Effect.andThen(Effect.promise(() => request(name).arrived.promise))),
			release: (name: string) =>
				Effect.promise(async () => {
					request(name).response.resolve();
					await request(name).loaded.promise;
				}),
			settle: driver.settle,
			startsSettling: Effect.fnUntraced(function* () {
				const fiber = yield* driver.settle().pipe(Effect.forkScoped({ startImmediately: true }));
				return { finish: Fiber.join(fiber), state: () => Effect.sync(() => (fiber.pollUnsafe() === undefined ? "waiting" : "settled")) };
			}),
			text: () => Effect.sync(() => driver.text("output")),
		};
	},
});
