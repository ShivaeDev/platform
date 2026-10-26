import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { waitFor } from "#test/live.ts";

boardStory.it(
	"counts linked work, criterion claims and eligible Inbox asks through the typed goals query",
	[projectFiles(goalsFixture()), deferredServing],
	function* ({ start, editFile, connectClient }) {
		yield* start({ fleetPort: null });
		const client = connectClient();
		const atom = client.api.goals.query();
		const release = client.registry.mount(atom);
		const result = yield* Effect.promise(() => client.read(atom));
		expect(result.goals.find((goal) => goal.id === "project.example")).toMatchObject({
			asks: [
				{ href: "/_board/item/decision.review/#answer-card-goal", reason: "Review goal" },
				{ href: "/_board/item/decision.review/#answer-card-task", reason: "Review task", title: "Fifth task" },
			],
			counts: { blocked: 1, done: 2, parked: 2, running: 0, scheduled: 0 },
			criteria: [
				{ counts: { blocked: 0, done: 1, parked: 1, running: 0, scheduled: 0 }, evidence: 2, linked: 2 },
				{ counts: { blocked: 0, done: 0, parked: 1, running: 0, scheduled: 0 }, evidence: 1, linked: 1 },
			],
			linked: 5,
			openAsks: 2,
		});
		expect(result.goals.map((goal) => goal.id)).toEqual(["project.example"]);
		expect(result.deferredGoals.find((goal) => goal.id === "project.empty")).toMatchObject({
			linked: 0,
			unlinked: true,
		});
		expect(result.closedGoals.map((goal) => goal.id)).toEqual(["project.closed"]);
		expect(result.items.map((item) => item.id).sort()).toEqual(["task.fifth", "task.first", "task.fourth", "task.second", "task.third"]);
		expect(result.items.every((item) => typeof item.modified === "number")).toBe(true);
		editFile("second.md", goalsFixture()["second.md"]?.replace("status: draft", "status: ready\nfleet: approved") ?? "");
		yield* Effect.promise(() =>
			waitFor(() => {
				const updated = client.registry.get(atom);
				expect(updated._tag === "Success" && updated.value.goals.find((goal) => goal.id === "project.example")?.counts).toEqual({
					blocked: 1,
					done: 2,
					parked: 1,
					running: 0,
					scheduled: 1,
				});
			}),
		);
		editFile("goal.md", goalsFixture()["goal.md"]?.replace("status: draft", "status: done") ?? "");
		yield* Effect.promise(() =>
			waitFor(() => {
				const updated = client.registry.get(atom);
				expect(updated._tag === "Success" && updated.value.goals.map((goal) => goal.id)).toEqual([]);
				expect(updated._tag === "Success" && updated.value.closedGoals.find((goal) => goal.id === "project.example")?.counts).toEqual({
					blocked: 1,
					done: 2,
					parked: 1,
					running: 0,
					scheduled: 1,
				});
			}),
		);
		const navigation = yield* Effect.promise(() => client.read(client.api.navigation.query({ current: "/goal.md" })));
		expect(navigation.counts.goals).toBe(0);
		release();
	},
);
