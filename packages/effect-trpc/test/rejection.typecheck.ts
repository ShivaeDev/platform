import type { TRPCClientError } from "@trpc/client";
import { initTRPC, type TRPC_ERROR_CODE_KEY } from "@trpc/server";
import { Context, Effect, type Option, Schema, SchemaGetter } from "effect";
import { expectTypeOf } from "vitest";
import { decodeRejection, type EncodedRejection, rejectionOf } from "../src/client.ts";
import { type RejectionError, rejectionFormatter, rejectWith, withRejection } from "../src/index.ts";

class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { message: Schema.String }) {}
class Conflict extends Schema.TaggedError<Conflict>()("Conflict", { field: Schema.String, message: Schema.String }) {}
class Other extends Schema.TaggedError<Other>()("Other", {}) {}
class Clock extends Context.Service<Clock, number>()("@types/Clock") {}

const Rejection = Schema.Union([NotFound, Conflict]);

declare const failing: Effect.Effect<number, NotFound | Conflict | Other, Clock>;

expectTypeOf(failing.pipe(rejectWith(Rejection))).toEqualTypeOf<Effect.Effect<number, Other | RejectionError, Clock>>();
expectTypeOf(Effect.fail(new Other()).pipe(rejectWith(Schema.Never))).toEqualTypeOf<Effect.Effect<never, Other | RejectionError>>();

rejectWith(Rejection, {
	code: (tag) => {
		expectTypeOf(tag).toEqualTypeOf<"NotFound" | "Conflict">();
		return tag === "NotFound" ? "NOT_FOUND" : "CONFLICT";
	},
});

// @ts-expect-error A rejection schema must decode to a tagged value.
rejectWith(Schema.Struct({ message: Schema.String }));

class Spoof extends Schema.TaggedError<Spoof>()("Spoof", { invalidInput: Schema.Literal(true) }) {}
// @ts-expect-error A declared rejection may not encode the reserved invalidInput field.
rejectWith(Spoof);
// @ts-expect-error A declared rejection may not encode the reserved invalidInput field, even optionally.
rejectWith(Schema.Struct({ _tag: Schema.Literal("Spoof"), invalidInput: Schema.optionalKey(Schema.Boolean) }));

// @ts-expect-error The code must be a tRPC error code.
rejectWith(Rejection, { code: () => "GONE" });

declare const error: unknown;

const decoded = decodeRejection(Rejection)(error);
expectTypeOf(decoded).toEqualTypeOf<Option.Option<NotFound | Conflict>>();
if (decoded._tag === "Some" && decoded.value._tag === "Conflict") {
	expectTypeOf(decoded.value.field).toEqualTypeOf<string>();
}

const encoded = rejectionOf(error);
expectTypeOf(encoded).toEqualTypeOf<Option.Option<EncodedRejection>>();
if (encoded._tag === "Some") {
	expectTypeOf(encoded.value._tag).toEqualTypeOf<string>();
	expectTypeOf(encoded.value.field).toEqualTypeOf<unknown>();
	expectTypeOf(encoded.value.invalidInput).toEqualTypeOf<true | undefined>();
}

// @ts-expect-error A rejection schema must decode to a tagged value.
decodeRejection(Schema.String);

class Requires extends Context.Service<Requires, string>()("@types/Requires") {}
const Tagged = Schema.Struct({ _tag: Schema.Literal("NotFound") });
const NeedsServices = Tagged.pipe(
	Schema.decodeTo(Tagged, { decode: SchemaGetter.checkEffect(() => Effect.map(Requires, () => true)), encode: SchemaGetter.passthrough() }),
);
// @ts-expect-error The client decodes synchronously, so the schema may not require services.
decodeRejection(NeedsServices);

const t = initTRPC.create({ errorFormatter: rejectionFormatter });
const router = t.router({});
declare const clientError: TRPCClientError<typeof router>;
expectTypeOf(clientError.data?.rejection).toEqualTypeOf<EncodedRejection | undefined>();
expectTypeOf(clientError.data?.rejection?.invalidInput).toEqualTypeOf<true | undefined>();
expectTypeOf(clientError.data?.code).toEqualTypeOf<TRPC_ERROR_CODE_KEY | undefined>();

declare const shape: { readonly message: string; readonly data: { readonly code: string } };
declare const trpcError: RejectionError;
expectTypeOf(withRejection(shape, trpcError).data.code).toEqualTypeOf<string>();
expectTypeOf(withRejection(shape, trpcError).data.rejection).toEqualTypeOf<EncodedRejection | undefined>();
