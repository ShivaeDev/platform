import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const named = [
	["src/migration.ts", "export const MIGRATION_DIRECTORY = 'migrations'; export const MIGRATION_PATTERN = /^[0-9]+/u;"],
	["src/maxItems.ts", "export const MAX_ITEMS = 10;"],
	["src/items/max.ts", "export const MAX_ITEMS = 10;"],
	["src/timeouts.ts", "export const INSPECT_TIMEOUT_MILLIS = 30; export const REMOTE_TIMEOUT_MILLIS = 50;"],
	["src/limits.ts", "export const MAX_ITEMS = 10; export const MIN_DEPTH = 4; export const RETRY_LIMIT = 3;"],
	["src/defaults.ts", "export const DEFAULT_ITEMS = 10; export const DEFAULT_DEPTH = 4;"],
	["src/limits.ts", "export const MAX_ITEMS = 10, MIN_ITEMS = -1;"],
	["src/profileKey.ts", "const KEY = 'profile'; export { KEY as PROFILE_KEY };"],
	["src/statuses.ts", "export const STATUSES = ['open', 'closed'] as const; export type Status = (typeof STATUSES)[number];"],
	["src/statuses.ts", "export const STATUSES = { open: 'open' } as const; export type Status = typeof STATUSES.open;"],
	["src/statuses.ts", "export const STATUSES = ['open'] as const; export type Status = Extract<(typeof STATUSES)[number], string>;"],
	["src/messages.ts", "export const messages = { saved: 'Saved', retry: ['Retry', null, true, -1] } as const;"],
	["src/keys.ts", "export const PROFILE_KEY = KEY; export const REPORTS_KEY = { KEY };"],
	["src/test-support/timeouts.ts", "export const INSPECT_TIMEOUT = 30; export const REMOTE_TIMEOUT = 50;"],
	["src/constants.ts", "export const CONSTANT_NAMES = ['first']; export const CONSTANT_VALUES = [1];"],
] as const;

for (const [path, content] of named) {
	ruleStory.it(
		`files/named-after-export accepts the constants module ${path}: ${content}`,
		[repositoryHas({ content, path })],
		function* ({ check }) {
			const findings = yield* check(namedAfterExport);

			yield* assertThat(findings, (actual) => actual.toEqual([]));
		},
	);
}

const misnamed = [
	["src/ProfileKey.ts", "export const PROFILE_KEY = 'profile';", "Shared words: profile, key."],
	["src/Limits.ts", "export const MAX_ITEMS = 10, MIN_DEPTH = 4;", "Put MAX_/MIN_ constants in limits.ts"],
	["src/limits.ts", "export const MAX_ITEMS = 10; export const TIMEOUT = 30;", "every constant must fit the name"],
	["src/defaults.ts", "export const DEFAULT_DEPTH = 4; export const TIMEOUT = 30;", "every constant must fit the name"],
	["src/constants.ts", "export const CONFIG_FILE = 'quality.config.ts'; export const DEFAULT_EXTENSIONS = ['.ts'];", "or split it."],
	["src/test-support/constants.ts", "export const REQUEST_KEY = 'request'; export const DEFAULT_TIMEOUT = 30;", "or split it."],
	["src/retries.ts", "export const INSPECT_TIMEOUT = 30; export const REMOTE_TIMEOUT = 50;", "Shared words: timeout."],
	["src/max-items.ts", "export const MAX_ITEMS = 10;", "Name the module in camelCase"],
] as const;

for (const [path, content, reason] of misnamed) {
	ruleStory.it(
		`files/named-after-export refuses the constants module ${path}: ${content}`,
		[repositoryHas({ content, path })],
		function* ({ check, messages }) {
			yield* check(namedAfterExport);

			yield* assertThat(yield* messages(), (actual, expect) => actual.toEqual([expect.stringContaining(reason)]));
		},
	);
}

ruleStory.it(
	"unrelated constants receive shared-word examples, limits and defaults guidance, and a request to split",
	[repositoryHas({ content: "export const PROFILE_KEY = 'profile'; export const DEFAULT_DEPTH = 4;", path: "src/constants.ts" })],
	function* ({ check, messages }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* messages(), (actual) =>
			actual.toEqual([
				'"constants" holds only plain-data constants. Name the module in camelCase after a word each constant carries, such as timeouts.ts for INSPECT_TIMEOUT_MILLIS and REMOTE_TIMEOUT_MILLIS, or split it. Put MAX_/MIN_ constants in limits.ts and DEFAULT_ constants in defaults.ts; every constant must fit the name.',
			]),
		);
	},
);
