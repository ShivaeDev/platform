import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { generator, refusingProject } from "#test/generator.ts";

const REFUSED = "src/generated/modules/refused/refused.ts";
const OPERATIONS = "src/modules/refused/operations.ts";

const REFUSALS = {
	failsDataTagged:
		'refused.failsDataTagged: run fails with Busy (Busy), which is not a Schema class, so the browser cannot decode it; declare it as a Schema tagged error, such as class Busy extends Schema.TaggedError<Busy>()("Busy", { ... })',
	failsUnexported:
		"refused.failsUnexported: run fails with Hidden (Hidden), which is not an exported class; export its class so the browser can decode it",
	failsUntagged: "refused.failsUntagged: run fails with string, which has no _tag; fail with an exported tagged error class instead",
	localPayload: `refused.localPayload payload uses Draft, which is declared in ${OPERATIONS}; move it to a module the operation imports it from, such as the module's model file`,
	relativeReads: `refused.relativeReads reads imports refusedKeys by the relative path "./keys.ts" in ${OPERATIONS}; import it through a package import, such as a # specifier, so the generated file can import it too`,
	returnsAny: "refused.returnsAny: run returns any at success, which has no exact wire form; decode the value with a schema, or give it a type",
	returnsBrand:
		"refused.returnsBrand: run returns NoteId at success, which has no exact wire form; return the unbranded type, or wrap the value in an exported Schema class",
	returnsEnum:
		"refused.returnsEnum: run returns Level at success.level, which has no exact wire form; return string or number literals instead of an enum",
	returnsLooseOptional:
		"refused.returnsLooseOptional: run returns string | undefined at success.summary, which has no exact wire form; drop undefined from the optional property summary, so an absent key is the only way to leave it out",
	returnsMap:
		"refused.returnsMap: run returns Map<string, number> at success, which has no exact wire form; return a plain object, an array or a string-keyed record",
	returnsNullOrUndefined:
		"refused.returnsNullOrUndefined: run returns null | undefined at success, which has no exact wire form; return either null or undefined, since the wire carries both as one",
	returnsNumberKeys: "refused.returnsNumberKeys: run returns Record<number, string> at success, which has no exact wire form; use string keys only",
	returnsPlainClass:
		"refused.returnsPlainClass: run returns Counter at success, which has no exact wire form; return a plain object, or make the class a Schema class",
	returnsRecursive:
		"refused.returnsRecursive: run returns Tree at success.children[number], which has no exact wire form; return a type that does not contain itself",
	returnsStringOrNumber:
		"refused.returnsStringOrNumber: run returns string | number at success, which has no exact wire form; return string, number or boolean literals, or objects told apart by one literal field such as _tag",
	returnsTupleRest:
		"refused.returnsTupleRest: run returns readonly [string, ...number[]] at success, which has no exact wire form; use an array, or a tuple of required elements",
	returnsUndefinedProperty:
		"refused.returnsUndefinedProperty: run returns string | undefined at success.summary, which has no exact wire form; return null instead of undefined, or make the property optional",
	returnsUnexportedClass:
		"refused.returnsUnexportedClass: run returns Secret at success, which has no exact wire form; export the Schema class Secret from its module",
} as const;

const MODULE_REFUSALS = {
	"a module not exported": "hidden: export the module as a const, such as export const Hidden = defineModule(...)",
	"a module outside src":
		"lib/outside.ts: defines a module outside src; move it under src, since its generated file goes to src/generated/<its path under src>",
	"two modules in one file": "src/modules/refused/twice.ts: defines 2 modules; define exactly one module per file",
} as const;

generator.it(
	"generate refuses each operation the wire cannot carry exactly with a message naming it, the type and what to write instead, refuses misplaced, hidden or doubled modules, and writes no file for a refused module",
	[refusingProject()],
	function* ({ generatedFile, generates }) {
		const outcome = yield* generates();

		yield* outcomes([
			["generate", () => Effect.succeed(outcome), { files: { [REFUSED]: "refused" }, result: "failed" }],
			...Object.entries(REFUSALS).map(
				([operation, message]) =>
					[
						operation,
						() => Effect.succeed(outcome.problems.find((problem) => problem.startsWith(`refused.${operation}`)) ?? "no message"),
						message,
					] as const,
			),
			...Object.entries(MODULE_REFUSALS).map(([label, message]) => [label, () => Effect.succeed(outcome.problems.includes(message)), true] as const),
			["messages", () => Effect.succeed(outcome.problems.length), Object.keys(REFUSALS).length + Object.keys(MODULE_REFUSALS).length],
			["generated file", () => generatedFile(REFUSED), "missing"],
		]);
	},
);
