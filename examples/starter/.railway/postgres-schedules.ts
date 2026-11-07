export const postgresSchedules = {
	autoUpdates: {
		schedule: Array.from({ length: 7 }, (_, day) => ({ day, endHour: 24, startHour: 0 })),
		type: "minor",
	},
	backupKinds: ["DAILY", "WEEKLY", "MONTHLY"],
} as const;
