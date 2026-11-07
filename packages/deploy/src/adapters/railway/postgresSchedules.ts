export type PostgresBackupKind = "DAILY" | "WEEKLY" | "MONTHLY";

export interface AutoUpdateWindow {
	day: number;
	endHour: number;
	startHour: number;
}

export interface PostgresScheduleDeclaration {
	autoUpdates: {
		type: "minor";
		schedule: readonly AutoUpdateWindow[];
	};
	backupKinds: readonly PostgresBackupKind[];
}

export interface BackupSchedule {
	createdAt: string;
	cron: string;
	id: string;
	kind: PostgresBackupKind;
	name: string;
	retentionSeconds: number | null;
}

export interface RailwayPostgresSchedulesApi {
	readAutoUpdates: (environmentId: string, serviceId: string) => Promise<{ type: string; schedule: readonly AutoUpdateWindow[] } | undefined>;
	readBackupSchedules: (volumeInstanceId: string) => Promise<readonly BackupSchedule[]>;
	updateAutoUpdateSchedule: (environmentId: string, serviceId: string, schedule: readonly AutoUpdateWindow[]) => Promise<void>;
	updateBackupKinds: (volumeInstanceId: string, kinds: readonly PostgresBackupKind[]) => Promise<void>;
}

export interface PostgresScheduleTarget {
	environmentId: string;
	serviceId: string;
	volumeInstanceId: string;
}

export interface PostgresScheduleReport {
	autoUpdates: { status: "match" | "mismatch" | "unknown"; actual?: { type: string; schedule: readonly AutoUpdateWindow[] } };
	backupKinds: { missing: readonly PostgresBackupKind[]; schedules: readonly BackupSchedule[] };
	changes: readonly string[];
	clean: boolean;
}

function sameSchedule(actual: readonly AutoUpdateWindow[], expected: readonly AutoUpdateWindow[]) {
	function encode({ day, startHour, endHour }: AutoUpdateWindow) {
		return `${day}:${startHour}:${endHour}`;
	}
	return actual.map(encode).sort().join(",") === expected.map(encode).sort().join(",");
}

export async function checkPostgresSchedules(
	api: RailwayPostgresSchedulesApi,
	target: PostgresScheduleTarget,
	declaration: PostgresScheduleDeclaration,
): Promise<PostgresScheduleReport> {
	const [schedules, autoUpdates] = await Promise.all([
		api.readBackupSchedules(target.volumeInstanceId),
		api.readAutoUpdates(target.environmentId, target.serviceId),
	]);
	const actualKinds = new Set(schedules.map(({ kind }) => kind));
	const missing = declaration.backupKinds.filter((kind) => !actualKinds.has(kind));
	let status: PostgresScheduleReport["autoUpdates"]["status"] = "unknown";
	if (autoUpdates !== undefined) {
		status =
			autoUpdates.type === declaration.autoUpdates.type && sameSchedule(autoUpdates.schedule, declaration.autoUpdates.schedule)
				? "match"
				: "mismatch";
	}
	return {
		autoUpdates: { status, ...(autoUpdates && { actual: autoUpdates }) },
		backupKinds: { missing, schedules },
		changes: [],
		clean: missing.length === 0 && status === "match",
	};
}

export async function applyPostgresSchedules(
	api: RailwayPostgresSchedulesApi,
	target: PostgresScheduleTarget,
	declaration: PostgresScheduleDeclaration,
): Promise<PostgresScheduleReport> {
	const before = await checkPostgresSchedules(api, target, declaration);
	const changes: string[] = [];
	if (before.backupKinds.missing.length > 0) {
		await api.updateBackupKinds(target.volumeInstanceId, declaration.backupKinds);
		changes.push(`set backup kinds to ${declaration.backupKinds.join(", ")}`);
	}
	if (before.autoUpdates.status !== "match") {
		await api.updateAutoUpdateSchedule(target.environmentId, target.serviceId, declaration.autoUpdates.schedule);
		changes.push("set auto-update windows");
	}
	const after = await checkPostgresSchedules(api, target, declaration);
	return { ...after, changes };
}
