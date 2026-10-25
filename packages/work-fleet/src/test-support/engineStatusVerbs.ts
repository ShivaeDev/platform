import { Effect } from "effect";
import { views } from "#engine/views.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { type RecoverySnapshots, watchRecovery } from "#test/watchRecovery.ts";

export function engineStatusVerbs(state: EngineStory, tell: (line: string) => void) {
	return {
		status: () =>
			Effect.suspend(() => running(state).fleet.list()).pipe(Effect.map((records) => renderStatus(views(records.map(({ value }) => value))))),
		storedSnapshot: () => readWaitStates({ namespace: STORAGE_NAMESPACE }),
		watch: (follow: boolean, expected: string, recorded?: RecoverySnapshots) => {
			tell(`run watch${follow ? " --follow" : ""} against the persisted Fleet snapshots over HTTP`);
			return watchRecovery(follow, expected, recorded);
		},
	};
}
