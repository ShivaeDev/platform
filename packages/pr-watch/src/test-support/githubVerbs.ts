import { Effect } from "effect";
import type { Engine } from "./engine.ts";
import { type Answer, type Change, github, type Read } from "./github.ts";
import type { Check } from "./server.ts";

export function githubVerbs(engine: Engine, tell: (line: string) => void) {
	function act(change: Change) {
		return Effect.sync(() => {
			tell(change.line);
			change.apply(engine.github);
		});
	}
	return {
		answers: (read: Read, answer: Answer) => act(github.answers(read, answer)),
		budgetIs: (resource: string, remaining: number, limit: number, resetAt: number) => act(github.budget(resource, remaining, limit, resetAt)),
		checkConcludes: (number: number, check: Check) => act(github.checkConcludes(number, check)),
		checksPageLinksElsewhere: (number: number) => act(github.checksPageLinksElsewhere(number)),
		closes: (number: number) => act(github.closes(number)),
		conflicts: (number: number) => act(github.conflicts(number)),
		disablesAutoMerge: (number: number) => act(github.disablesAutoMerge(number)),
		enablesAutoMerge: (number: number) => act(github.enablesAutoMerge(number)),
		entersQueue: (number: number) => act(github.entersQueue(number)),
		failingCheckOnSecondPage: (number: number) => act(github.failingCheckOnSecondPage(number)),
		leavesOpenList: (number: number) => act(github.leavesOpenList(number)),
		leavesQueue: (number: number, reason?: string) => act(github.leavesQueue(number, reason)),
		listedOnSecondPage: (number: number) => act(github.listedOnSecondPage(number)),
		mergeabilityPending: (number: number) => act(github.mergeabilityPending(number)),
		merges: (number: number) => act(github.merges(number)),
		mergesStillListed: (number: number) => act(github.mergesStillListed(number)),
		opens: (number: number) => act(github.opens(number)),
		pushesHead: (number: number, branch: string, sha: string, title: string) => act(github.pushesHead(number, branch, sha, title)),
		queueRefOnSecondPage: (number: number) => act(github.queueRefOnSecondPage(number)),
		queueRefVanishes: (number: number, remaining: "queue entry" | "auto-merge request") => act(github.queueRefVanishes(number, remaining)),
		recovers: (read: Read) => act(github.recovers(read)),
		secondChecksPage: (number: number, answer: Answer) => act(github.secondChecksPage(number, answer)),
		statusBecomes: (number: number, state: string) => act(github.statusBecomes(number, state)),
	};
}
