import { Effect, FileSystem, Path } from "effect";
import { clientModulesOf, registrationsOf } from "#adapters/typeScript.ts";
import { byText } from "#byText.ts";
import { emitList } from "#emitList.ts";
import type { Project } from "#inputs.ts";
import { sourceFiles } from "#project.ts";
import type { RegistrationParts } from "#registrationParts.ts";
import { type FileRegistrations, mayRegister } from "#registrations.ts";
import type { ListOutcome } from "#report.ts";
import { settle } from "#settle.ts";
import { specifierFor } from "#specifiers.ts";

export interface ListSource {
	readonly find: (relative: string, text: string, parts: readonly string[]) => Omit<FileRegistrations, "file">;
	readonly holds: string;
	readonly readsParts: boolean;
	// The folder under src/generated the list is written to, and the one its importers name.
	readonly side: "client" | "server";
}

export interface ListEntry {
	readonly file: string;
	readonly name: string;
}

export function inPathOrder(found: readonly FileRegistrations[]): readonly ListEntry[] {
	return [...found]
		.sort((left, right) => byText(left.file, right.file))
		.flatMap(({ file, registrations }) => registrations.map((name) => ({ file, name })));
}

export const LIST_SOURCES: readonly ListSource[] = [
	{
		find: registrationsOf,
		holds: "the server's module list, every exported registration written `satisfies AppModule` in path order",
		readsParts: true,
		side: "server",
	},
	{
		find: clientModulesOf,
		holds: "the client's module list, every exported `clientModule(...)` outside server code in path order",
		readsParts: false,
		side: "client",
	},
];

export function listsSomething(relative: string, text: string, parts: readonly string[]): boolean {
	return (
		mayRegister(relative)
		&& LIST_SOURCES.some((source) => {
			const { registrations, refusals } = source.find(relative, text, parts);
			return registrations.length + refusals.length > 0;
		})
	);
}

// Written from syntax alone, so it needs no program and no cache: every run reads the sources and writes the list again. A
// project with nothing to list gets the list only when its sources import it, so a library that serves nothing carries none.
export const moduleList = Effect.fn("Build.moduleList")(function* (project: Project, check: boolean, source: ListSource, parts: RegistrationParts) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const importedAs = `generated/${source.side}/modules`;
	const output = path.join(project.generated, source.side, "modules.ts");
	const candidates = sourceFiles(project).filter((file) => mayRegister(path.relative(project.root, file)));
	const read = yield* Effect.forEach(candidates, (file) =>
		Effect.map(fs.readFileString(file), (text) => ({
			file,
			imports: text.includes(importedAs),
			...source.find(path.relative(project.root, file), text, parts.names),
		})),
	);
	const found = read.filter((each) => each.registrations.length + each.refusals.length > 0);
	const inputs = read.filter((each) => each.imports || each.registrations.length + each.refusals.length > 0).map(({ file }) => file);
	const refusals = [
		...(source.readsParts ? parts.unreadable : []),
		...found.flatMap(({ file, refusals: refused }) => refused.map((refusal) => `${path.relative(project.root, file)}: ${refusal}`)),
	];
	const relative = path.relative(project.root, output);
	if (refusals.length > 0) {
		const outcomes: readonly ListOutcome[] = [{ output: relative, status: "refused" }];
		return { inputs, outcomes, refusals };
	}
	if (found.length === 0 && !read.some((each) => each.imports)) {
		return { inputs, outcomes: [], refusals };
	}
	const items = yield* Effect.forEach(inPathOrder(found), ({ file, name }) =>
		Effect.map(specifierFor(project.root, output, file), (specifier) => ({ name, preferred: name, specifier: specifier ?? file, typeOnly: false })),
	);
	const content = emitList({ holds: source.holds, items, name: "modules" });
	const outcomes: readonly ListOutcome[] = [{ output: relative, status: yield* settle(check, output, content) }];
	return { inputs, outcomes, refusals };
});
