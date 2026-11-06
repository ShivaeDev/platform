import { expect } from "vitest";
import { repository, shadcn } from "#quality/test-support/shadcn.ts";

const STOCK = `// TODO: stock component\nexport const button = 1;\n${"\n".repeat(150)}`;

shadcn.it(
	"uses declared ownership beside an exact UI alias",
	[
		repository([
			{
				content: '{"quality":{"toolOwned":[{"glob":"src/stock/button.tsx","reason":"The registry owns this stock component."}]}}',
				path: "apps/web/package.json",
			},
			{ content: '{"aliases":{"ui":"@/stock"}}', path: "apps/web/components.json" },
			{ content: '{"compilerOptions":{"paths":{"@/stock":["../apps/web/src/stock"]}}}', path: "config/base.json" },
			{ content: '{"extends":"../../config/base.json","include":["src"]}', path: "apps/web/tsconfig.json" },
			{ content: STOCK, path: "apps/web/src/stock/button.tsx" },
			{ content: STOCK, path: "apps/web/src/button.tsx" },
		]),
	],
	function* (app) {
		yield* app.checkStyle();
		expect(app.inventory()?.sources.map((file) => file.path)).toEqual(["apps/web/src/button.tsx"]);
		expect(app.violations().map(({ file, rule }) => ({ file, rule }))).toEqual([
			{ file: "apps/web/src/button.tsx", rule: "structure/max-lines" },
			{ file: "apps/web/src/button.tsx", rule: "comments/no-todo" },
		]);
	},
);

shadcn.it(
	"checks source when an unresolved UI alias declares no ownership",
	[
		repository([
			{ content: '{"aliases":{"ui":"@/missing"}}', path: "components.json" },
			{ content: STOCK, path: "src/button.tsx" },
		]),
	],
	function* (app) {
		yield* app.checkStyle();
		expect(app.inventory()?.sources.map((file) => file.path)).toEqual(["src/button.tsx"]);
		expect(app.violations().map(({ rule }) => rule)).toEqual(["structure/max-lines", "comments/no-todo"]);
	},
);

shadcn.it(
	"checks authored neighbours and skips only declared stock without a Quality config",
	[
		repository([
			{
				content: '{"quality":{"toolOwned":[{"glob":"src/design/stock/button.tsx","reason":"The registry owns this stock component."}]}}',
				path: "package.json",
			},
			{ content: '{"aliases":{"ui":"@/design/stock"}}', path: "components.json" },
			{ content: '{"compilerOptions":{"paths":{"@/*":["./src/*"]}},"include":["src"]}', path: "tsconfig.json" },
			{ content: STOCK, path: "src/design/stock/button.tsx" },
			{ content: STOCK, path: "src/design/stock-extra/button.tsx" },
			{ content: STOCK, path: "src/components/ui/button.tsx" },
		]),
	],
	function* (app) {
		yield* app.checkStyle();
		expect(app.inventory()?.sources.map((file) => file.path)).toEqual(["src/components/ui/button.tsx", "src/design/stock-extra/button.tsx"]);
		expect(app.violations().map(({ file, rule }) => ({ file, rule }))).toEqual([
			{ file: "src/components/ui/button.tsx", rule: "structure/max-lines" },
			{ file: "src/design/stock-extra/button.tsx", rule: "structure/max-lines" },
			{ file: "src/components/ui/button.tsx", rule: "comments/no-todo" },
			{ file: "src/design/stock-extra/button.tsx", rule: "comments/no-todo" },
		]);
	},
);

shadcn.it(
	"discovers ownership in nested apps outside configured sources",
	[
		repository([
			{ content: 'export default { sources: ["apps/web/src"] };', path: "quality.config.ts" },
			{ content: '{"aliases":{"ui":"#design/stock"}}', path: "apps/web/components.json" },
			{
				content:
					'{"type":"module","imports":{"#*.tsx":{"@shivaedev/source":"./src/*.tsx"}},"quality":{"toolOwned":[{"glob":"src/design/stock/button.tsx","reason":"The registry owns this stock component."}]}}',
				path: "apps/web/package.json",
			},
			{ content: STOCK, path: "apps/web/src/design/stock/button.tsx" },
			{ content: STOCK, path: "apps/web/src/button.tsx" },
		]),
	],
	function* (app) {
		yield* app.checkStyle();
		expect(app.inventory()?.sources.map((file) => file.path)).toEqual(["apps/web/src/button.tsx"]);
		expect(app.violations().map(({ file, rule }) => ({ file, rule }))).toEqual([
			{ file: "apps/web/src/button.tsx", rule: "structure/max-lines" },
			{ file: "apps/web/src/button.tsx", rule: "comments/no-todo" },
		]);
	},
);
