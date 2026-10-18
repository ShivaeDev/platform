import { Effect } from "effect";
import { expect } from "vitest";
import { repository, shadcn } from "#quality/test-support/shadcn.ts";

const STOCK = `// TODO: stock component\nexport const button = 1;\n${"\n".repeat(150)}`;

shadcn.it(
	"resolves an exact UI alias relative to the tsconfig that declares it",
	[
		repository([
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
	"reports an unresolved UI alias instead of silently narrowing checks",
	[
		repository([
			{ content: '{"aliases":{"ui":"@/missing"}}', path: "components.json" },
			{ content: STOCK, path: "src/button.tsx" },
		]),
	],
	function* (app) {
		const failure = yield* Effect.flip(app.checkStyle());
		expect(failure.message).toContain('Cannot resolve shadcn UI alias "@/missing"');
	},
);

shadcn.it(
	"checks authored neighbours but skips the custom UI folder without a Quality config",
	[
		repository([
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
	"discovers nested apps outside configured sources and resolves package imports",
	[
		repository([
			{ content: 'export default { sources: ["apps/web/src"] };', path: "quality.config.ts" },
			{ content: '{"aliases":{"ui":"#design/stock"}}', path: "apps/web/components.json" },
			{ content: '{"type":"module","imports":{"#*.tsx":{"source":"./src/*.tsx"}}}', path: "apps/web/package.json" },
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
