import { Schema } from "effect";
import type { AutoUpdateWindow, RailwayPostgresSchedulesApi } from "#adapters/railway/postgresSchedules.ts";

const AutoUpdateWindowSchema = Schema.Struct({ day: Schema.Number, endHour: Schema.Number, startHour: Schema.Number });
const AutoUpdatesSchema = Schema.Struct({ schedule: Schema.Array(AutoUpdateWindowSchema), type: Schema.String });
const BackupScheduleSchema = Schema.Struct({
	createdAt: Schema.String,
	cron: Schema.String,
	id: Schema.String,
	kind: Schema.Literals(["DAILY", "WEEKLY", "MONTHLY"]),
	name: Schema.String,
	retentionSeconds: Schema.NullOr(Schema.Number),
});
const EnvironmentConfigSchema = Schema.Struct({
	services: Schema.optionalKey(
		Schema.Record(
			Schema.String,
			Schema.Struct({ source: Schema.optionalKey(Schema.Struct({ autoUpdates: Schema.optionalKey(AutoUpdatesSchema) })) }),
		),
	),
});
const EnvelopeSchema = Schema.Struct({
	data: Schema.optionalKey(Schema.Unknown),
	errors: Schema.optionalKey(Schema.Array(Schema.Struct({ message: Schema.String }))),
});
const decodeBackupSchedules = Schema.decodeUnknownSync(Schema.Struct({ volumeInstanceBackupScheduleList: Schema.Array(BackupScheduleSchema) }));
const decodeEnvironment = Schema.decodeUnknownSync(Schema.Struct({ environment: Schema.Struct({ config: Schema.Unknown }) }));
const decodeEnvironmentConfig = Schema.decodeUnknownSync(EnvironmentConfigSchema);
const decodeEnvelope = Schema.decodeUnknownSync(EnvelopeSchema);

export interface RailwayPostgresSchedulesOptions {
	endpoint?: string;
	fetch?: typeof globalThis.fetch;
	token: string;
}

export function postgresSchedulesApi({
	token,
	endpoint = "https://backboard.railway.com/graphql/v2",
	fetch = globalThis.fetch,
}: RailwayPostgresSchedulesOptions): RailwayPostgresSchedulesApi {
	async function request(query: string, variables: Record<string, unknown>): Promise<unknown> {
		const response = await fetch(endpoint, {
			body: JSON.stringify({ query, variables }),
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			method: "POST",
		});
		const body = decodeEnvelope(await response.json());
		if (!response.ok || body.errors?.length || body.data === undefined) {
			throw new Error(body.errors?.map(({ message }) => message).join("; ") || `Railway GraphQL returned HTTP ${response.status}`);
		}
		return body.data;
	}

	return {
		async readAutoUpdates(environmentId, serviceId) {
			const result = decodeEnvironment(
				await request("query EnvironmentConfig($id: String!) { environment(id: $id) { config } }", { id: environmentId }),
			);
			const rawConfig = result.environment.config;
			const config = decodeEnvironmentConfig(typeof rawConfig === "string" ? JSON.parse(rawConfig) : rawConfig);
			return config.services?.[serviceId]?.source?.autoUpdates;
		},
		async readBackupSchedules(volumeInstanceId) {
			const data = decodeBackupSchedules(
				await request(
					"query BackupSchedules($volumeInstanceId: String!) { volumeInstanceBackupScheduleList(volumeInstanceId: $volumeInstanceId) { id kind cron retentionSeconds name createdAt } }",
					{ volumeInstanceId },
				),
			);
			return data.volumeInstanceBackupScheduleList;
		},
		async updateAutoUpdateSchedule(environmentId, serviceId, schedule: readonly AutoUpdateWindow[]) {
			await request(
				"mutation UpdateAutoUpdateSchedule($environmentId: String!, $serviceId: String!, $schedule: [AutoUpdateScheduleWindowInput!]!) { serviceInstanceAutoUpdateScheduleUpdate(environmentId: $environmentId, serviceId: $serviceId, schedule: $schedule) }",
				{ environmentId, schedule, serviceId },
			);
		},
		async updateBackupKinds(volumeInstanceId, kinds) {
			await request(
				"mutation UpdateBackupKinds($volumeInstanceId: String!, $kinds: [VolumeInstanceBackupScheduleKind!]!) { volumeInstanceBackupScheduleUpdate(volumeInstanceId: $volumeInstanceId, kinds: $kinds) }",
				{ kinds, volumeInstanceId },
			);
		},
	};
}
