import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";

export function originalWork(record: FleetRecord): BoardWork | undefined {
	if (record.boardContext === undefined || record.boardSourcePath === undefined) {
		return undefined;
	}
	return { context: record.boardContext, dependsOn: [], revision: record.boardRevision, sourcePath: record.boardSourcePath, workId: record.workId };
}
