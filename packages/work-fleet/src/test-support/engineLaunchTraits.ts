import type { LaunchSettings } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export function availableQuota(quota: number) {
	return engineConfiguration(`the provider permits ${quota} submissions`, () => ({ quota }));
}

export function backlogLimit(backlog: number) {
	return engineConfiguration(`the open PR backlog holds ${backlog} items`, () => ({ backlog }));
}

export function changedMainPaths(mainChanges: readonly string[]) {
	return engineConfiguration("main changes the prepared source paths", () => ({ mainChanges }));
}

export function unknownProviderQuota() {
	return engineConfiguration("provider quota is unknown", () => ({ unknownQuota: true }));
}

export function launchDefaults(launch: LaunchSettings) {
	return engineConfiguration("the host supplies default launch settings", () => ({ launch }));
}

export function workerTurnUnavailable() {
	return engineConfiguration("the provider loses turn submission after acknowledging its session", () => ({ unavailableTurn: true }));
}

export function workerAcknowledgementLost(lostAcknowledgement = true) {
	return engineConfiguration(`worker acceptance acknowledgement is ${lostAcknowledgement ? "lost" : "received"}`, () => ({ lostAcknowledgement }));
}

export function workerResultUnavailable() {
	return engineConfiguration("the worker's result ownership cannot be observed", () => ({ resultUnavailable: true }));
}

export function decisionPublicationFailsOnce() {
	return engineConfiguration("the first Board decision publication fails", () => ({ publishFailure: true }));
}

export function rejectedWorkerWithoutResult() {
	return engineConfiguration("the provider rejects the worker turn and cannot observe a result", () => ({
		rejectTurn: true,
		resultUnavailable: true,
	}));
}
