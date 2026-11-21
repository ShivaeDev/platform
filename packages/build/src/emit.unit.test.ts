import { expect, it } from "vitest";
import { code, type ImportRef, SCHEMA } from "#code.ts";
import { emit, type PlannedModule } from "#emit.ts";

function imported(name: string, specifier: string): ImportRef {
	return { name, preferred: name, specifier, typeOnly: false };
}

const SELF_SUBJECT = imported("selfSubject", "@shivaedev/identity/subject.ts");

const planned: PlannedModule = {
	exportName: "Notes",
	keyScope: code('"session"'),
	middleware: undefined,
	module: { ...imported("Notes", "#modules/notes/notes.ts"), typeOnly: true },
	name: "notes",
	operations: [
		{ kind: "command", name: "create", payload: undefined, rejections: [], success: code(SCHEMA, ".Void") },
		{ kind: "query", name: "list", payload: undefined, rejections: [], success: code(SCHEMA, ".Void") },
		{ kind: "query", name: "get", payload: undefined, rejections: [], success: code(SCHEMA, ".Void") },
	],
	source: "src/modules/notes/notes.ts",
	subject: code(SELF_SUBJECT),
};

it("writes a module's subject and key scope into the browser's contract as written, and lists its queries and commands by name", () => {
	const text = emit(planned);

	expect(text.split("\n").filter((line) => /keyScope|subject|queries|commands|selfSubject"/u.test(line))).toEqual([
		'import { selfSubject } from "@shivaedev/identity/subject.ts";',
		'\tcommands: ["create"],',
		'\tkeyScope: "session",',
		'\tqueries: ["list", "get"],',
		"\tsubject: selfSubject,",
	]);
});
