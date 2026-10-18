import { TRPCError } from "@trpc/server";
import { Effect, Layer, Schema, SchemaGetter } from "effect";
import { RejectionError, rejectWith } from "#server/rejection.ts";
import { adapterHost } from "./adapterHost.ts";
import type { RouterEngine } from "./routerEngine.ts";
import { selectRouter } from "./routerSetup.ts";
import { trpc } from "./routerStory.ts";

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", { field: Schema.String, message: Schema.String }) {}
export class Other extends Schema.TaggedError<Other>()("Other", { message: Schema.String }) {}
const NeverEncoded = Schema.String.pipe(
	Schema.decodeTo(Schema.Number, { decode: SchemaGetter.Number(), encode: SchemaGetter.forbidden(() => "Counts are never sent") }),
);
class Unencodable extends Schema.TaggedError<Unencodable>()("Unencodable", { count: NeverEncoded }) {}
export const other = new Other({ message: "Elsewhere" });

function* build(engine: RouterEngine) {
	const { adapter, procedure, t } = yield* adapterHost(engine, Layer.empty);
	const router = t.router({
		conflict: procedure.query(function* () {
			const error = Object.assign(new Conflict({ field: "name", message: "Name is taken" }), { secret: "private" });
			return yield* Effect.fail(error).pipe(rejectWith(Conflict));
		}),
		die: procedure.query(function* () {
			return yield* Effect.die(new Conflict({ field: "name", message: "Died" })).pipe(rejectWith(Conflict));
		}),
		explicit: procedure.query(function* () {
			return yield* Effect.fail(new TRPCError({ code: "CONFLICT", message: "Name is taken" }));
		}),
		other: procedure.query(function* () {
			return yield* Effect.fail(other).pipe(rejectWith(Conflict));
		}),
		success: procedure.query(function* () {
			return yield* Effect.succeed(1).pipe(rejectWith(Conflict));
		}),
		tag: procedure
			.input(Schema.StructWithRest(Schema.Struct({ _tag: Schema.String }), [Schema.Record(Schema.String, Schema.Unknown)]))
			.query(function* (input) {
				return yield* Effect.fail(new RejectionError(input));
			}),
		unencodable: procedure.query(function* () {
			return yield* Effect.fail(new Unencodable({ count: 1 })).pipe(rejectWith(Unencodable));
		}),
	});
	return { router, runWithServices: adapter.runWithServices };
}

export function rejectionRules() {
	return trpc.trait("router", "procedures declare Conflict and encode only declared failures", (engine) => {
		selectRouter(engine, "rejectionRules", (state) => Effect.gen(() => build(state)));
	});
}
