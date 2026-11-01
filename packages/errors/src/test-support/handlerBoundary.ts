import { Effect, Schema, Stream } from "effect";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { rpcBoundary } from "#boundary.ts";
import { rpcBoundaryHandlers } from "#rpcBoundaryHandlers.ts";
import { Conflict, InternalServerError } from "#taxonomy.ts";

const Outcome = Schema.Literals(["success", "throws", "unexpected", "defect", "declared"]);
type Outcome = typeof Outcome.Type;
const declaration = { error: Schema.Union([Conflict, InternalServerError]), payload: { outcome: Outcome }, success: Schema.String };
const Api = RpcGroup.make(
	Rpc.make("Read", declaration),
	Rpc.make("ForkRead", declaration),
	Rpc.make("Follow", { ...declaration, stream: true }),
	Rpc.make("ForkFollow", { ...declaration, stream: true }),
);

function perform(outcome: Outcome) {
	switch (outcome) {
		case "throws":
			throw new Error("database password=private-value");
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

const boundary = rpcBoundary(declaration.error, {
	message: "Notes unavailable",
	unexpected: (message) => new InternalServerError({ message }),
});
const handlers = Api.toLayer(
	rpcBoundaryHandlers(Api, boundary, {
		Follow: ({ outcome }) => Stream.fromEffect(perform(outcome)),
		ForkFollow: ({ outcome }) => Rpc.fork(Stream.fromEffect(perform(outcome))),
		ForkRead: ({ outcome }) => Rpc.fork(perform(outcome)),
		Read: ({ outcome }) => perform(outcome),
	}),
);

export const handlerBoundary = storyKit({
	*create() {
		const client = yield* RpcTest.makeClient(Api).pipe(Effect.provide(handlers));
		return { client };
	},
	name: "RPC handler group boundary",
	stages: [],
	verbs: ({ client }, story) => ({
		call: (method: "Read" | "ForkRead" | "Follow" | "ForkFollow", outcome: Outcome) => {
			story.tell(`the native client calls ${method} with ${outcome}`);
			const result =
				method === "Follow" || method === "ForkFollow"
					? Stream.runCollect(client[method]({ outcome }))
					: client[method]({ outcome }).pipe(Effect.map((value) => [value]));
			return result.pipe(Effect.match({ onFailure: (rejected) => ({ rejected }), onSuccess: (received) => ({ received }) }));
		},
	}),
});
