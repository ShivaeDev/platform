import { expect, it } from "vitest";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { dependencySource } from "#test/dependencyBoard.ts";

function revision(source: string) {
	return briefRevision(metadataParse(source));
}

for (const [field, source] of [
	["status", dependencySource.replace("status: planned", "status: done")],
	["next_action", dependencySource.replace("Implement the work.", "Work completed.")],
	["owner", dependencySource.replace("kind: task", "kind: task\nowner: another-owner")],
	["areas", dependencySource.replace("kind: task", "kind: task\nareas: [another-area]")],
	["approval", dependencySource.replace("fleet: approved", "fleet: pending")],
	["launch settings", dependencySource.replace("fleet: approved", "fleet: approved\nfleet-launch: { model: another-model }")],
] as const) {
	it(`${field} is independent of the authored brief revision`, () => {
		expect(revision(source)).toBe(revision(dependencySource));
	});
}

for (const [field, source] of [
	["title", dependencySource.replace("# Target", "# Changed target")],
	["criteria", dependencySource.replace("The behavior works.", "The changed behavior works.")],
	["body", dependencySource.replace("Implement the behavior.", "Implement different behavior.")],
	["kind", dependencySource.replace("kind: task", "kind: investigation")],
	["deliverable", dependencySource.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report")],
	["relationships", dependencySource.replace("kind: task", "kind: task\nrelationships: [{ kind: depends_on, target: before }]")],
] as const) {
	it(`${field} changes the authored brief revision`, () => {
		expect(revision(source)).not.toBe(revision(dependencySource));
	});
}

it("frontmatter formatting and key order preserve the parsed brief", () => {
	const source = dependencySource
		.replace("kind: task\nstatus: planned", "status: planned\nkind: 'task'")
		.replace("id: behavior\n    text: The behavior works.", "text: 'The behavior works.'\n    id: behavior");
	expect(revision(source)).toBe(revision(dependencySource));
});

it("bookkeeping aliases still change identity when they change authored criteria", () => {
	const source = dependencySource.replace("next_action: ", "next_action: &action ").replace("text: The behavior works.", "text: *action");
	expect(revision(source.replace("status: planned", "status: done"))).toBe(revision(source));
	expect(revision(source.replace("Implement the work.", "Work completed."))).not.toBe(revision(source));
});
