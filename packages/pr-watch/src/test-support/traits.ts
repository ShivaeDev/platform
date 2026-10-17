import { type Check, github, type PullChanges } from "./fixtures.ts";
import type { Reply } from "./server.ts";
import { watch } from "./watch.ts";
export function hasPull(number: number, changes: PullChanges = {}) {
	return watch.trait("github", `PR #${number} is ${JSON.stringify(changes)}`, (engine) => {
		engine.setPull(number, changes);
	});
}
export function watchesFleet() {
	return watch.trait("github", "the watcher follows all open PRs", (engine) => {
		engine.options.fleet = true;
		engine.options.numbers = [];
	});
}
export function watchesPulls(...numbers: number[]) {
	return watch.trait("github", `the watcher follows PRs ${numbers.join(", ")}`, (engine) => {
		engine.options.numbers = numbers;
	});
}
export function queuedPulls(...numbers: number[]) {
	return watch.trait("github", `the queue contains PRs ${numbers.join(", ")}`, (engine) => {
		github(engine, () => undefined).queueHas(...numbers);
	});
}
export function openPulls(...numbers: number[]) {
	return watch.trait("github", `open PRs are ${numbers.join(", ")}`, (engine) => {
		github(engine, () => undefined).openPulls(...numbers);
	});
}
export function checksAre(number: number, checks: readonly Check[]) {
	return watch.trait("github", `PR #${number} has checks ${JSON.stringify(checks)}`, (engine) => {
		github(engine, () => undefined).checksAre(number, checks);
	});
}
export function statusIs(number: number, state: string) {
	return watch.trait("github", `PR #${number} has commit status ${state}`, (engine) => {
		github(engine, () => undefined).statusIs(number, state);
	});
}
export function githubReplies(path: string, reply: Reply) {
	return watch.trait("github", `GitHub replies to ${path}: ${JSON.stringify(reply)}`, (engine) => {
		engine.set(path, reply);
	});
}
export function historyIs(text: string) {
	return watch.trait("history", `stored history is ${text}`, (engine) => engine.io.fs.writeFileString(engine.options.stateFile, text));
}
export function quotaRemaining(remaining: number) {
	return watch.trait("github", `GitHub has ${remaining} requests left`, (engine) => github(engine, () => undefined).quotaRemaining(remaining));
}
export function enterprise() {
	return watch.trait("github", "GitHub uses an Enterprise REST base", (engine) => {
		engine.options.apiUrl += "/api/v3";
	});
}
export function hasMergedPull(number: number) {
	return hasPull(number, { merged: true, state: "closed" });
}
export function incompleteObservation(failure: string) {
	return watch.trait("github", `the first ${failure} observation fails`, (engine) => {
		const fixture = github(engine, () => undefined);
		fixture.pullIs(1, { "auto_merge": null, ...(failure === "mergeability" ? { mergeable: null, "mergeable_state": "unknown" } : {}) });
		if (failure === "checks") {
			fixture.reply("/commits/sha1/status", { body: {}, status: 500 });
		}
		if (failure === "detail") {
			fixture.reply("/pulls/1", { body: {}, status: 500 });
		}
		if (failure === "queue") {
			fixture.reply("/git/matching-refs/heads/gh-readonly-queue/", { body: {}, status: 500 });
		}
	});
}
