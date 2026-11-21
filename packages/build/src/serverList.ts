import { Effect, FileSystem, Path } from "effect";
import { registrationsOf } from "#adapters/typeScript.ts";
import { emitList } from "#emitList.ts";
import type { Project } from "#inputs.ts";
import { sourceFiles } from "#project.ts";
import { inPathOrder, mayRegister } from "#registrations.ts";
import type { ListOutcome } from "#report.ts";
import { settle } from "#settle.ts";
import { specifierFor } from "#specifiers.ts";

// Written from syntax alone, so it needs no program and no cache: every run reads the sources and writes the list again.
export const serverList = Effect.fn("Build.serverList")(function* (project: Project, check: boolean) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const output = path.join(project.generated, "server", "modules.ts");
	const candidates = sourceFiles(project).filter(mayRegister);
	const found = (yield* Effect.forEach(candidates, (file) =>
		Effect.map(fs.readFileString(file), (text) => ({ file, ...registrationsOf(file, text) })),
	)).filter((each) => each.registrations.length + each.refusals.length > 0);
	const inputs = found.map(({ file }) => file);
	const refusals = found.flatMap(({ file, refusals: refused }) => refused.map((refusal) => `${path.relative(project.root, file)}: ${refusal}`));
	const relative = path.relative(project.root, output);
	if (refusals.length > 0) {
		const outcome: ListOutcome = { output: relative, status: "refused" };
		return { inputs, outcome, refusals };
	}
	const items = yield* Effect.forEach(inPathOrder(found), ({ file, name }) =>
		Effect.map(specifierFor(project.root, output, file), (specifier) => ({ name, preferred: name, specifier: specifier ?? file, typeOnly: false })),
	);
	const content = emitList({
		holds: "the server's module list, every exported registration written `satisfies AppModule` in path order",
		items,
		name: "modules",
	});
	const outcome: ListOutcome = { output: relative, status: yield* settle(check, output, content) };
	return { inputs, outcome, refusals };
});
