import { Effect } from "effect";
import type { EventKind } from "#events.ts";
import type { Engine } from "./engine.ts";
import { type Answer, type Change, github, type Read } from "./github.ts";
import type { Check } from "./server.ts";
import { watch } from "./watch.ts";
import { pollOnce } from "./watcherVerbs.ts";

function given(change: Change) {
	return watch.trait("github", change.line, (engine) => {
		change.apply(engine.github);
	});
}

function pr(number: number, description: string, change: Change) {
	return watch.trait("github", `PR ${number} ${description}`, (engine) => {
		change.apply(engine.github);
	});
}

function prs(numbers: readonly number[]) {
	return numbers.length === 1 ? `PR ${numbers[0]}` : `PRs ${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`;
}

export function openPr(...numbers: number[]) {
	return watch.trait(
		"github",
		`${prs(numbers)} ${numbers.length === 1 ? "is" : "are"} open with auto-merge on, no conflict and passing checks`,
		(engine) => {
			for (const number of numbers) {
				github.opens(number).apply(engine.github);
			}
		},
	);
}

export function autoMergeOff(number: number) {
	return pr(number, "has auto-merge off", github.disablesAutoMerge(number));
}
export function conflicted(number: number) {
	return pr(number, "has a merge conflict", github.conflicts(number));
}
export function inQueue(number: number) {
	return pr(number, "is in the merge queue, which cleared its auto-merge request", github.entersQueue(number));
}
export function mergeabilityPending(number: number) {
	return given(github.mergeabilityPending(number));
}
export function mergedStillListed(number: number) {
	return given(github.mergesStillListed(number));
}
export function merged(number: number) {
	return pr(number, "has merged", github.merges(number));
}
export function failingStatus(number: number, state = "failure") {
	return pr(number, `has a ${state} commit status`, github.statusBecomes(number, state));
}
export function failingCheck(number: number, check: Check) {
	return given(github.checkConcludes(number, check));
}
export function githubAnswers(read: Read, answer: Answer) {
	return given(github.answers(read, answer));
}
export function budget(resource: string, remaining: number, limit: number, resetAt: number) {
	return given(github.budget(resource, remaining, limit, resetAt));
}

export function watching(...numbers: number[]) {
	return watch.trait("settings", `the watcher follows ${prs(numbers)}`, (engine) => {
		engine.options.numbers = numbers;
	});
}

export const watchingFleet = watch.trait("settings", "the watcher follows every open PR", (engine) => {
	engine.options.fleet = true;
});

export function printingOnly(...kinds: EventKind[]) {
	return watch.trait("settings", `the watcher prints only ${kinds.join(" and ")} transitions`, (engine) => {
		engine.options.events = kinds;
	});
}

export function heartbeatEvery(seconds: number) {
	return watch.trait("settings", seconds === 0 ? "heartbeats are off" : `the watcher prints a heartbeat after ${seconds} quiet seconds`, (engine) => {
		engine.settings.heartbeat = seconds;
	});
}

export const heartbeatsOff = heartbeatEvery(0);

export const enterpriseBase = watch.trait("settings", "the watcher reads GitHub through an Enterprise /api/v3 REST base", (engine) => {
	engine.options.apiUrl += "/api/v3";
});

function quietPoll(engine: Engine) {
	return pollOnce(engine).pipe(
		Effect.flatMap((outcome) =>
			outcome === "polled" && engine.lines.length === 0
				? Effect.void
				: Effect.die(new Error(`The setup poll ${outcome} and printed ${JSON.stringify(engine.lines)}`)),
		),
	);
}

export const baselineSaved = watch.trait("history", "the watcher has polled once and saved its baseline without printing anything", quietPoll);

export const polledOnce = watch.trait("history", "the watcher has polled once without printing anything", quietPoll);

export function sawChecksFailAndRecover(number: number) {
	return watch.trait("history", `the watcher saw PR ${number}'s check run fail and then succeed`, (engine) =>
		Effect.gen(function* () {
			github.checkConcludes(number, { conclusion: "failure", status: "completed" }).apply(engine.github);
			yield* pollOnce(engine);
			github.checkConcludes(number, { conclusion: "success", status: "completed" }).apply(engine.github);
			yield* pollOnce(engine);
		}),
	);
}

export function stateFileHolds(text: string) {
	return watch.trait("history", `the state file holds ${text}`, (engine) => engine.io.fs.writeFileString(engine.options.stateFile, text));
}
