import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Config, ConfigProvider, Console, Effect, Schema } from "effect";
import {
	applyPostgresSchedules,
	checkPostgresSchedules,
	type PostgresScheduleDeclaration,
	type PostgresScheduleReport,
} from "#adapters/railway/postgresSchedules.ts";
import { postgresSchedulesApi } from "#adapters/railway/postgresSchedulesApi.ts";

const PostgresScheduleDeclarationSchema = Schema.Struct({
	autoUpdates: Schema.Struct({
		schedule: Schema.Array(Schema.Struct({ day: Schema.Number, endHour: Schema.Number, startHour: Schema.Number })),
		type: Schema.Literal("minor"),
	}),
	backupKinds: Schema.Array(Schema.Literals(["DAILY", "WEEKLY", "MONTHLY"])),
});
const decodeDeclaration = Schema.decodeUnknownSync(PostgresScheduleDeclarationSchema);

function option(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index < 0 ? undefined : args[index + 1];
}

function describe(report: PostgresScheduleReport): string[] {
	const { missing, schedules } = report.backupKinds;
	const kinds = [...new Set(schedules.map(({ kind }) => kind))].sort((left, right) => left.localeCompare(right));
	const backups = missing.length === 0 ? `match (${kinds.join(", ")})` : `missing ${missing.join(", ")}`;
	const information = schedules
		.map(
			({ kind, cron, retentionSeconds }) =>
				`${kind}: cron ${cron}, retention ${retentionSeconds === null ? "Railway default" : `${retentionSeconds}s`}`,
		)
		.join("; ");
	let updates: string;
	if (report.autoUpdates.status === "unknown") {
		updates = "unknown (environment config has no source.autoUpdates read-back)";
	} else if (report.autoUpdates.status === "match") {
		updates = "match (minor-version updates and declared windows)";
	} else {
		updates = "do not match (minor-version updates and declared windows)";
	}
	return [
		`Backups: ${backups}. Railway owns cron and retention${information ? `; ${information}` : ""}.`,
		`Auto-updates: ${updates}.`,
		...(report.changes.length > 0 ? [`Applied: ${report.changes.join("; ")}.`] : []),
	];
}

export function postgresSchedulesCommand() {
	const args = process.argv.slice(2);
	const program = Effect.gen(function* () {
		const configPath = resolve(process.cwd(), option(args, "--config") ?? ".railway/postgres-schedules.ts");
		const module = yield* Effect.tryPromise({
			catch: (cause) => new Error(`Could not load ${configPath}: ${String(cause)}`),
			try: () => import(pathToFileURL(configPath).href),
		});
		const declaration: PostgresScheduleDeclaration = decodeDeclaration(module.postgresSchedules);
		const token = yield* Config.String("RAILWAY_TOKEN").pipe(Config.orElse(() => Config.String("RAILWAY_API_TOKEN")));
		const environmentId = yield* Config.String("RAILWAY_ENVIRONMENT_ID");
		const serviceId = option(args, "--service-id") ?? (yield* Config.String("RAILWAY_SERVICE_ID"));
		const volumeInstanceId = option(args, "--volume-instance-id") ?? (yield* Config.String("RAILWAY_POSTGRES_VOLUME_INSTANCE_ID"));
		const api = postgresSchedulesApi({ token });
		const target = { environmentId, serviceId, volumeInstanceId };
		const report = args.includes("--apply")
			? yield* Effect.tryPromise({
					catch: (cause) => new Error(String(cause)),
					try: () => applyPostgresSchedules(api, target, declaration),
				})
			: yield* Effect.tryPromise({
					catch: (cause) => new Error(String(cause)),
					try: () => checkPostgresSchedules(api, target, declaration),
				});
		yield* Effect.forEach(describe(report), (line) => Console.log(line));
		if (!report.clean) {
			yield* Effect.fail(new Error("Railway Postgres schedules did not all match the declaration"));
		}
	});
	return program.pipe(
		Effect.tapError((error) => Console.error(String(error))),
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
	);
}
