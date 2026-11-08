import { noDoubleCast } from "#rules/suppressions/noDoubleCast.ts";
import { nativeCastTypes } from "#test/nativeCastTypes.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const NEAR_MISSES = [
	'export const reportable = (value: unknown) => Object.assign(Predicate.isObject(value) ? value : new Error(String(value)), { [ErrorReporter.severity]: "Error" });',
	"export function supplied(error: Error) { return Object.assign(error, { [ErrorReporter.ignore]: true }); }",
	'const shared = new Error("shared"); track(shared); Object.defineProperty(shared, ErrorReporter.ignore, { value: true });',
	'const held = new Error("held"); const holder = { held }; Object.defineProperty(held, ErrorReporter.ignore, { value: true });',
	'let reassignable = new Error("first"); Object.defineProperty(reassignable, ErrorReporter.ignore, { value: true });',
	'const deferred = new Error("deferred"); export const mark = () => Object.defineProperty(deferred, ErrorReporter.ignore, { value: true });',
];

const HEADER = ['import { ErrorReporter, Predicate } from "effect";', "declare function track(error: Error): void;"];

const FRESH = [
	'export const copy = Object.assign(new Error("copy"), { cause: 1 }, { ...(ErrorReporter.isIgnored(new Error("x")) ? { [ErrorReporter.ignore]: true } : {}) });',
	'export const defect = Object.assign(new Error("defect"), { [ErrorReporter.severity]: "Error", [ErrorReporter.attributes]: { userId: "u1" } });',
	'const ignored = new Error("ignored"); Object.defineProperty(ignored, ErrorReporter.ignore, { value: true }); Object.defineProperty(ignored, ErrorReporter.severity, { value: "Error" }); track(ignored);',
];

ruleStory.it(
	"suppressions/no-double-cast accepts annotations on a just-built error and reports them on an object others can already hold",
	[nativeCastTypes, repositoryHas({ content: [...HEADER, ...FRESH, ...NEAR_MISSES].join("\n"), path: "src/errors.ts" })],
	function* ({ check, locations }) {
		yield* check(noDoubleCast);

		yield* assertThat(yield* locations(), (actual) =>
			actual.toEqual(NEAR_MISSES.map((_, index) => `src/errors.ts:${HEADER.length + FRESH.length + index + 1}`)),
		);
	},
);
