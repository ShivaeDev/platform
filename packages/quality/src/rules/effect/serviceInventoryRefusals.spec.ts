import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { serviceDefinitionAssembly } from "#rules/effect/serviceDefinitionAssembly.ts";
import { effectInstalled } from "#test/consumerServices.ts";
import { biomeFormatted, repositoryHas as cliRepositoryHas, qualityInstalled, repositoryStory } from "#test/repositoryStory.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { ASSEMBLY_INVENTORY, assemblyFiles, serviceAssembly, serviceInstalled } from "#test/serviceAssemblyFiles.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const HIDDEN_DEFINITION = serviceAssembly("config", `const config = ${ASSEMBLY_INVENTORY};`);

repositoryStory.it(
	"quality lint rejects a hidden definition with the assembly repair",
	[qualityInstalled(), effectInstalled(), serviceInstalled(), cliRepositoryHas(...assemblyFiles, HIDDEN_DEFINITION), biomeFormatted()],
	function* ({ runs, outcome, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["gate", () => outcome(), "rejected"],
			["rule", () => stdout(), expect.stringContaining("error effect/service-definition-assembly")],
			["repair", () => stdout(), expect.stringContaining("Inline the service inventory.")],
		]);
	},
	CLI_TIMEOUT,
);

for (const [name, source, reason] of [
	["a hidden definition", HIDDEN_DEFINITION, "Inline the service inventory."],
	[
		"a second inventory hidden through a constructor alias",
		serviceAssembly(ASSEMBLY_INVENTORY, `const assembly = defineService; export const Hidden = assembly(${ASSEMBLY_INVENTORY});`),
		"Call the imported defineService directly in a top-level service declaration.",
	],
	["a spread configuration", serviceAssembly(`{ ...${ASSEMBLY_INVENTORY} }`), "computed members and spreads cannot hide the service inventory"],
	[
		"a computed configuration member",
		serviceAssembly(ASSEMBLY_INVENTORY.replace("initialize,", '["initialize"]: initialize,')),
		"computed members and spreads cannot hide the service inventory",
	],
	[
		"a local initializer",
		serviceAssembly(ASSEMBLY_INVENTORY.replace("initialize,", "initialize: local,"), "const local = Effect.void;"),
		"Reference a named initializer export or use Effect.void.",
	],
	[
		"an inline initializer",
		serviceAssembly(ASSEMBLY_INVENTORY.replace("initialize,", "initialize: Effect.succeed(0),")),
		"Reference a named initializer export or use Effect.void.",
	],
	[
		"a hidden operation record",
		serviceAssembly(ASSEMBLY_INVENTORY.replace(/methods:.*$/u, "methods: () => operations, requires: [] }"), "const operations = { reset };"),
		"Keep methods as a direct operation inventory.",
	],
	[
		"a method factory with setup",
		serviceAssembly(
			ASSEMBLY_INVENTORY.replace("(state) => ({", "(state) => { const hidden = 1; return ({").replace("}), requires", "}); }, requires"),
		),
		"Keep methods as a direct operation inventory.",
	],
	[
		"an operation spread",
		serviceAssembly(ASSEMBLY_INVENTORY.replace("reset }", "...{ reset } }")),
		"Reference a named Effect.fn operation export that yields its dependencies. Use a state factory only for owned lifetime state.",
	],
	[
		"a computed operation",
		serviceAssembly(ASSEMBLY_INVENTORY.replace("read: read(state)", '["read"]: read(state)')),
		"Reference a named Effect.fn operation export that yields its dependencies. Use a state factory only for owned lifetime state.",
	],
	[
		"an inline operation",
		serviceAssembly(ASSEMBLY_INVENTORY.replace("reset }", "reset: () => Effect.void }")),
		"Reference a named Effect.fn operation export that yields its dependencies. Use a state factory only for owned lifetime state.",
	],
	[
		"a local operation",
		serviceAssembly(ASSEMBLY_INVENTORY.replace("reset }", "reset: local }"), "const local = () => Effect.void;"),
		"Reference a named Effect.fn operation export that yields its dependencies. Use a state factory only for owned lifetime state.",
	],
	[
		"an inline generic operation",
		serviceAssembly(ASSEMBLY_INVENTORY.replace("genericMethod(preserve)", "genericMethod(<A, E, R>(value: Effect.Effect<A, E, R>) => value)")),
		"Reference a named Effect.fn operation export that yields its dependencies. Use a state factory only for owned lifetime state.",
	],
	[
		"an implementation beside the inventory",
		serviceAssembly(ASSEMBLY_INVENTORY, "export const hidden = () => Effect.void;"),
		"Move this implementation body to a named export in its own focused file.",
	],
] as const) {
	ruleStory.it(
		`effect/service-definition-assembly rejects ${name} with the assembly repair`,
		[repositoryHas(...assemblyFiles, source)],
		function* ({ check, messages }) {
			yield* check(serviceDefinitionAssembly);

			yield* assertThat(yield* messages(), (actual, matchers) => actual.toContainEqual(matchers.stringContaining(reason)));
		},
	);
}
