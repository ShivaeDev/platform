import { Deferred, type Duration, Effect, Fiber, Queue, Stream } from "effect";
import { act, createElement } from "react";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { queryCoalesceWindow } from "@shivaedev/contract/queryCoalesceWindow.ts";
import { expectNoReactWarnings, render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { ActivityPageView, activityPageClient } from "./activityPageView.ts";
import { readPageHost } from "./readPageHost.ts";

expectNoReactWarnings();

export const activityPage = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const host = yield* readPageHost;
		const client = activityPageClient(host.url);
		const raw = yield* client.client;
		const writer = yield* activityPageClient(host.url).client;
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement(ActivityPageView, { client }))),
			(rendered) => Effect.promise(rendered.unmount),
		);
		return { client, host, raw, view, writer };
	},
	inspect: ({ client, view }) => ({ activity: Effect.runSync(clientActivity(client).current), text: view.container.textContent }),
	name: "client activity screen",
	stages: [],
	verbs: ({ client, raw, host, view, writer }, story) => {
		const pending = clientActivity(client);
		const driver = screenDriver({ act, pending, root: view.container, tell: story.tell });
		return {
			...driver,
			activity: () => pending.current,
			closePage: () => Effect.promise(view.unmount),
			coalesceFor: (duration: Duration.Input) => Effect.sync(() => view.registry.set(queryCoalesceWindow(client.api.get.query({ id: 1 })), duration)),
			holdRefresh: () => Effect.sync(host.holdRead),
			readMissing: () => raw["page.get"]({ id: 99 }).pipe(Effect.match({ onFailure: (error) => error._tag, onSuccess: (title) => title })),
			refreshStarted: () => Effect.promise(() => act(() => Effect.runPromise(Queue.take(host.reading)))),
			releaseRefresh: () => Effect.sync(host.releaseRead),
			shown: () => driver.settle().pipe(Effect.andThen(Effect.sync(() => driver.text("output")))),
			startHintWait: () =>
				Effect.gen(function* () {
					const fiber = yield* driver.nextLiveHint().pipe(Effect.forkScoped({ startImmediately: true }));
					return { finish: Fiber.join(fiber), state: Effect.sync(() => (fiber.pollUnsafe() === undefined ? "waiting" : "received")) };
				}),
			startRead: () =>
				Effect.gen(function* () {
					const fiber = yield* raw["page.get"]({ id: 1 }).pipe(Effect.forkScoped({ startImmediately: true }));
					return { cancel: Fiber.interrupt(fiber), result: Fiber.join(fiber) };
				}),
			startSettling: () =>
				Effect.gen(function* () {
					const observing = yield* Deferred.make<void>();
					const observed = Object.assign(pending.pipe(Stream.tap(() => Deferred.succeed(observing, undefined))), { current: pending.current });
					const settling = screenDriver({ act, pending: observed, root: view.container, tell: story.tell });
					const fiber = yield* settling.settle().pipe(Effect.forkScoped({ startImmediately: true }));
					yield* Effect.raceFirst(Deferred.await(observing), Fiber.join(fiber));
					return { finish: Fiber.join(fiber), state: Effect.sync(() => (fiber.pollUnsafe() === undefined ? "waiting" : "settled")) };
				}),
			writeElsewhere: (title: string) => writer["page.write"]({ id: 1, title }),
		};
	},
});
