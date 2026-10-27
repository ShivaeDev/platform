import { expect } from "vitest";
import { boardReadStory } from "#test/boardReadStory.ts";
import { dependencySource } from "#test/dependencyBoard.ts";

for (const [field, source] of [
	["status", dependencySource.replace("status: draft", "status: done")],
	["next_action", dependencySource.replace("Implement the work.", "Work completed.")],
	["owner", dependencySource.replace("kind: task", "kind: task\nowner: marvin")],
	["areas", dependencySource.replace("kind: task", "kind: task\nareas: ['*']")],
	["approval", dependencySource.replace("fleet: approved", "fleet: held")],
	["launch settings", dependencySource.replace("fleet: approved", "fleet: approved\nfleet-launch: { model: another-model }")],
] as const) {
	boardReadStory.it(`${field} is independent of the authored brief revision`, [], function* ({ board, fixture }) {
		yield* fixture.write("one.md", dependencySource);
		const original = yield* board.get("one");
		yield* fixture.write("one.md", source);
		expect((yield* board.get("one")).revision).toBe(original.revision);
	});
}

for (const [field, source] of [
	["title", dependencySource.replace("# Target", "# Changed target")],
	["criteria", dependencySource.replace("The behavior works.", "The changed behavior works.")],
	["body", dependencySource.replace("Implement the behavior.", "Implement different behavior.")],
	["kind", dependencySource.replace("kind: task", "kind: report")],
	["deliverable", dependencySource.replace("fleet: approved", "fleet: approved\ndelivers: report")],
	["relationships", dependencySource.replace("kind: task", "kind: task\nrelationships: [{ kind: depends_on, target: before }]")],
] as const) {
	boardReadStory.it(`${field} changes the authored brief revision`, [], function* ({ board, fixture }) {
		yield* fixture.write("one.md", dependencySource);
		const original = yield* board.get("one");
		yield* fixture.write("one.md", source);
		expect((yield* board.get("one")).revision).not.toBe(original.revision);
	});
}

boardReadStory.it("frontmatter formatting and key order preserve the parsed brief", [], function* ({ board, fixture }) {
	yield* fixture.write("one.md", dependencySource);
	const original = yield* board.get("one");
	const source = dependencySource
		.replace("kind: task\nstatus: draft", "status: draft\nkind: 'task'")
		.replace("id: behavior\n    text: The behavior works.", "text: 'The behavior works.'\n    id: behavior");
	yield* fixture.write("one.md", source);
	expect((yield* board.get("one")).revision).toBe(original.revision);
});

boardReadStory.it("bookkeeping aliases still change identity when they change authored criteria", [], function* ({ board, fixture }) {
	const source = dependencySource.replace("next_action: ", "next_action: &action ").replace("text: The behavior works.", "text: *action");
	yield* fixture.write("one.md", source);
	const original = yield* board.get("one");
	yield* fixture.write("one.md", source.replace("status: draft", "status: done"));
	expect((yield* board.get("one")).revision).toBe(original.revision);
	yield* fixture.write("one.md", source.replace("Implement the work.", "Work completed."));
	expect((yield* board.get("one")).revision).not.toBe(original.revision);
});
