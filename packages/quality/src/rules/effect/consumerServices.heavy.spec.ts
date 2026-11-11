import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	consumerService,
	consumerWorkspace,
	effectInstalled,
	independentConsumer,
	serviceConsumer,
	workspaceGroupInstalled,
	workspaceStoreInstalled,
} from "#test/consumerServices.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const consumer = [qualityInstalled(), effectInstalled(), repositoryHas(...consumerWorkspace, consumerService)];

repositoryStory.it(
	"quality lint respects nested consumer package ownership",
	[...consumer, workspaceGroupInstalled(), repositoryHas(...independentConsumer), biomeFormatted()],
	function* ({ spawns, outcome, stdout }) {
		yield* spawns("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "passed"],
				["report", () => stdout(), expect.stringContaining("quality: passed")],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint rejects nested service ids with a wrong scope, package prefix or missing slash",
	[
		...consumer,
		repositoryHas({
			content: [
				'import { Context } from "effect";',
				'export const Folder = Context.Reference("@antumbra/store/Folder", { defaultValue: () => 0 });',
				'export const Parent = Context.Reference("@antumbra/group/Parent", { defaultValue: () => 0 });',
				'export const Platform = Context.Reference("@shivaedev/group/Platform", { defaultValue: () => 0 });',
				'export const MissingSlash = Context.Reference("@antumbra/domain", { defaultValue: () => 0 });',
			].join("\n"),
			path: "packages/group/domain/src/wrong.ts",
		}),
		biomeFormatted(),
	],
	function* ({ spawns, outcome, stdout }) {
		yield* spawns("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				["findings", () => stdout(), expect.stringContaining("error effect/service-ids (4)")],
				["wrong package", () => stdout(), expect.stringContaining('Service id "@antumbra/store/Folder" must start with "@antumbra/domain/"')],
				["parent package", () => stdout(), expect.stringContaining('Service id "@antumbra/group/Parent" must start with "@antumbra/domain/"')],
				["wrong scope", () => stdout(), expect.stringContaining('Service id "@shivaedev/group/Platform" must start with "@antumbra/domain/"')],
				["missing slash", () => stdout(), expect.stringContaining('Service id "@antumbra/domain" must start with "@antumbra/domain/"')],
			]),
		);
	},
	CLI_TIMEOUT,
);

for (const installed of [false, true]) {
	repositoryStory.it(
		`quality lint --full checks service shapes from ${installed ? "installed declarations" : "workspace sources"} in the consumer's scope`,
		[...consumer, ...(installed ? [] : [workspaceStoreInstalled()]), repositoryHas(...serviceConsumer(installed)), biomeFormatted()],
		function* ({ spawns, outcome, stdout }) {
			yield* spawns("lint", "--full");

			yield* withMatchers((expect) =>
				outcomes([
					["exit", () => outcome(), "rejected"],
					["finding", () => stdout(), expect.stringContaining("error effect/service-parameters (1)")],
					["parameter", () => stdout(), expect.stringContaining("Parameter store carries a service.")],
				]),
			);
		},
		CLI_TIMEOUT,
	);
}
