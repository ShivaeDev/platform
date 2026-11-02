import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { type FakeHttpReply, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { RemoteStatusError } from "#errors.ts";
import { filterStatus } from "#filterStatus.ts";
import { type Lifecycle, makeLifecycle, observeClient } from "./observation.ts";

interface ClientSelection {
	readonly clients: Map<"fetch" | "node", HttpClient.HttpClient>;
	followRedirects: boolean;
	readonly lifecycle: Lifecycle;
	transport: "fetch" | "node";
}

export const createClientEngine = Effect.fnUntraced(function* () {
	const replies: { answer: FakeHttpReply; body: FakeHttpReply; pageRedirect?: FakeHttpReply } = {
		answer: { status: 200 },
		body: { chunks: ["paper"] },
	};
	const links = new Map<number, string>();
	const statusFailures: RemoteStatusError[] = [];
	const otherOrigin = yield* fakeHttpService({ routes: { page: { path: "/page", reply: () => ({ body: ["foreign"] }) } } });
	function pageReply(page: string | undefined) {
		return {
			body: ["paper", "ink", "pens"].slice(Number(page) - 1, Number(page)),
			headers: { Link: links.get(Number(page)) ?? "" },
		};
	}
	const remote = yield* fakeHttpService({
		routes: {
			answer: { method: "POST", path: "/answer", reply: () => replies.answer },
			archive: { path: "/archive/pages/:page", reply: ({ params }) => pageReply(params.page) },
			body: { path: "/body", reply: () => replies.body },
			head: { method: "HEAD", path: "/body", reply: () => ({ headers: { "content-length": "1000" } }) },
			page: { path: "/pages/:page", reply: ({ params }) => replies.pageRedirect ?? pageReply(params.page) },
			paper: { path: "/paper", reply: () => ({ chunks: ["paper"] }) },
		},
	});
	const lifecycle = yield* makeLifecycle;
	const clients = new Map<"fetch" | "node", HttpClient.HttpClient>();
	const state: ClientSelection = { clients, followRedirects: false, lifecycle, transport: "fetch" };
	yield* selectClient(state, "fetch");
	function rawClient() {
		const selected = clients.get(state.transport);
		if (selected === undefined) {
			throw new Error(`No ${state.transport} client was built`);
		}
		return state.followRedirects ? HttpClient.followRedirects(selected) : selected;
	}
	return { client: () => filterStatus(rawClient()), lifecycle, links, otherOrigin, rawClient, remote, replies, selection: state, statusFailures };
});

export type ClientEngine = Effect.Success<ReturnType<typeof createClientEngine>>;

export const selectClient = Effect.fnUntraced(function* (state: ClientSelection, transport: "fetch" | "node") {
	const context = yield* Layer.build(
		transport === "fetch" ? FetchHttpClient.layer : NodeHttpClient.layerNodeHttpOptions({ keepAlive: true, maxSockets: 1 }),
	);
	const client = yield* HttpClient.HttpClient.pipe(Effect.provide(context));
	const configured =
		transport === "fetch" ? HttpClient.transformResponse(client, Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" })) : client;
	state.clients.set(transport, observeClient(configured, transport, state.lifecycle));
	state.transport = transport;
});
