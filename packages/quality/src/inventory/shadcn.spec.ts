import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { shadcnApplication } from "#test/shadcnApplication.ts";

for (const [extension, packageImports] of [
	["tsx", false],
	["jsx", true],
	["ts", false],
	["js", true],
] as const) {
	const application = [qualityInstalled(), repositoryHas(...shadcnApplication(extension, packageImports))];

	repositoryStory.it(
		`quality lints authored ${extension} beside a stock shadcn component, skips the stock file and counts its dependency imports`,
		application,
		function* ({ outcome, runs, stdout }) {
			yield* runs("lint");

			yield* outcomes([
				["authored component", () => stdout(), expect.stringContaining(`src/components/ui/handWritten.${extension}`)],
				["biome", () => stdout(), expect.stringContaining("biome/lint/suspicious/noDebugger")],
				["exit", () => outcome(), "rejected"],
				["imports", () => stdout(), expect.stringContaining("imports/resolvable")],
				["length", () => stdout(), expect.stringContaining("structure/max-lines")],
				["naming", () => stdout(), expect.stringContaining("files/named-after-export")],
				["stock component", () => stdout(), expect.not.stringContaining(`src/components/ui/button.${extension}`)],
				["stock dependency", () => stdout(), expect.not.stringContaining("@base-ui/react")],
				["suppressions", () => stdout(), expect.stringContaining("suppressions/no-inline")],
				[
					"unused authored file",
					() => stdout(),
					expect.stringContaining(`Unused file. Remove it or reach it from a declared entry point: src/components/ui/handWritten.${extension}.`),
				],
			]);
		},
	);

	repositoryStory.it(
		`quality fix removes the debugger from authored ${extension} beside a stock shadcn component and leaves the stock component unchanged`,
		application,
		function* ({ reads, runs }) {
			const stock = yield* reads(`src/components/ui/button.${extension}`);
			expect(stock).toContain("debugger;");
			expect(yield* reads(`src/components/ui/handWritten.${extension}`)).toContain("debugger;");

			yield* runs("fix");

			yield* outcomes([
				["authored component", () => reads(`src/components/ui/handWritten.${extension}`), expect.not.stringContaining("debugger;")],
				["stock component", () => reads(`src/components/ui/button.${extension}`), stock],
			]);
		},
	);
}
