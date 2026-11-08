import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const SCHEDULES = 'export const postgresSchedules = { backupKinds: ["DAILY"] } as const;\n';

const APP = [
	{ content: '{"name":"app","type":"module"}', path: "package.json" },
	{ content: '{"include":["src",".railway"]}', path: "tsconfig.json" },
	{ content: "export const app = 1;", path: "src/app.test.ts" },
	{ content: SCHEDULES, path: ".railway/postgres-schedules.ts" },
];

ruleStory.it(
	"code/unused treats the Postgres schedules module that the deploy command loads by default as an entry and still reports a .railway/ module nothing loads",
	[repositoryHas(...APP, { content: "export const helper = 1;\n", path: ".railway/helper.ts" })],
	function* ({ check, locations }) {
		yield* check(unusedCode);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual([".railway/helper.ts"]));
	},
);

ruleStory.it(
	"files/named-after-export lets the Postgres schedules module keep the name the deploy command loads and still checks another .railway/ module",
	[repositoryHas(...APP, { content: SCHEDULES, path: ".railway/schedule-list.ts" })],
	function* ({ check, locations }) {
		yield* check(namedAfterExport);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual([".railway/schedule-list.ts"]));
	},
);
