import { expect } from "@effect/vitest";
import ts from "typescript";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { declarationStory, labelsInstalled, repositoryDeclaresLabels } from "#test/declarationStory.ts";

declarationStory.it(
	"two rule programs parse an installed declaration once and each checks its own source against it",
	[labelsInstalled()],
	function* ({ compile, parsing, valueType }) {
		yield* compile("first", 'import type { Labelled } from "fixture-labels";\nexport const value: Labelled<1> = { label: 1 };');
		yield* compile("second", 'import type { Labelled } from "fixture-labels";\nexport const value: Labelled<"two"> = { label: "two" };');

		yield* outcomes([
			["installed declaration", () => parsing("node_modules/fixture-labels/index.d.ts"), "shared"],
			["first value", () => valueType("first"), "Labelled<1>"],
			["second value", () => valueType("second"), 'Labelled<"two">'],
		]);
	},
);

declarationStory.it(
	"a declaration file among the repository's own sources is parsed for each program",
	[repositoryDeclaresLabels()],
	function* ({ compile, parsing }) {
		yield* compile("first", 'import type { Labelled } from "./labels";\nexport const value: Labelled<1> = { label: 1 };');
		yield* compile("second", 'import type { Labelled } from "./labels";\nexport const value: Labelled<2> = { label: 2 };');

		expect(yield* parsing("src/labels.d.ts")).toBe("parsed per program");
	},
);

declarationStory.it(
	"an installed declaration whose text changed is parsed again and the next program sees the change",
	[labelsInstalled()],
	function* ({ compile, labelsUpdated, parsing, valueType }) {
		yield* compile("before", 'import { edition } from "fixture-labels";\nexport const value = edition;');
		yield* labelsUpdated("second");

		yield* compile("after", 'import { edition } from "fixture-labels";\nexport const value = edition;');

		yield* outcomes([
			["installed declaration", () => parsing("node_modules/fixture-labels/index.d.ts"), "parsed per program"],
			["value before the update", () => valueType("before"), '"first"'],
			["value after the update", () => valueType("after"), '"second"'],
		]);
	},
);

declarationStory.it(
	"programs whose targets parse differently keep their own copy of an installed declaration",
	[labelsInstalled()],
	function* ({ compileTargeting, parsing }) {
		yield* compileTargeting("es5", ts.ScriptTarget.ES5);
		yield* compileTargeting("esnext", ts.ScriptTarget.ESNext);

		expect(yield* parsing("node_modules/fixture-labels/index.d.ts")).toBe("parsed per program");
	},
);
