import { Context, Effect, Schema, SchemaGetter } from "effect";
import type { JobAttempt, JobWithMetadata } from "pg-boss";
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

const completions = makePgBossTesting().completions(queue);
expectTypeOf<Effect.Services<typeof completions>>().toEqualTypeOf<never>();
expectTypeOf<Effect.Error<typeof completions>>().toEqualTypeOf<never>();
expectTypeOf<Effect.Success<typeof completions>>().toEqualTypeOf<readonly JobAttempt[]>();
