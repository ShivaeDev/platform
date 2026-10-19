import { Context, Effect, Schema, SchemaGetter } from "effect";
import type { JobWithMetadata } from "pg-boss";
import { expectTypeOf } from "vitest";
import { defineQueue } from "#definition.ts";
import type { PgBossPayloadError, PgBossTestingError } from "#error.ts";
import { makePgBossTesting } from "#testing.ts";

class DecodeDependency extends Context.Service<DecodeDependency, number>()("@test/DecodeDependency") {}

const queue = defineQueue({
	name: "decoded-readout",
	schema: Schema.Struct({
		id: Schema.NumberFromString,
		label: Schema.String.pipe(
			Schema.decodeTo(Schema.String, {
				decode: SchemaGetter.checkEffect(() => Effect.as(DecodeDependency, true)),
				encode: SchemaGetter.passthrough(),
			}),
		),
	}),
});
const readout = makePgBossTesting().jobs(queue);
expectTypeOf<Effect.Services<typeof readout>>().toEqualTypeOf<DecodeDependency>();
expectTypeOf<Effect.Error<typeof readout>>().toEqualTypeOf<PgBossTestingError | PgBossPayloadError>();
expectTypeOf<Effect.Success<typeof readout>>().toEqualTypeOf<JobWithMetadata<{ readonly id: number; readonly label: string }>[]>();

const notes = defineQueue({ name: "snapshot-notes", schema: Schema.Struct({ note: Schema.String }) });
const snapshot = makePgBossTesting().snapshot([queue, notes]);
expectTypeOf<Effect.Services<typeof snapshot>>().toEqualTypeOf<DecodeDependency>();
expectTypeOf<Effect.Error<typeof snapshot>>().toEqualTypeOf<PgBossTestingError | PgBossPayloadError>();
expectTypeOf<Effect.Success<typeof snapshot>[number]["queue"]>().toEqualTypeOf<"decoded-readout" | "snapshot-notes">();
expectTypeOf<Effect.Success<typeof snapshot>[number]["data"]>().toEqualTypeOf<
	{ readonly id: number; readonly label: string } | { readonly note: string }
>();
expectTypeOf<Effect.Error<ReturnType<typeof makePgBossTesting>["waitForIdle"]>>().toEqualTypeOf<PgBossTestingError>();
