import { oldOperationForm } from "#rules/oldOperationForm.ts";
import { HOST_PROTOCOL } from "#test/hostProtocol.ts";
import { MOVED_NOTES } from "#test/movedNotes.ts";
import { OLD_NOTES_MODULE, OLD_NOTES_PAGE } from "#test/oldNotes.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const REPAIR =
	"Write each operation as payload plus *run, list the operations in a defineModule and register it with module: in place of group and handlers, as https://github.com/ShivaeDev/platform/blob/main/docs/framework/add-a-feature.md#move-an-existing-module-to-this-shape describes.";

const HANDLED = "queries and commands, which a hand-written handler map serves and an AppModule registers as group plus handlers.";

const NOTES = `Module notes is written in the old operation form: contract groups its 6 ${HANDLED} ${REPAIR}`;

const STATISTICS = `Module admin.notes is written in the old operation form: contract groups its 1 ${HANDLED} ${REPAIR}`;

const REPORTS = `Module reports is written in the old operation form: contract groups its ${HANDLED} ${REPAIR}`;

ruleStory.it(
	"operations/old-form reports the starter's notes module before its move once, at its contract, naming the module",
	[repositoryHas(...OLD_NOTES_MODULE)],
	function* ({ check, findings }) {
		yield* check(oldOperationForm);

		yield* assertThat(yield* findings(), (actual) =>
			actual.toEqual([{ file: "src/modules/notes/notes.ts", line: 58, message: NOTES, subject: "notes" }]),
		);
	},
);

ruleStory.it(
	"operations/old-form reports the starter's statistics admin page before its move at the contract inside adminPage",
	[repositoryHas(...OLD_NOTES_PAGE)],
	function* ({ check, findings }) {
		yield* check(oldOperationForm);

		yield* assertThat(yield* findings(), (actual) =>
			actual.toEqual([{ file: "src/modules/notes/admin/pages.ts", line: 12, message: STATISTICS, subject: "admin.notes" }]),
		);
	},
);

ruleStory.it(
	"operations/old-form accepts the starter's notes module and statistics page written with defineModule, beside the client the generator wrote",
	[repositoryHas(...MOVED_NOTES)],
	function* ({ check, findings }) {
		yield* check(oldOperationForm);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"operations/old-form accepts the host's own protocol contracts: public config, live sync and host version",
	[repositoryHas(...HOST_PROTOCOL)],
	function* ({ check, findings }) {
		yield* check(oldOperationForm);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"operations/old-form accepts a contract that lists only streams and reports one called through a namespace import without a countable list",
	[
		repositoryHas(
			{
				content:
					'import { contract } from "@shivaedev/contract/contract.ts";\nimport { Watch } from "#feed/Watch.ts";\n\nexport const Feed = contract("feed", { streams: [Watch] });\n',
				path: "src/feed/Feed.ts",
			},
			{
				content:
					'import * as Contracts from "@shivaedev/contract/contract.ts";\nimport { reads } from "#reports/reads.ts";\n\nexport const Reports = Contracts.contract("reports", { queries: [...reads] });\n',
				path: "src/reports/Reports.ts",
			},
		),
	],
	function* ({ check, messages }) {
		yield* check(oldOperationForm);

		yield* assertThat(yield* messages(), (actual) => actual.toEqual([REPORTS]));
	},
);

ruleStory.it(
	"operations/old-form reports a module once when one file declares its full contract and a narrower read contract under the same name",
	[
		repositoryHas({
			content: [
				'import { contract } from "@shivaedev/contract/contract.ts";',
				'import { Diagnostics, Items, Problems } from "#daemon/reads.ts";',
				"",
				'export const DaemonContract = contract("daemon", { queries: [Diagnostics, Items, Problems] });',
				'export const DaemonReadContract = contract("daemon", { queries: [Diagnostics, Items] });',
				"",
			].join("\n"),
			path: "src/daemon/contracts.ts",
		}),
	],
	function* ({ check, locations }) {
		yield* check(oldOperationForm);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/daemon/contracts.ts:4"]));
	},
);

ruleStory.it(
	"operations/old-form accepts an old-form contract in test code",
	[
		repositoryHas({
			content: 'import { contract } from "@shivaedev/contract/contract.ts";\n\nexport const Fake = contract("fake", { queries: [List] });\n',
			path: "src/modules/fake/test-support/host.ts",
		}),
	],
	function* ({ check, findings }) {
		yield* check(oldOperationForm);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);
