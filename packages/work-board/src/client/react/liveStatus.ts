interface LiveState {
	readonly connection: string;
	readonly failed: boolean;
	readonly navigationFailed: boolean;
	readonly paused: boolean;
	readonly pending: number;
	readonly waiting: boolean;
	readonly watching: boolean;
}
export function liveStatus(value: LiveState) {
	const failure = failureText(value.failed, value.navigationFailed);
	const state = connectionState(value, failure);
	return {
		state,
		text:
			state === "paused" ? `updates paused · ${value.pending}${value.pending === 256 ? "+" : ""} pending updates` : failure || connectionText(state),
		title: `Connection: ${value.connection}; last observed source watcher: ${value.watching ? "watching" : "unavailable"}; ${readStatus(value, failure)}`,
	};
}
function failureText(failed: boolean, navigationFailed: boolean) {
	if (failed) {
		return "refresh failed";
	}
	if (navigationFailed) {
		return "navigation refresh failed";
	}
	return "";
}
function connectionState(value: LiveState, failure: string) {
	if (value.paused) {
		return "paused";
	}
	if (failure) {
		return "stale";
	}
	if (!value.watching || value.connection !== "live") {
		return "down";
	}
	return value.waiting ? "refreshing" : "live";
}
function connectionText(state: string) {
	return state === "down" ? "reconnecting" : state;
}
function readStatus(value: LiveState, failure: string) {
	if (value.paused) {
		return "automatic reads paused";
	}
	if (value.waiting) {
		return "reads pending";
	}
	return failure ? "showing retained source" : "reads settled";
}
