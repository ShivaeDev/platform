import { expect } from "vitest";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { importStory, repositoryHas, repositoryHolds, workspaceInstalled } from "#test/importStory.ts";
import { workerMember } from "#test/workerMember.ts";

const MEMBERS = { content: '{"workspaces":["modules/*"]}', path: "package.json" };

importStory.it(
	"imports/runtime treats every source file of a package declared as server as server code, which client code may not import",
	[
		repositoryHas(
			MEMBERS,
			{ content: '{"name":"host","exports":{"./*.ts":"./src/*.ts"},"quality":{"runtime":"server"}}', path: "modules/host/package.json" },
			{ content: '{"name":"app"}', path: "modules/app/package.json" },
			{ content: 'import "node:fs";\nexport const host = 1;', path: "modules/host/src/appHost.ts" },
			{ content: 'import "host/appHost.ts";', path: "modules/app/src/client/app.ts" },
		),
		workspaceInstalled("host", "modules/host"),
	],
	function* ({ check, sites }) {
		yield* check(importsRuntime);

		expect(yield* sites()).toEqual(["modules/app/src/client/app.ts:1 host/appHost.ts"]);
	},
);

importStory.it(
	"imports/runtime treats a package declared as client as client code throughout, which may read browser globals but not import Node builtins",
	[
		repositoryHas(
			{ content: '{"name":"view","quality":{"runtime":"client"}}', path: "package.json" },
			{ content: 'import "node:fs";\nwindow.alert("hi");', path: "src/view.ts" },
		),
	],
	function* ({ check, sites }) {
		yield* check(importsRuntime);

		expect(yield* sites()).toEqual(["src/view.ts:1 node:fs"]);
	},
);

importStory.it(
	"imports/runtime reports a runtime declaration beside a runtime folder on the package's manifest",
	[
		repositoryHas(
			MEMBERS,
			{ content: '{"name":"mixed","quality":{"runtime":"server"}}', path: "modules/mixed/package.json" },
			{ content: "export const view = 1;", path: "modules/mixed/src/client/view.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(importsRuntime);

		expect(findings).toEqual([
			expect.objectContaining({
				file: "modules/mixed/package.json",
				message: expect.stringContaining("also has src/client/"),
				subject: "quality.runtime",
			}),
		]);
	},
);

importStory.it(
	"imports/runtime reports an unknown runtime on the package's manifest and asks for client or server",
	[
		repositoryHas(
			MEMBERS,
			{ content: '{"name":"odd","quality":{"runtime":"edge"}}', path: "modules/odd/package.json" },
			{ content: "export const odd = 1;", path: "modules/odd/src/odd.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(importsRuntime);

		expect(findings).toEqual([
			expect.objectContaining({
				file: "modules/odd/package.json",
				message: expect.stringContaining('Declare "client" or "server"'),
				subject: "quality.runtime",
			}),
		]);
	},
);

for (const bin of ["./src/cli.ts", { worker: "./src/cli.ts" }]) {
	importStory.it(
		`imports/runtime treats a member whose bin is ${JSON.stringify(bin)} as server code, also when only the importing member is checked`,
		[repositoryHolds(workerMember(bin)), workspaceInstalled("worker", "modules/worker")],
		function* ({ checkOnly, sites }) {
			yield* checkOnly(importsRuntime, "modules/app/");

			expect(yield* sites()).toEqual([
				"modules/app/src/client/app.ts:1 worker/api.ts",
				"modules/app/src/client/app.ts:2 ../../../worker/src/cli.ts",
				"modules/app/src/shared.ts:1 worker/api.ts",
			]);
		},
	);
}

importStory.it(
	"imports/runtime keeps runtime folders authoritative in an executable workspace root",
	[
		repositoryHas(
			{ content: '{"bin":"./src/server/cli.ts"}', path: "package.json" },
			{ content: 'import "../shared.ts";\nimport "../server/cli.ts";', path: "src/client/app.ts" },
			{ content: 'import "./server/cli.ts";\nwindow.alert("hi");', path: "src/shared.ts" },
			{ content: 'import "node:fs";', path: "src/server/cli.ts" },
		),
	],
	function* ({ check, sites }) {
		yield* check(importsRuntime);

		expect(yield* sites()).toEqual(["src/client/app.ts:2 ../server/cli.ts", "src/shared.ts:1 ./server/cli.ts", "src/shared.ts:2 window"]);
	},
);

importStory.it(
	"imports/runtime treats script, scripts and tooling folders and the Vitest config at a package root as Node tooling, and not a tooling folder under src",
	[
		repositoryHas(
			MEMBERS,
			{ content: '{"name":"app","engines":{"node":">=24"}}', path: "modules/app/package.json" },
			{
				content: 'import "../../../script/task.ts";\nimport "../vitest.config.ts";\nimport "./tooling/value.ts";',
				path: "modules/app/src/client.ts",
			},
			{ content: 'import "node:fs";', path: "script/task.ts" },
			{ content: 'import "node:fs";\nimport "./src/client.ts";', path: "modules/app/vitest.config.ts" },
			{ content: "export const value = 1;", path: "modules/app/src/tooling/value.ts" },
			{ content: 'import "../../scripts/task.ts";\nimport "../../tooling/task.ts";', path: "modules/app/src/client/app.ts" },
			{ content: 'import "node:fs";', path: "modules/app/scripts/task.ts" },
			{ content: 'import "node:fs";', path: "modules/app/tooling/task.ts" },
		),
	],
	function* ({ check, subjects }) {
		yield* check(importsRuntime);

		expect(yield* subjects()).toEqual(["../../../script/task.ts", "../vitest.config.ts", "../../scripts/task.ts", "../../tooling/task.ts"]);
	},
);

for (const bin of [undefined, "", {}, { worker: "" }]) {
	importStory.it(
		`imports/runtime takes a member with engines.node and the empty bin ${JSON.stringify(bin)} for no runtime, so client code may import it`,
		[repositoryHolds(workerMember(bin)), workspaceInstalled("worker", "modules/worker")],
		function* ({ checkOnly }) {
			expect(yield* checkOnly(importsRuntime, "modules/app/")).toEqual([]);
		},
	);
}
