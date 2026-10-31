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
	boardReadStory.it(`${field} is independent of the authored brief revision`, [], function* ({ read, writeSource }) {
		yield* writeSource("one.md", dependencySource);
		const original = yield* read("one");

		yield* writeSource("one.md", source);

		expect((yield* read("one")).revision).toBe(original.revision);
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
	boardReadStory.it(`${field} changes the authored brief revision`, [], function* ({ read, writeSource }) {
		yield* writeSource("one.md", dependencySource);
		const original = yield* read("one");

		yield* writeSource("one.md", source);

		expect((yield* read("one")).revision).not.toBe(original.revision);
	});
}

boardReadStory.it("frontmatter formatting and key order keep the brief revision", [], function* ({ read, writeSource }) {
	yield* writeSource("one.md", dependencySource);
	const original = yield* read("one");
	const source = dependencySource
		.replace("kind: task\nstatus: draft", "status: draft\nkind: 'task'")
		.replace("id: behavior\n    text: The behavior works.", "text: 'The behavior works.'\n    id: behavior");

	yield* writeSource("one.md", source);

	expect((yield* read("one")).revision).toBe(original.revision);
});

for (const [edit, from, to, same] of [
	["a bookkeeping edit", "status: draft", "status: done", true],
	["an edit to the aliased next action", "Implement the work.", "Work completed.", false],
] as const) {
	boardReadStory.it(
		`with a criterion aliasing the next action, ${edit} ${same ? "keeps" : "changes"} the brief revision`,
		[],
		function* ({ read, writeSource }) {
			const source = dependencySource.replace("next_action: ", "next_action: &action ").replace("text: The behavior works.", "text: *action");
			yield* writeSource("one.md", source);
			const original = yield* read("one");

			yield* writeSource("one.md", source.replace(from, to));

			expect((yield* read("one")).revision === original.revision).toBe(same);
		},
	);
}
