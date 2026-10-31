import { Context, Effect, Layer, Schema, Stream } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcSerialization } from "effect/rpc";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { rpcBoundaryHandlers } from "@shivaedev/errors/rpcBoundaryHandlers.ts";
import { Conflict, InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { contract } from "#contract.ts";
import { command, query, stream } from "#operation.ts";
import { answered } from "./answers.ts";

const Outcome = Schema.Literals(["success", "unexpected", "defect", "declared"]);
type Outcome = typeof Outcome.Type;
const declaration = {
	payload: { outcome: Outcome },
	rejections: { Conflict, InternalServerError },
	success: Schema.String,
};
const Api = contract("boundary", {
	commands: [command("save", { ...declaration, invalidates: () => [] })],
	queries: [query("read", { ...declaration, readPolicy: () => Effect.succeed(true), reads: () => [] })],
	streams: [stream("follow", { ...declaration, reads: () => [] })],
});

function perform(result: Outcome) {
	switch (result) {
		case "success":
			return Effect.succeed("a note");
		case "unexpected":
			return Effect.fail(new Error("database unavailable"));
		case "defect":
			return Effect.die(new Error("database unavailable"));
		case "declared":
			return Effect.fail(new Conflict({ field: "title", message: "Title is taken" }));
	}
}

const boundary = rpcBoundary(Schema.Union([Conflict, InternalServerError]), {
	message: "Notes unavailable",
	unexpected: (message) => new InternalServerError({ message }),
});
const handlers = Api.application.toLayer(
	rpcBoundaryHandlers(Api.application, boundary, {
		"boundary.follow": ({ outcome }) => Rpc.fork(Stream.concat(Stream.succeed("first note"), Stream.fromEffect(perform(outcome)))),
		"boundary.read": ({ outcome }) => perform(outcome),
		"boundary.save": ({ outcome }) => perform(outcome),
	}),
);

export const boundaryStory = storyKit({
	clock: "live",
	*create() {
		const services = yield* Layer.build(appHost({ config: { port: 0 }, group: Api, handlers, policy: "loopback" }));
		const server = Context.get(services, HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Expected a TCP listener");
		}
		const protocol = RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${server.address.port}/rpc` }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
		);
		const client = yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provide(protocol));
		return { client };
	},
	name: "RPC group boundary",
	stages: [],
	verbs: ({ client }, story) => ({
		call: (operation: "read" | "save", result: Outcome) => {
			story.tell(`the HTTP client calls ${operation} with a ${result} outcome`);
			return answered(client(`boundary.${operation}`, { outcome: result }), (value) => value);
		},
		follow: (result: Outcome) => {
			story.tell(`the HTTP client follows notes with a ${result} outcome after the first note`);
			const notes: string[] = [];
			return client("boundary.follow", { outcome: result }).pipe(
				Stream.tap((note) => Effect.sync(() => notes.push(note))),
				Stream.runDrain,
				(effect) => answered(effect, () => "completed"),
				Effect.map((ending) => ({ ending, notes })),
			);
		},
		subscribeOverHttp: () => {
			story.tell("the HTTP client subscribes to changes to its note query");
			return answered(
				client("boundary.$changes", { queries: [{ payload: { outcome: "success" }, query: "read" }] }).pipe(Stream.runDrain),
				() => "completed",
			);
		},
	}),
});
