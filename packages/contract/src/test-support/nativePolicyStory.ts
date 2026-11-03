import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Layer, Schema, Stream } from "effect";
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { appHost } from "@shivaedev/server/appHost.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { answered } from "./answers.ts";

function policyStory(host: "native" | "application") {
	return storyKit({
		clock: "live",
		*create() {
			const policy = { allowed: false, checks: 0, handlerCalls: 0 };
			const check = Effect.sync(() => {
				policy.checks += 1;
				return policy.allowed;
			});
			const Reads = contract("reads", {
				queries: [
					query("read", {
						readPolicy: () => check,
						reads: () => [],
						success: Schema.String,
					}),
				],
			});
			const handlers = Reads.toLayer({
				"reads.$changes": () => Stream.empty,
				"reads.read": () =>
					Effect.sync(() => {
						policy.handlerCalls += 1;
						return "A note";
					}),
			});
			const native = HttpRouter.serve(
				RpcServer.layerHttp({ group: Reads, path: "/rpc", protocol: "http" }).pipe(Layer.provide([handlers, RpcSerialization.layerNdjson])),
				{ disableLogger: true },
			).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })));
			const services = yield* Layer.build(host === "native" ? native : appHost({ config: { port: 0 }, group: Reads, handlers, policy: "loopback" }));
			const server = Context.get(services, HttpServer.HttpServer);
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected a TCP listener");
			}
			const protocol = RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${server.address.port}/rpc` }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
			);
			const client = yield* RpcClient.make(Reads, { flatten: true }).pipe(Effect.provide(protocol));
			return { client, policy };
		},
		name: `${host} host read policies over HTTP`,
		stages: [],
		verbs: ({ client, policy }, story) => ({
			allowRead: () =>
				Effect.sync(() => {
					policy.allowed = true;
				}),
			handlerCalls: () => Effect.sync(() => policy.handlerCalls),
			policyChecks: () => Effect.sync(() => policy.checks),
			read: () => {
				story.tell(`read a note through the ${host} host's HTTP RPC`);
				return answered(client("reads.read", undefined), (value) => value);
			},
		}),
	});
}

export const nativePolicyStory = policyStory("native");
export const applicationPolicyStory = policyStory("application");
