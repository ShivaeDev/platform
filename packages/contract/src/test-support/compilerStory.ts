import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { compiler } from "#test/compiler.ts";

// One tsc run checks every invalid fixture and one emits the valid declarations; each story reads its part of those runs.
let invalidRun: ReturnType<typeof compiler.invalid> | undefined;
let validRun: ReturnType<typeof compiler.declarations> | undefined;

function diagnosticsOf(fixture: string) {
	invalidRun ??= compiler.invalid();
	const output = invalidRun.stderr || invalidRun.stdout;
	return output
		.split(/(?=^src\/test-support\/fixtures\/invalid\/)/mu)
		.filter((message) => message.startsWith(`src/test-support/fixtures/invalid/${fixture}.ts(`))
		.join("\n");
}

function declares(engine: typeof compiler, marker: string) {
	validRun ??= engine.declarations();
	const { declaration, result } = validRun;
	const diagnostics = result.stderr || result.stdout;
	if (result.status !== 0 || diagnostics !== "") {
		return `failed with ${diagnostics}`;
	}
	return declaration.includes(marker) ? `compiled cleanly, declaring ${marker}` : `compiled without ${marker}`;
}

export const compilerStory = storyKit({
	create: () => Effect.succeed(compiler),
	name: "contract compiler",
	stages: [],
	verbs: (engine, story) => ({
		compileInvalid: (fixture: string) =>
			Effect.sync(() => {
				story.tell(`tsc checks the invalid ${fixture} fixture`);
				const diagnostics = diagnosticsOf(fixture);
				return diagnostics === "" ? "no diagnostics" : diagnostics;
			}),
		compileValid: () =>
			Effect.sync(() => {
				story.tell("tsc compiles the valid contract, binding and handlers to declarations");
				return declares(engine, 'Rpc<"notes.rename"');
			}),
		compileValidModule: () =>
			Effect.sync(() => {
				story.tell("tsc compiles a module defined from operations written as payload and run, and the requirements of its handlers");
				return declares(engine, 'Module<"sessionNotes"');
			}),
		compileValidRuns: () =>
			Effect.sync(() => {
				story.tell("tsc compiles the operations written as payload and run, their run types and their contract to declarations");
				return declares(engine, 'Contract<"runNotes"');
			}),
	}),
});
