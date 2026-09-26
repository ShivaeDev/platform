import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcClient, RpcGroup } from "effect/unstable/rpc";
import { expect, test } from "vitest";
import { BadRequest, Conflict, Forbidden, NotFound, PreconditionFailed, rejectedField, TooManyRequests } from "../src/errors.ts";
import { httpClient, rpcHttp, serve } from "./rpc/support.ts";

const Rejection = Schema.Union([NotFound, BadRequest, Conflict, PreconditionFailed, TooManyRequests]);
const Profiles = RpcGroup.make(Rpc.make("Rename", { payload: { name: Schema.String }, success: Schema.String, error: Rejection }));

const Handlers = Profiles.toLayer({
	Rename: ({ name }) => {
		if (name === "") return Effect.fail(new BadRequest({ message: "Name is required", field: "name" }));
		if (name === "taken") return Effect.fail(new Conflict({ message: "Name is taken", field: "name" }));
		if (name === "stale") return Effect.fail(new PreconditionFailed({ message: "Profile changed" }));
		if (name === "missing") return Effect.fail(new NotFound({ message: "No profile" }));
		if (name === "busy") return Effect.fail(new TooManyRequests({ message: "Slow down" }));
		return Effect.succeed(name);
	},
});

test("taxonomy errors cross native RPC JSON as decoded instances with their field", async () => {
	const app = serve(rpcHttp(Profiles).pipe(Layer.provide(Handlers)));
	try {
		const rename = (name: string) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const client = yield* RpcClient.make(Profiles);
					return yield* Effect.flip(client.Rename({ name }));
				}).pipe(Effect.provide(httpClient(app, {})), Effect.scoped),
			);
		const taken = await rename("taken");
		expect(taken).toBeInstanceOf(Conflict);
		expect(rejectedField(taken)).toEqual(Option.some({ field: "name", message: "Name is taken" }));
		expect(rejectedField(await rename(""))).toEqual(Option.some({ field: "name", message: "Name is required" }));
		const stale = await rename("stale");
		expect(stale).toBeInstanceOf(PreconditionFailed);
		expect(rejectedField(stale)).toEqual(Option.none());
		expect(await rename("missing")).toMatchObject({ _tag: "NotFound", message: "No profile" });
		const busy = await rename("busy");
		expect(busy).toBeInstanceOf(TooManyRequests);
		expect(busy).toMatchObject({ message: "Slow down" });
		expect(rejectedField(busy)).toEqual(Option.none());
	} finally {
		await app.dispose();
	}
});

class Invalid extends Schema.TaggedError<Invalid>()("Invalid", { field: Schema.Literals(["title"]), message: Schema.String }) {}

test("taxonomy errors encode to tagged JSON and any tagged error with a field is a field rejection", () => {
	expect(Schema.encodeSync(Rejection)(new Conflict({ message: "Name is taken", field: "name" }))).toEqual({
		_tag: "Conflict",
		message: "Name is taken",
		field: "name",
	});
	expect(Schema.encodeSync(Rejection)(new BadRequest({ message: "Malformed" }))).toEqual({ _tag: "BadRequest", message: "Malformed" });
	expect(Schema.encodeSync(Rejection)(new TooManyRequests({ message: "Slow down" }))).toEqual({ _tag: "TooManyRequests", message: "Slow down" });
	expect(rejectedField(new BadRequest({ message: "Malformed" }))).toEqual(Option.none());
	expect(rejectedField(new Forbidden({ message: "No" }))).toEqual(Option.none());
	expect(rejectedField({ _tag: "Conflict", message: "Encoded", field: "name" })).toEqual(Option.some({ field: "name", message: "Encoded" }));
	expect(rejectedField(new Invalid({ field: "title", message: "Too long" }))).toEqual(Option.some({ field: "title", message: "Too long" }));
	expect(rejectedField({ field: "title", message: "Untagged" })).toEqual(Option.none());
	expect(rejectedField({ _tag: 1, field: "title", message: "Numeric tag" })).toEqual(Option.none());
	expect(rejectedField({ _tag: "Invalid", field: 1, message: "Numeric field" })).toEqual(Option.none());
	expect(rejectedField({ _tag: "Invalid", field: "title" })).toEqual(Option.none());
	expect(rejectedField(null)).toEqual(Option.none());
});
