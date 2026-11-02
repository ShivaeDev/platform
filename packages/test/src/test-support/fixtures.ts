const FIXTURES = {
	"a body that fails holding its resource": "scopeFixture",
	"a body that never finishes": "timeoutFixture",
	"a body that succeeds holding its resource": "scopeFixture",
	"a body with an unhandled rejection": "unhandledFixture",
	"a plain Vitest test": "testerFixture",
	"a test of a worker whose Layer fails to start": "startupFailureFixture",
	"a test waiting for its file Layer": "pendingLayerFixture",
	"a test whose cleanup never finishes": "stuckCleanupFixture",
	"an it.effect body behind a true skip condition": "testerFixture",
	"an it.effect body that fails": "testerFixture",
	"an it.effect test whose cleanup never finishes": "stuckCleanupFixture",
	"an it.live test whose cleanup never finishes": "stuckCleanupFixture",
	"fixture Effect table case alpha": "tableFixture",
	"fixture Effect table case beta": "tableFixture",
	"fixture generator table case alpha": "tableFixture",
	"fixture generator table case beta": "tableFixture",
	"it.effect Effect table case alpha": "tableFixture",
	"it.effect Effect table case beta": "tableFixture",
	"it.effect generator table case alpha": "tableFixture",
	"it.effect generator table case beta": "tableFixture",
	"it.effect.each case alpha": "testerFixture",
	"it.effect.each case beta": "testerFixture",
	"it.live Effect table case alpha": "tableFixture",
	"it.live Effect table case beta": "tableFixture",
	"it.live generator table case alpha": "tableFixture",
	"it.live generator table case beta": "tableFixture",
	"the first console test under the live clock": "consoleFixture",
	"the first console test under the test clock": "consoleFixture",
	"the next console test under the live clock": "consoleFixture",
	"the next console test under the test clock": "consoleFixture",
	"the test after a cleanup that never finishes": "stuckCleanupFixture",
	"the test after the failed worker startup": "startupFailureFixture",
} as const;

export type FixtureTestName = keyof typeof FIXTURES;
export type Fixture = (typeof FIXTURES)[FixtureTestName] | "sharedLayerFixture" | "variantFixture";
export type TesterVariant = "default" | "fails" | "only" | "runIf" | "skipIf" | "skip" | "runIf(false)" | "skipIf(true)";

export function fixtureOf(tests: readonly FixtureTestName[]): Fixture {
	const files = new Set(tests.map((test) => FIXTURES[test]));
	const [file, ...others] = files;
	if (file === undefined || others.length > 0) {
		throw new Error(`Name tests from one fixture file, not ${[...files].join(" and ")}.`);
	}
	return file;
}
