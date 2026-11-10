import { expect, it } from "vitest";
import { code, type ImportRef, SCHEMA } from "#code.ts";
import { emit, type PlannedModule } from "#emit.ts";

function imported(name: string, specifier: string): ImportRef {
	return { name, preferred: name, specifier, typeOnly: false };
}

const SELF_SUBJECT = imported("selfSubject", "@shivaedev/identity/subject.ts");
const NOTES = imported("notes", "#modules/notes/model.ts");

const planned: PlannedModule = {
	exportName: "Notes",
	keyScope: code('"session"'),
	middleware: undefined,
	module: { ...imported("Notes", "#modules/notes/notes.ts"), typeOnly: true },
	name: "notes",
	operations: [
		{
			kind: "query",
			members: [code("reads: () => [", NOTES, ".list]"), code("readsCollections: [", NOTES, "]")],
			name: "list",
			payload: undefined,
			rejections: [],
			success: code(SCHEMA, ".Void"),
		},
	],
	source: "src/modules/notes/notes.ts",
	subject: code(SELF_SUBJECT),
};

it("writes a module's subject, key scope and a query's readsCollections into the browser's contract as written", () => {
	const text = emit(planned);

	expect(text.split("\n").filter((line) => /keyScope|subject|readsCollections|selfSubject"/u.test(line))).toEqual([
		'import { selfSubject } from "@shivaedev/identity/subject.ts";',
		'\tkeyScope: "session",',
		"\t\tlist: { reads: () => [notes.list], readsCollections: [notes] },",
		"\tsubject: selfSubject,",
	]);
});
