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
			counts: { done: 2, "in progress": 0, "needs you": 0, planned: 3 },
			criteria: [
				{ counts: { done: 1, "in progress": 0, "needs you": 0, planned: 1 }, evidence: 2, linked: 2 },
				{ counts: { done: 0, "in progress": 0, "needs you": 0, planned: 1 }, evidence: 1, linked: 1 },
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
		expect(result.items).toHaveLength(5);
		editFile("fifth.md", goalsFixture()["fifth.md"]?.replace("kind: task", "kind: task\nstatus: In Review") ?? "");
		yield* Effect.promise(() =>
			waitFor(() => {
				const updated = client.registry.get(atom);
				expect(updated._tag === "Success" && updated.value.goals.find((goal) => goal.id === "project.example")?.counts).toEqual({
					done: 2,
					"in progress": 1,
					"needs you": 0,
					planned: 2,
				});
			}),
		);
		editFile("goal.md", goalsFixture()["goal.md"]?.replace("status: planned", "status: completed") ?? "");
		yield* Effect.promise(() =>
			waitFor(() => {
				const updated = client.registry.get(atom);
				expect(updated._tag === "Success" && updated.value.goals.map((goal) => goal.id)).toEqual([]);
				expect(updated._tag === "Success" && updated.value.closedGoals.find((goal) => goal.id === "project.example")?.counts).toEqual({
					done: 2,
					"in progress": 1,
					"needs you": 0,
					planned: 2,
				});
			}),
		);
		const navigation = yield* Effect.promise(() => client.read(client.api.navigation.query({ current: "/goal.md" })));
		expect(navigation.counts.goals).toBe(0);
		release();
	},
);
