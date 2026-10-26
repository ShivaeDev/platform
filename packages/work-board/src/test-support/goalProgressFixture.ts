import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";

function source(id: string, kind: string, fields: string) {
	return `---\nid: ${id}\nkind: ${kind}\n${fields}\n---\n# ${id}\n`;
}
function task(id: string, fields: string, goal = "goal.progress") {
	return source(id, "task", `${fields}\nrelationships: [{kind: implements, target: ${goal}}]`);
}
export function goalProgressFixture() {
	return {
		"answer-failed.md": task("task.answer-failed", "status: ready\nfleet: approved"),
		"approved-draft.md": task("task.approved-draft", "status: draft\nfleet: approved"),
		"asked.md": task("task.asked", "status: ready\nfleet: approved", "goal.nested"),
		"child.md": source("goal.child", "goal", "relationships: [{kind: implements, target: goal.progress}]"),
		"deferred.md": task("task.deferred", "status: deferred\nfleet: approved"),
		"dispatch-failed.md": task("task.dispatch-failed", "status: ready\nfleet: approved"),
		"done.md": task("task.done", "status: done"),
		"draft.md": task("task.draft", "status: draft"),
		"dropped.md": task("task.dropped", "status: dropped", "goal.child"),
		"goal.md": source("goal.progress", "goal", "status: ready"),
		"held.md": task("task.held", "status: ready\nfleet: held"),
		"manual.md": task("task.manual", "status: ready\nfleet: manual"),
		"nested.md": source("goal.nested", "goal", "relationships: [{kind: implements, target: goal.child}]"),
		"question.md": source(
			"question.progress",
			"question",
			"scope: task\nurgency: blocking\nattention: [{id: decide, kind: decision, state: open, response_from: [maintainer], reason: Choose an approach, unblocks: [task.asked]}]",
		),
		"queue.md": task("task.queue", "status: ready\nfleet: approved"),
		"ready.md": task("task.ready", "status: ready"),
		"review.md": task("task.review", "status: ready\nfleet: approved", "goal.child"),
		"standing-task.md": task("task.standing-done", "status: done", "goal.standing"),
		"standing.md": source("goal.standing", "goal", "status: done\nstanding: true"),
		"waiting.md": task("task.waiting", "status: ready\nfleet: approved", "goal.child"),
		"working.md": task("task.working", "status: ready\nfleet: approved"),
	};
}

export function progressFleet(): Extract<FleetItemsProjection, { state: "ready" }> {
	const stages = [
		["task.working", "working", undefined],
		["task.review", "reviewing", undefined],
		["task.queue", "queued", undefined],
		["task.waiting", "waiting", "Stuck"],
		["task.dispatch-failed", "waiting", "Dispatch failed"],
		["task.answer-failed", "waiting", "Answer failed"],
		["task.dropped", "working", undefined],
	] as const;
	return {
		completed: [],
		items: stages.map(([workId, stage, waitingReason]) => ({ document: null, stage, stageEnteredAt: 0, updatedAt: 0, waitingReason, workId })),
		state: "ready",
	};
}

export function largeGoalFixture() {
	const files: Record<string, string> = { "goal.md": source("goal.large", "goal", "status: ready") };
	for (const [status, count] of [
		["done", 485],
		["dropped", 54],
		["draft", 18],
	] as const) {
		for (let index = 0; index < count; index += 1) {
			files[`${status}-${index}.md`] = task(`task.${status}-${index}`, `status: ${status}`, "goal.large");
		}
	}
	return files;
}
