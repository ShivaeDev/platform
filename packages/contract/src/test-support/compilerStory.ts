import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { compiler } from "./compiler.ts";

// One tsc run checks every invalid fixture, and each story reads its own file's diagnostics from that run.
let invalidRun: ReturnType<typeof compiler.invalid> | undefined;

function diagnosticsOf(fixture: string) {
	invalidRun ??= compiler.invalid();
	const output = invalidRun.stderr || invalidRun.stdout;
	return output
		.split(/(?=^src\/test-support\/fixtures\/invalid\/)/mu)
		.filter((message) => message.startsWith(`src/test-support/fixtures/invalid/${fixture}.ts(`))
		.join("\n");
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
				const { declaration, result } = engine.declarations();
				const diagnostics = result.stderr || result.stdout;
				if (result.status !== 0 || diagnostics !== "") {
					return `failed with ${diagnostics}`;
				}
				return declaration.includes('Rpc<"notes.rename"')
					? 'compiled cleanly, declaring Rpc<"notes.rename"'
					: "compiled without the notes.rename RPC";
			}),
	}),
});
