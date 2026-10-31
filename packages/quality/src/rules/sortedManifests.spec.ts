import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { manifestStory, repositoryHas } from "#test/manifestStory.ts";

const UNSORTED = '{\n\t"version": "1.0.0",\n\t"name": "sample",\n\t"scripts": {\n\t\t"sample": "node src/limits.ts"\n\t}\n}\n';

const SORTED = '{\n\t"name": "sample",\n\t"version": "1.0.0",\n\t"scripts": {\n\t\t"sample": "node src/limits.ts"\n\t}\n}\n';

const UNSORTED_FINDING = "Keys are not in sort-package-json order. Run `quality fix`.";

manifestStory.it(
	"quality lint reports each package.json out of sort-package-json order, outside the sources too, but not a sorted or gitignored one",
	[
		repositoryHas(
			{ content: UNSORTED, path: "package.json" },
			{ content: SORTED, path: "packages/b/package.json" },
			{ content: UNSORTED, path: "packages/c/package.json" },
			{ content: UNSORTED, path: "ignored/package.json" },
		),
	],
	function* ({ outcome, reportLines, runs }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"unsorted manifests": [
				reportLines(UNSORTED_FINDING),
				[`  package.json  ${UNSORTED_FINDING}`, `  packages/c/package.json  ${UNSORTED_FINDING}`],
			],
		});
	},
);

manifestStory.it(
	"quality fix rewrites each unsorted package.json in sort-package-json order and reports how many it sorted",
	[
		repositoryHas(
			{ content: UNSORTED, path: "package.json" },
			{ content: SORTED, path: "packages/b/package.json" },
			{ content: UNSORTED, path: "packages/c/package.json" },
		),
	],
	function* ({ reads, runs, stdout }) {
		expect(yield* reads("packages/c/package.json")).toBe(UNSORTED);

		yield* runs("fix");

		yield* outcomes({
			"package.json": [reads("package.json"), SORTED],
			"packages/c/package.json": [reads("packages/c/package.json"), SORTED],
			"report": [stdout(), expect.stringContaining("quality: sort-package-json rewrote 2 manifests.")],
		});
	},
);
