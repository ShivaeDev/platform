import { useAtomValue } from "@effect/atom-react";
import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Layer, Queue } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Socket from "effect/socket/Socket";
import { act, createElement } from "react";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { render } from "@shivaedev/test-story/client/react.ts";
import { browserReads } from "#browserReads.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { ReadPage, readPageHost } from "./readPageHost.ts";

function Page({ client }: { readonly client: ReturnType<typeof makePageClient> }) {
	const result = useAtomValue(client.api.get.query({ id: 1 }));
	useAtomValue(client.api[LiveConnection].connection);
	return createElement(
		"main",
		null,
		createElement(
			"output",
			null,
			AsyncResult.getOrElse(result, () => "Loading"),
		),
	);
}

function makePageClient(url: string, protocol: Effect.Success<ReturnType<typeof browserReads>>["protocol"]) {
	return makeClient(ReadPage, { protocol, url });
}

export const readPage = storyKit({
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const { url } = yield* readPageHost;
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
		const local = yield* client.client;
		const writer = yield* makeClient(ReadPage, { url, webSocketConstructor: layerWebSocketConstructorWS }).client;
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement(Page, { client }))),
			(rendered) => Effect.promise(rendered.unmount),
		);
		const screen = screenDriver({
			act,
			pending: () =>
				view.registry.get(client.api.get.query({ id: 1 })).waiting || view.registry.get(client.api[LiveConnection].status).connection !== "live",
			root: view.container,
			tell: () => undefined,
		});
		yield* screen.settle();
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
		return { local, observed, screen, socketAddresses: () => [...addresses], socketUrl: () => url.replace(/^http/u, "ws"), updates, writer };
	},
	inspect: ({ observed, screen }) => ({ hints: observed.hints(), reads: observed.reads(), text: screen.text("output") }),
	name: "browser reads",
	stages: [],
	verbs: ({ local, observed, screen, socketAddresses, socketUrl, updates, writer }, story) => ({
		...observed,
		nextResult: () =>
			Effect.promise(async () => {
				let result: string | undefined;
				await act(async () => {
					result = await Effect.runPromise(Queue.take(updates));
				});
				return result;
			}),
		socketAddresses,
		socketUrl,
		text: () => screen.text("output"),
		write: (id: number, title: string) => {
			story.tell(`write page ${id} as ${JSON.stringify(title)} through another client`);
			return writer["page.write"]({ id, title });
		},
		writeHere: (id: number, title: string) => {
			story.tell(`the page writes page ${id}`);
			return local["page.write"]({ id, title });
		},
	}),
});
