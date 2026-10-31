import { Effect } from "effect";
import { postgresFleetRepository } from "#engine/repository.ts";
import { fleetItems } from "#host/fleetItems.ts";
import type { mergeQueueApi } from "#test/mergeQueueApi.ts";
import { RELEASE_HEAD } from "#test/releaseWindowApi.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export function releaseWindowVerbs(state: { queueApi: Effect.Success<typeof mergeQueueApi> | undefined }, tell: (line: string) => void) {
	function api() {
		if (state.queueApi === undefined) {
			throw new Error("Automatic merges are not configured");
		}
		return state.queueApi;
	}
	return {
		boardFleetItems: () => Effect.flatten(fleetItems).pipe(Effect.provide(postgresFleetRepository(STORAGE_NAMESPACE))),
		closeReleasePr: (outcome: "closed" | "merged") => {
			api().closeRelease(outcome);
			tell(`The release PR is ${outcome}`);
		},
		fileStatus: (path: string, status: string) => {
			api().fileStatus(path, status);
			tell(`GitHub reports ${path} as ${status}`);
		},
		openReleasePr: (options?: Parameters<ReturnType<typeof api>["openRelease"]>[0]) => {
			api().openRelease(options);
			tell("A release PR opens");
		},
		releaseCheck: (conclusion: string | null) => {
			api().mergeGroupCheck(RELEASE_HEAD, { conclusion, name: "verify", url: "https://github.com/example/project/actions/runs/99" });
			tell(`The release PR's required check is ${conclusion ?? "pending"}`);
		},
	};
}
