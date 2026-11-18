import { Deferred, Effect, Queue } from "effect";
import { act, createElement } from "react";
import { activityScreenSignal, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { screenSync } from "@shivaedev/contract/screenSync.ts";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { mountApp } from "#server/mountApp.ts";
import { screenDriver } from "#server/screenDriver.ts";
import { storyKit } from "#server/storyKit.ts";
import { until } from "#server/until.ts";
import { reflectedPageHost } from "#test/reflectedPageHost.ts";
import { ReflectedPageView, reflectedPageClient } from "#test/reflectedPageView.ts";

expectNoReactWarnings();

export const reflectedPage = storyKit({
	clock: "test",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const host = yield* reflectedPageHost;
		const view = yield* mountApp({
			create: Effect.sync(() => reflectedPageClient(host.url)),
			render: (client) => createElement(ReflectedPageView, { client }),
		});
		const writer = yield* reflectedPageClient(host.url).client;
		const activity = activityScreenSignal(clientActivity(view.app));
		yield* screenDriver({ act, activity, root: view.container, tell: () => undefined }).settle();
		return { activity, client: view.app, host, view, writer };
	},
	inspect: ({ client, view }) => ({ activity: Effect.runSync(clientActivity(client).current), text: view.container.textContent }),
	name: "screen on a host that confirms commands",
	stages: ["host"],
	verbs: ({ activity, client, host, view, writer }, story) => {
		const options = { act, activity, root: view.container, tell: story.tell };
		const driver = screenDriver({ ...options, sync: screenSync(client, view.registry) });
		return {
			...driver,
			anotherViewerSaves: (title: string) => {
				story.tell(`another viewer saves ${JSON.stringify(title)}`);
				return writer["reflected.write"]({ title });
			},
			shown: () => Effect.sync(() => driver.text("output")),
			syncWithoutSync: () => screenDriver(options).sync(),
			updateStarted: () => Effect.promise(() => act(() => Effect.runPromise(Queue.take(host.updating)))),
		};
	},
});

export const updatesHeld = reflectedPage.trait("host", "the server starts each update of the page and never finishes it", function* ({ host }) {
	host.page.update = yield* Deferred.make<void>();
});

export const updatesFollowReplies = reflectedPage.trait(
	"host",
	"the server finishes an update of the page only after the client has the reply to the command or sync that waits for it",
	function* ({ client, host }) {
		const waiting = until(clientActivity(client), (state) => state.commands === 0 && state.unreflectedCommands > 0, {
			name: "a reply the client waits to see reflected",
			timeout: "1 minute",
		});
		const next = Effect.gen(function* () {
			const held = yield* Deferred.make<void>();
			host.page.update = held;
			yield* Queue.take(host.updating);
			yield* waiting;
			host.page.update = undefined;
			yield* Deferred.succeed(held, undefined);
		});
		yield* Effect.forkScoped(Effect.forever(next), { startImmediately: true });
	},
);
