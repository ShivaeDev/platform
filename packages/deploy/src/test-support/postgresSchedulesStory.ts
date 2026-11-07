import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import {
	type AutoUpdateWindow,
	applyPostgresSchedules,
	type BackupSchedule,
	checkPostgresSchedules,
	type PostgresBackupKind,
	type RailwayPostgresSchedulesApi,
} from "#adapters/railway/postgresSchedules.ts";

const windows: AutoUpdateWindow[] = Array.from({ length: 7 }, (_, day) => ({ day, endHour: 24, startHour: 0 }));
const kinds: PostgresBackupKind[] = ["DAILY", "WEEKLY", "MONTHLY"];

function schedules(): BackupSchedule[] {
	return kinds.map((kind) => ({
		createdAt: "2026-01-01T00:00:00Z",
		cron: "0 0 * * *",
		id: kind,
		kind,
		name: kind,
		retentionSeconds: 604_800,
	}));
}

export const postgresSchedules = storyKit({
	create: (): {
		autoUpdates: { schedule: readonly AutoUpdateWindow[]; type: string } | undefined;
		backupSchedules: BackupSchedule[];
		changes: string[];
	} => ({
		autoUpdates: { schedule: windows, type: "minor" },
		backupSchedules: schedules(),
		changes: [],
	}),
	name: "Railway Postgres schedules",
	stages: ["Railway schedule read-back"],
	verbs: (engine, story) => {
		const api: RailwayPostgresSchedulesApi = {
			readAutoUpdates: () => Promise.resolve(engine.autoUpdates),
			readBackupSchedules: () => Promise.resolve(engine.backupSchedules),
			updateAutoUpdateSchedule: (_environmentId, _serviceId, schedule) => {
				engine.changes.push("auto-update windows");
				engine.autoUpdates = { schedule: [...schedule], type: "minor" };
				return Promise.resolve();
			},
			updateBackupKinds: (_volumeInstanceId, kindsToSet) => {
				engine.changes.push(`backup kinds: ${kindsToSet.join(",")}`);
				const existing = new Map(engine.backupSchedules.map((schedule) => [schedule.kind, schedule]));
				engine.backupSchedules = schedules()
					.filter(({ kind }) => kindsToSet.includes(kind))
					.map((schedule) => existing.get(schedule.kind) ?? schedule);
				return Promise.resolve();
			},
		};
		const target = { environmentId: "environment-1", serviceId: "service-1", volumeInstanceId: "volume-instance-1" };
		const declaration = { autoUpdates: { schedule: windows, type: "minor" as const }, backupKinds: kinds };
		return {
			apply: () => {
				story.tell("apply the declared Railway schedules");
				return Effect.tryPromise({ catch: (error) => error, try: () => applyPostgresSchedules(api, target, declaration) });
			},
			changes: () => Effect.sync(() => [...engine.changes]),
			check: () => {
				story.tell("check the declared Railway schedules");
				return Effect.tryPromise({ catch: (error) => error, try: () => checkPostgresSchedules(api, target, declaration) });
			},
		};
	},
});

export const missingWeekly = postgresSchedules.trait("Railway schedule read-back", "Railway has no weekly backup schedule", ({ backupSchedules }) => {
	backupSchedules.splice(1, 1);
});
export const differentAutoUpdateWindow = postgresSchedules.trait(
	"Railway schedule read-back",
	"Railway has a different auto-update window",
	(engine) => {
		engine.autoUpdates = { schedule: [{ day: 0, endHour: 12, startHour: 0 }], type: "minor" };
	},
);
export const differentRetention = postgresSchedules.trait("Railway schedule read-back", "Railway reports a different backup retention", (engine) => {
	engine.backupSchedules = engine.backupSchedules.map((schedule) =>
		schedule.kind === "DAILY" ? { ...schedule, retentionSeconds: 86_400 } : schedule,
	);
});
export const missingAutoUpdateReadBack = postgresSchedules.trait(
	"Railway schedule read-back",
	"environment config has no service source autoUpdates read-back",
	(engine) => {
		engine.autoUpdates = undefined;
	},
);
