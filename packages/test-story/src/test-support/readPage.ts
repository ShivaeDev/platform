import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Deferred, Effect, Fiber, Layer, PubSub, Queue } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Socket from "effect/socket/Socket";
import { act, createElement } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { render } from "@shivaedev/test-story/client/react.ts";
import { browserReads } from "#browserReads.ts";
import { domFetch } from "#domFetch.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { ReadPage, readPageHost } from "#test/readPageHost.ts";
import { makePageClient, ReadPageView } from "#test/readPageView.ts";

export const readPage = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const { url, held, opened } = yield* readPageHost;
		const openings = yield* PubSub.subscribe(opened);
		const addresses: string[] = [];
		const socketConstructor = Layer.effect(
			Socket.WebSocketConstructor,
			Effect.map(Socket.WebSocketConstructor, (make) => (address, options) => {
				addresses.push(address);
				return make(address, options);
			}),
		).pipe(Layer.provide(layerWebSocketConstructorWS));
		const observed = yield* browserReads({ contracts: [ReadPage], url, webSocketConstructor: socketConstructor });
		const client = makePageClient(url, observed.protocol);
		const fetch = domFetch(url);
		const writer = yield* makeClient(ReadPage, { url, webSocketConstructor: layerWebSocketConstructorWS }).client;
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement(ReadPageView, { client, fetch }))),
			(rendered) => Effect.promise(rendered.unmount),
		);
		const screen = screenDriver({
			act,
			pending: () =>
				view.container.querySelector("main")?.getAttribute("aria-busy") === "true"
				|| view.registry.get(client.api.get.query({ id: 1 })).waiting
				|| view.registry.get(client.api[LiveConnection].status).connection !== "live",
			root: view.container,
			tell: () => undefined,
		});
		yield* screen.settle();
		yield* PubSub.take(openings);
		const updates = yield* Queue.unbounded<string>();
		yield* Effect.acquireRelease(
			Effect.sync(() =>
				view.registry.subscribe(client.api.get.query({ id: 1 }), (result) => {
					if (AsyncResult.isSuccess(result) && !result.waiting) {
						Queue.offerUnsafe(updates, result.value);
					}
				}),
			),
			(stop) => Effect.sync(stop),
		);
		return {
			client,
			held,
			observed,
			openings,
			screen,
			socketAddresses: () => [...addresses],
			socketUrl: () => url.replace(/^http/u, "ws"),
			updates,
			writer,
		};
	},
	inspect: ({ observed, screen }) => ({ hints: observed.hints(), reads: observed.reads(), text: screen.text("main") }),
	name: "browser reads",
	stages: [],
	verbs: ({ held, openings, client, observed, screen, socketAddresses, socketUrl, updates, writer }, story) => ({
		...observed,
		nextResult: () =>
			Effect.promise(async () => {
				let result: string | undefined;
				await act(async () => {
					result = await Effect.runPromise(Queue.take(updates));
				});
				return result;
			}),
		openPrivatePage: () => {
			story.tell("the page opens a private live read");
			return screen.click({ name: "Open private page", role: "button" }).pipe(Effect.andThen(PubSub.take(openings)));
		},
		openSecondPage: () => {
			story.tell("the page opens a second live read");
			return screen.click({ name: "Open second page", role: "button" }).pipe(Effect.andThen(PubSub.take(openings)));
		},
		readout: {
			hints: Effect.sync(observed.hints),
			readCount: Effect.sync(() => observed.readCount()),
			secondPage: Effect.sync(() => screen.text("output:last-of-type")),
			sockets: Effect.sync(socketAddresses),
			subscriptionStates: Effect.sync(() => observed.subscriptions().map(({ state }) => state)),
			subscriptions: Effect.sync(observed.subscriptions),
		},
		releaseSecondPage: () => {
			story.tell("the server answers the second subscription");
			return Deferred.succeed(held, undefined);
		},
		signIn: () => {
			story.tell("alice signs in through the page");
			return screen.click({ name: "Sign in", role: "button" }).pipe(Effect.andThen(screen.settle()));
		},
		signOut: () => {
			story.tell("alice signs out through the page");
			return screen.click({ name: "Sign out", role: "button" }).pipe(Effect.andThen(screen.settle()));
		},
		socketAddresses,
		socketUrl,
		startWaiting: () =>
			Effect.gen(function* () {
				story.tell("wait for every subscription opening to answer or be refused");
				const waiter = yield* observed.waitForSubscriptions.pipe(Effect.forkScoped({ startImmediately: true }));
				return { finish: Fiber.join(waiter), state: Effect.sync(() => (waiter.pollUnsafe() === undefined ? "waiting" : "settled")) };
			}),
		text: () => screen.text("output"),
		waitForPage: () => {
			story.tell("wait for the page to render its live data");
			return screen.settle();
		},
		write: (id: number, title: string) => {
			story.tell(`write page ${id} as ${JSON.stringify(title)} through another client`);
			return writer["page.write"]({ id, title });
		},
		writeHere: (id: number, title: string) => {
			story.tell(`the page writes page ${id}`);
			return Effect.flatMap(client.client, (local) => local["page.write"]({ id, title }));
		},
	}),
});
