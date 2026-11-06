import { specHelpers } from "#rules/stories/specHelpers.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { inStory } from "#testing/adapters/storySpecFiles.ts";

const MATCHER = `function correlated(spans: readonly { traceId: string; parentId?: string }[], traceId: string) {
	return spans.filter((span) => span.traceId === traceId).map((span) => span.parentId);
}`;

ruleStory.it(
	"tests/spec-helpers accepts a pure trace-correlation matcher beside its package specs and reports setup and actions",
	[
		repositoryHas(
			{ content: '{"workspaces":["apps/*"]}', path: "package.json" },
			{ content: '{"name":"@example/desktop"}', path: "apps/desktop/package.json" },
			{ content: "export const tracing = 'enabled';", path: "apps/desktop/src/tracing.ts" },
			{
				content: [
					MATCHER,
					"const readTrace = (span: { traceId: string }) => span.traceId;",
					"const start = () => app.start();",
					"function seed() { traces.push({ traceId: 'seed' }); }",
					inStory("expect(correlated(spans, readTrace(root))).toEqual(['root']);"),
				].join("\n"),
				path: "apps/desktop/test/dev-tracing.test.ts",
			},
		),
	],
	function* ({ check, locations }) {
		yield* check(specHelpers);
		yield* assertThat(yield* locations(), (actual) =>
			actual.toEqual(["apps/desktop/test/dev-tracing.test.ts:5", "apps/desktop/test/dev-tracing.test.ts:6"]),
		);
	},
);

for (const helper of [
	"const start = () => Effect.map(program, transform);",
	"function seed() { return { traceId: 'fixture' }; }",
	"const start = (result = app.start()) => result;",
	"const start = (app) => app.start();",
	"const read = (store: { get(): string }) => store.get();",
	"const read = (spans: string[]) => spans.map(app.read);",
	"const read = (span: string) => span.replace('old', app.read);",
	"const read = (spans: string[]) => spans.map(async (span) => span);",
	"function read(spans) { spans.sort(); return spans; }",
	"function read(spans) { return spans.map((span) => { span.seen = true; return span; }); }",
	"const read = async (spans) => spans;",
	"function* read(spans) { return yield spans; }",
	"const start = () => { const result = app.start(); return result; };",
]) {
	ruleStory.it(
		`tests/spec-helpers keeps setup and actions in the kit: ${helper}`,
		[repositoryHas({ content: [helper, inStory('expect("ready").toBe("ready");')].join("\n"), path: "src/tracing.spec.ts" })],
		function* ({ check, locations }) {
			yield* check(specHelpers);
			yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/tracing.spec.ts:1"]));
		},
	);
}
