import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const packageDirectory = fileURLToPath(new URL("../..", import.meta.url));

export type InvalidFixture =
	| "callerRequirement"
	| "fake"
	| "generic"
	| "genericMarkerOverloaded"
	| "initializerRequirement"
	| "methodRequirement"
	| "methodValue"
	| "overloaded"
	| "overloadedHiddenRequirement"
	| "privateState"
	| "requirementFreeOrdinaryRequirement"
	| "scopeRequirement";

interface Compilation {
	readonly declaration: string;
	readonly errors: readonly string[];
}

function compile(arguments_: readonly string[]) {
	const result = spawnSync(join(packageDirectory, "node_modules", ".bin", "tsc"), arguments_, {
		cwd: packageDirectory,
		encoding: "utf8",
	});
	if (result.error !== undefined) {
		throw result.error;
	}
	const output = `${result.stdout}${result.stderr}`.trim();
	return output === "" ? [] : output.split(/\n(?=\S)/u).map(normalized);
}

function normalized(text: string) {
	return text.replace(/\s+/gu, " ").trim();
}

function compileValidFixture(): Compilation {
	const output = mkdtempSync(join(tmpdir(), "service-"));
	try {
		const errors = compile(["-p", "src/test-support/fixtures/tsconfig.json", "--outDir", output]);
		const declaration = errors.length === 0 ? readFileSync(join(output, "src/test-support/fixtures/valid.d.ts"), "utf8") : "";
		return { declaration: normalized(declaration), errors };
	} finally {
		rmSync(output, { force: true, recursive: true });
	}
}

function compileInvalidFixture(fixture: InvalidFixture): Compilation {
	const errors = compile([
		"--ignoreConfig",
		"--noEmit",
		"--noErrorTruncation",
		"--pretty",
		"false",
		"--strict",
		"--skipLibCheck",
		"--target",
		"ESNext",
		"--module",
		"ESNext",
		"--moduleResolution",
		"Bundler",
		"--allowImportingTsExtensions",
		"--customConditions",
		"source",
		`src/test-support/fixtures/invalid/${fixture}.ts`,
	]);
	return { declaration: "", errors };
}

function typeEnding(text: string, start: number) {
	let depth = 0;
	for (let index = start; index < text.length; index += 1) {
		const character = text[index];
		if (character === "(" || character === "[" || character === "{" || character === "<") {
			depth += 1;
		} else if (character === ")" || character === "]" || character === "}" || (character === ">" && text[index - 1] !== "=")) {
			if (depth === 0) {
				return index;
			}
			depth -= 1;
		} else if (character === ";" && depth === 0) {
			return index;
		}
	}
	return text.length;
}

function member(declaration: string, service: string, name: string) {
	const serviceStart = declaration.indexOf(`Context.Service<"${service}",`);
	if (serviceStart === -1) {
		return `no service ${service} in the declaration`;
	}
	const serviceEnd = declaration.indexOf("export declare", serviceStart);
	const marker = `readonly ${name}: `;
	const start = declaration.indexOf(marker, serviceStart);
	if (start === -1 || (serviceEnd !== -1 && start > serviceEnd)) {
		return `no member ${name} on ${service}`;
	}
	const typeStart = start + marker.length;
	return declaration.slice(typeStart, typeEnding(declaration, typeStart));
}

interface CompilerEngine {
	compilation: Compilation | undefined;
}

function compilerEngine(): CompilerEngine {
	return { compilation: undefined };
}

export const compilerStory = storyKit({
	create: compilerEngine,
	inspect: ({ compilation }) => compilation?.errors ?? "nothing compiled yet",
	name: "service definition compiler",
	stages: [],
	verbs: (engine, story) => {
		function compilation() {
			return engine.compilation === undefined
				? Effect.die(new Error("Compile a fixture before reading the compiler's output"))
				: Effect.succeed(engine.compilation);
		}
		return {
			compileInvalid: (fixture: InvalidFixture) => {
				story.tell(`the compiler checks the invalid definition in fixtures/invalid/${fixture}.ts`);
				return Effect.sync(() => {
					engine.compilation = compileInvalidFixture(fixture);
				});
			},
			compileValid: () => {
				story.tell("the compiler checks fixtures/valid.ts and emits its declaration");
				return Effect.sync(() => {
					engine.compilation = compileValidFixture();
				});
			},
			emitted: {
				layer: (service: string) => Effect.map(compilation(), ({ declaration }) => member(declaration, service, "layer")),
				mentions: (...names: readonly string[]) =>
					Effect.map(compilation(), ({ declaration }) => names.filter((name) => new RegExp(`\\b${name}\\b`, "u").test(declaration))),
				method: (service: string, name: string) => Effect.map(compilation(), ({ declaration }) => member(declaration, service, name)),
			},
			errors: () => Effect.map(compilation(), ({ errors }) => errors),
			rejection: () => Effect.map(compilation(), ({ errors }) => (errors.length === 0 ? "accepted" : errors.join(" "))),
		};
	},
});
