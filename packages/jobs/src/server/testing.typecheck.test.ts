import { Context, Effect, Schema, SchemaGetter } from "effect";
import { expectTypeOf } from "vitest";
import { defineSchedule } from "#server/defineSchedule.ts";
import { defineQueue } from "#server/definition.ts";
import type { PgBossPayloadError, PgBossTestingError } from "#server/error.ts";
import type { Job } from "#server/job.ts";
import { makePgBossTesting } from "#server/testing.ts";

class DecodeDependency extends Context.Service<DecodeDependency, number>()("@shivaedev/jobs/test/DecodeDependency") {}

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
expectTypeOf<Effect.Success<typeof readout>>().toEqualTypeOf<Job<{ readonly id: number; readonly label: string }>[]>();

const notes = defineQueue({ name: "snapshot-notes", schema: Schema.Struct({ note: Schema.String }) });
const snapshot = makePgBossTesting().snapshot([queue, notes]);
expectTypeOf<Effect.Services<typeof snapshot>>().toEqualTypeOf<DecodeDependency>();
expectTypeOf<Effect.Error<typeof snapshot>>().toEqualTypeOf<PgBossTestingError | PgBossPayloadError>();
expectTypeOf<Effect.Success<typeof snapshot>[number]["queue"]>().toEqualTypeOf<"decoded-readout" | "snapshot-notes">();
expectTypeOf<Effect.Success<typeof snapshot>[number]["data"]>().toEqualTypeOf<
	{ readonly id: number; readonly label: string } | { readonly note: string }
>();
expectTypeOf<Effect.Error<ReturnType<typeof makePgBossTesting>["waitForIdle"]>>().toEqualTypeOf<PgBossTestingError>();

const testing = makePgBossTesting();
const emptyReadout = testing.jobs({ name: "scheduled", schema: Schema.Null });
expectTypeOf<Effect.Success<typeof emptyReadout>>().toEqualTypeOf<Job<null>[]>();
expectTypeOf<Effect.Services<typeof emptyReadout>>().toEqualTypeOf<never>();
const emptyWait = testing.untilJob({ name: "scheduled", schema: Schema.Null }, "run-id", "completed");
expectTypeOf<Effect.Success<typeof emptyWait>>().toEqualTypeOf<Job<null>>();
const refresh = testing.refreshQueueStats(queue);
expectTypeOf<Effect.Success<typeof refresh>>().toEqualTypeOf<void>();
expectTypeOf<Effect.Error<typeof refresh>>().toEqualTypeOf<PgBossTestingError>();
const triggered = testing.trigger(defineSchedule({ cron: "17 3 * * *", name: "scheduled" }));
expectTypeOf<Effect.Success<typeof triggered>>().toEqualTypeOf<string | null>();
expectTypeOf<Effect.Error<typeof triggered>>().toEqualTypeOf<PgBossTestingError>();
