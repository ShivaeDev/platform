import type { FleetRecord } from "#model.ts";

function schedulingValue(record: FleetRecord) {
	const prediction = record.mergePrediction;
	return {
		...record,
		attempts: record.attempts.map((attempt) => ({ ...attempt, output: undefined, progress: undefined })),
		mergePrediction:
			prediction === undefined
				? undefined
				: { ...prediction, conflicts: prediction.conflicts.map((conflict) => ({ ...conflict, observedAt: undefined })), observedAt: undefined },
		releaseWindow: record.releaseWindow === undefined ? undefined : { ...record.releaseWindow, observedAt: undefined },
		updatedAt: undefined,
	};
}

export function schedulingChanged(record: FleetRecord, previous: FleetRecord): boolean {
	return JSON.stringify(schedulingValue(record)) !== JSON.stringify(schedulingValue(previous));
}
