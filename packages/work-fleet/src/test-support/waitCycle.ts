import { storedWork } from "#test/hostStory.ts";

export function waitCycle(kind: "area" | "merge") {
	const first = "https://example.invalid/pr/one";
	const second = "https://example.invalid/pr/two";
	return [
		storedWork("one", "repairing", {
			attentionOwner: "automation",
			...(kind === "area"
				? { blocker: "waiting for area work-fleet held by two" }
				: { blocker: `waiting for ${second} to merge`, predictedConflictHold: { head: "one", prs: [second] } }),
			result: { head: "one", kind: "change", paths: [], pr: first },
			stage: "waiting",
		}),
		storedWork("two", "reviewing", {
			attentionOwner: "automation",
			blocker: `waiting for ${first} to merge`,
			predictedConflictHold: { head: "two", prs: [first] },
			result: { head: "two", kind: "change", paths: [], pr: second },
			stage: "waiting",
		}),
		storedWork("three", "reviewing", {
			attentionOwner: "automation",
			blocker: `waiting for ${first} to merge`,
			predictedConflictHold: { head: "three", prs: [first] },
			stage: "waiting",
		}),
		storedWork("ordinary", "queued", {
			attentionOwner: "automation",
			blocker: "waiting for area work-board held by outside",
			stage: "waiting",
		}),
	];
}
