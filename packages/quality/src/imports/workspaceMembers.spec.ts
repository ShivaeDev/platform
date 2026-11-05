import { importStory, repositoryHas } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const WORKSPACE = { content: "packages:\n  - packages/*\n  - '!packages/example'\n", path: "pnpm-workspace.yaml" };

const WEB = { content: '{"name":"@demo/web"}', path: "packages/web/package.json" };

importStory.it(
	"the workspace leaves out a member folder that pnpm-workspace.yaml excludes",
	[repositoryHas(WORKSPACE, WEB, { content: '{"name":"@demo/example"}', path: "packages/example/package.json" })],
	function* ({ workspaceMembers }) {
		yield* assertThat(yield* workspaceMembers(), (actual) => actual.toEqual([{ directory: "packages/web", name: "@demo/web" }]));
	},
);

importStory.it(
	"the workspace leaves out a member manifest without a name",
	[repositoryHas(WORKSPACE, WEB, { content: '{"private":true}', path: "packages/unnamed/package.json" })],
	function* ({ workspaceMembers }) {
		yield* assertThat(yield* workspaceMembers(), (actual) => actual.toEqual([{ directory: "packages/web", name: "@demo/web" }]));
	},
);
