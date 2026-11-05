import { expect } from "@effect/vitest";
import { CLI_TIMEOUT } from "@shivaedev/test-kits/quality/adapters/cli.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { effectInstalled } from "#test/consumerServices.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { ASSEMBLY_INVENTORY, assemblyFiles, serviceAssembly, serviceInstalled } from "#test/serviceAssemblyFiles.ts";

const consumer = [qualityInstalled(), effectInstalled(), serviceInstalled(), repositoryHas(...assemblyFiles)];

for (const [name, definition, preamble, reason] of [
	["a hidden definition", "config", `const config = ${ASSEMBLY_INVENTORY};`, "Inline the service inventory."],
	[
		"a second inventory hidden through a constructor alias",
		ASSEMBLY_INVENTORY,
		`const assembly = defineService; export const Hidden = assembly(${ASSEMBLY_INVENTORY});`,
		"Call the imported defineService directly in a top-level service declaration.",
	],
	["a spread configuration", `{ ...${ASSEMBLY_INVENTORY} }`, "", "computed members and spreads cannot hide the service inventory"],
	[
		"a computed configuration member",
		ASSEMBLY_INVENTORY.replace("initialize,", '["initialize"]: initialize,'),
		"",
		"computed members and spreads cannot hide the service inventory",
	],
	[
		"a local initializer",
		ASSEMBLY_INVENTORY.replace("initialize,", "initialize: local,"),
		"const local = Effect.void;",
		"Reference a named initializer export or use Effect.void.",
	],
	[
		"an inline initializer",
		ASSEMBLY_INVENTORY.replace("initialize,", "initialize: Effect.succeed(0),"),
		"",
		"Reference a named initializer export or use Effect.void.",
	],
	[
		"a hidden operation record",
		ASSEMBLY_INVENTORY.replace(/methods:.*$/u, "methods: () => operations, requires: [] }"),
		"const operations = { reset };",
		"Keep methods as a direct operation inventory.",
	],
	[
		"a method factory with setup",
		ASSEMBLY_INVENTORY.replace("(state) => ({", "(state) => { const hidden = 1; return ({").replace("}), requires", "}); }, requires"),
		"",
		"Keep methods as a direct operation inventory.",
	],
	[
		"an operation spread",
		ASSEMBLY_INVENTORY.replace("reset }", "...{ reset } }"),
		"",
		"Reference a named operation export or call its named state factory.",
	],
	[
		"a computed operation",
		ASSEMBLY_INVENTORY.replace("read: read(state)", '["read"]: read(state)'),
		"",
		"Reference a named operation export or call its named state factory.",
	],
	[
		"an inline operation",
		ASSEMBLY_INVENTORY.replace("reset }", "reset: () => Effect.void }"),
		"",
		"Reference a named operation export or call its named state factory.",
	],
	[
		"a local operation",
		ASSEMBLY_INVENTORY.replace("reset }", "reset: local }"),
		"const local = () => Effect.void;",
		"Reference a named operation export or call its named state factory.",
	],
	[
		"an inline generic operation",
		ASSEMBLY_INVENTORY.replace("genericMethod(preserve)", "genericMethod(<A, E, R>(value: Effect.Effect<A, E, R>) => value)"),
		"",
		"Reference a named operation export or call its named state factory.",
	],
	[
		"an implementation beside the inventory",
		ASSEMBLY_INVENTORY,
		"export const hidden = () => Effect.void;",
		"Move this implementation body to a named export in its own focused file.",
	],
] as const) {
	repositoryStory.it(
		`quality lint rejects ${name} with the assembly repair`,
		[...consumer, repositoryHas(serviceAssembly(definition, preamble)), biomeFormatted()],
		function* ({ runs, outcome, stdout }) {
			yield* runs("lint");

			yield* outcomes([
				["gate", () => outcome(), "rejected"],
				["rule", () => stdout(), expect.stringContaining("error effect/service-definition-assembly")],
				["repair", () => stdout(), expect.stringContaining(reason)],
			]);
		},
		CLI_TIMEOUT,
	);
}
