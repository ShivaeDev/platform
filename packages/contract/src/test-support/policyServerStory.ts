import { Context, Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { appHost } from "@shivaedev/server/appHost.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";

export const policyServerStory = storyKit({
	clock: "live",
	create: () =>
		Effect.sync(() => {
			const get = query("get", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String });
			const list = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String });
			const Notes = contract("notes", { queries: [get, list] });
			const Archive = contract("archive", { queries: [list] });
			const group = Notes.merge(Archive.omit("archive.list"));
			return {
				get,
				group,
				handlers: Notes.application.toLayer({ "notes.get": () => Effect.succeed("A note"), "notes.list": () => Effect.succeed("Notes") }),
				list,
				server: Option.none<HttpServer.HttpServer["Service"]>(),
			};
		}),
	name: "read policy startup",
	stages: ["declarations"],
	verbs: (engine, story) => ({
		read: () =>
			Effect.gen(function* () {
				story.tell("read a note through the running server's HTTP RPC");
				const server = Option.getOrThrow(engine.server);
				if (!NetAddress.isInetAddress(server.address)) {
					return yield* Effect.die("Expected a TCP listener");
				}
				const url = `http://${NetAddress.formatIp(server.address.address)}:${server.address.port}/rpc`;
				return yield* Effect.gen(function* () {
					const client = yield* RpcClient.make(engine.group, { flatten: true });
					return yield* client("notes.get", undefined);
				}).pipe(Effect.provide(RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))));
			}),
		start: () => {
			story.tell("build the application server Layer");
			return Layer.build(appHost({ config: { port: 0 }, group: engine.group, handlers: engine.handlers, policy: "loopback" })).pipe(
				Effect.map((context) => {
					engine.server = Option.some(Context.get(context, HttpServer.HttpServer));
					return "started";
				}),
				Effect.catchTag("MissingReadPolicies", (error) => Effect.succeed({ error: error._tag, message: error.message, queries: error.queries })),
			);
		},
	}),
});

export const untypedQueries = policyServerStory.trait("declarations", "untyped declarations omit policies on get and list", (engine) => {
	Reflect.deleteProperty(engine.get, "readPolicy");
	Reflect.deleteProperty(engine.list, "readPolicy");
});
