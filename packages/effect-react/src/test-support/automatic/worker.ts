import process from "node:process";
import { Effect, Layer, ManagedRuntime, Redacted, Schema } from "effect";
import { defineQueue } from "@shivaedev/effect-pg-boss/definition.ts";
import { makePgBoss } from "@shivaedev/effect-pg-boss/service.ts";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { appDatabase } from "@shivaedev/platform/server/appHost.ts";
import { migrations, repository } from "./feature.ts";

const Configuration = Schema.Struct({ databaseUrl: Schema.String, schema: Schema.String });
const config = Schema.decodeUnknownSync(Schema.fromJsonString(Configuration))(process.argv[2]);
const Work = Schema.Struct({ id: Schema.Number, rollback: Schema.Boolean, title: Schema.String });
const Message = Schema.Union([Schema.Struct({ _tag: Schema.Literal("Close") }), Schema.Struct({ _tag: Schema.Literal("Write"), work: Work })]);
const queue = defineQueue({ name: "rename-note", schema: Work, worker: { pollingIntervalSeconds: 0.5 } });
const Jobs = makePgBoss("automatic/Jobs");
const runtime = ManagedRuntime.make(
	Jobs.layer({
		connectionString: config.databaseUrl,
		jobs: [
			queue.handle((work) =>
				Effect.gen(function* () {
					const rows = yield* repository;
					const result = yield* rows
						.update({ id: work.id, title: work.title })
						.pipe(Effect.andThen(work.rollback ? Effect.fail("rollback") : Effect.void), transact({ onSqlError: (error) => error }), Effect.result);
					process.send?.({ _tag: "Handled", result: result._tag });
				}),
			),
		],
		schema: config.schema,
	}).pipe(
		Layer.provideMerge(
			appDatabase({
				config: { applicationName: "automatic-worker", databaseUrl: Redacted.make(config.databaseUrl) },
				migrations: { ...migrations, mode: "check" },
			}),
		),
	),
);
await runtime.runPromise(Jobs);
process.on("message", (message) => {
	const input = Schema.decodeUnknownSync(Message)(message);
	async function handle() {
		if (input._tag === "Close") {
			await runtime.dispose();
			process.disconnect();
		} else {
			await runtime.runPromise(Jobs.use((jobs) => jobs.enqueue(queue, input.work)));
		}
	}
	void handle().catch((error: unknown) => process.send?.({ _tag: "Failure", message: String(error) }));
});
process.send?.({ _tag: "Ready" });
