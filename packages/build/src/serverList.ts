import { Effect, FileSystem, Path } from "effect";
import { registrationsOf } from "#adapters/typeScript.ts";
import { emitList } from "#emitList.ts";
import type { Project } from "#inputs.ts";
import { sourceFiles } from "#project.ts";
import { inPathOrder, mayRegister } from "#registrations.ts";
import type { ListOutcome } from "#report.ts";
import { settle } from "#settle.ts";
import { specifierFor } from "#specifiers.ts";

const IMPORTED_AS = "generated/server/modules";

// Written from syntax alone, so it needs no program and no cache: every run reads the sources and writes the list again. A
// project with no registration gets the list only when its sources import it, so a library that serves nothing carries none.
export const serverList = Effect.fn("Build.serverList")(function* (project: Project, check: boolean) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const output = path.join(project.generated, "server", "modules.ts");
	const candidates = sourceFiles(project).filter((file) => mayRegister(path.relative(project.root, file)));
	const read = yield* Effect.forEach(candidates, (file) =>
		Effect.map(fs.readFileString(file), (text) => ({
			file,
			imports: text.includes(IMPORTED_AS),
			...registrationsOf(path.relative(project.root, file), text),
		})),
	);
	const found = read.filter((each) => each.registrations.length + each.refusals.length > 0);
	const inputs = read.filter((each) => each.imports || each.registrations.length + each.refusals.length > 0).map(({ file }) => file);
	const refusals = found.flatMap(({ file, refusals: refused }) => refused.map((refusal) => `${path.relative(project.root, file)}: ${refusal}`));
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
	const content = emitList({
		holds: "the server's module list, every exported registration written `satisfies AppModule` in path order",
		items,
		name: "modules",
	});
	const outcomes: readonly ListOutcome[] = [{ output: relative, status: yield* settle(check, output, content) }];
	return { inputs, outcomes, refusals };
});
