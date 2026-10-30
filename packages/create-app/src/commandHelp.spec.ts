import { readFileSync } from "node:fs";
import { expect } from "vitest";
import { application } from "#test/application.ts";

const version: unknown = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

application.it(
	"create-app --help describes the command, the optional folder, the --minimal flag and the update subcommand without a packed template",
	[],
	function* ({ help }) {
		expect(yield* help()).toEqual(
			expect.arrayContaining([
				"Create and install a Platform application from the maintained starter.",
				"create-app <subcommand> [flags] [<folder>]",
				"folder string (optional)",
				"--minimal Create the starter without the notes example module.",
				"update",
			]),
		);
	},
);

application.it("create-app --version prints the package version without a packed template", [], function* ({ version: printedVersion }) {
	expect(yield* printedVersion()).toBe(`create-app v${version}`);
});
