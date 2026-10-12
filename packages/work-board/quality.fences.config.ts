import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";
import { anyOf, anything, external, files, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const BROWSER_FILES = [
	"packages/work-board/src/attention/RequestReceipt.ts",
	"packages/work-board/src/metadata/schema.ts",
	"packages/work-board/src/render/callouts.ts",
	"packages/work-board/src/render/code.ts",
	"packages/work-board/src/render/documentHeadings.ts",
	"packages/work-board/src/render/documentLinks.ts",
	"packages/work-board/src/render/documentPlugins.ts",
	"packages/work-board/src/render/failed.ts",
	"packages/work-board/src/render/footnotes.ts",
	"packages/work-board/src/render/questionnaireDocuments.ts",
	"packages/work-board/src/render/textContent.ts",
	"packages/work-board/src/render/visual.ts",
	"packages/work-board/src/render/visualDocuments.ts",
	"packages/work-board/src/render/visualFields.ts",
	"packages/work-board/src/files/url.ts",
	"packages/work-board/src/rpc/contract.ts",
	"packages/work-board/src/rpc/responseContract.ts",
	"packages/work-board/src/rpc/handoffContract.ts",
	"packages/work-board/src/rpc/keys.ts",
	"packages/work-board/src/rpc/rejections.ts",
	"packages/work-board/src/rpc/pageKeys.ts",
	"packages/work-board/src/history/schema.ts",
];
const MARKDOWN_MODULES = modules(
	"react",
	"react-markdown",
	"rehype-raw",
	"remark-directive",
	"remark-gfm",
	"unified",
	"unist-util-visit",
	"shiki",
	"mermaid",
	"hast",
	"mdast",
	"mdast-util-directive",
);
const browserCode = anyOf(folders("packages/work-board/src/browser", "packages/work-board/src/path"), files(...BROWSER_FILES));
const browserDependencies = anyOf(
	folders("packages/platform/src/core/errors", "packages/platform/src/core/rpc"),
	files("packages/effect-trpc/src/rejectionDecoding.ts"),
);
const markdownCode = anyOf(folders("packages/work-board/src/browser/document"), files(...BROWSER_FILES.filter((file) => file.includes("/render/"))));

export default [
	fence("board-client-stays-browser-safe")
		.because("The browser modules ship to browsers: everything they reach stays browser-safe, never Node or other server code.")
		.from(browserCode.except(markdownCode))
		.mayNotReach(
			anything.except(
				browserCode,
				browserDependencies,
				packages("effect-contract", "effect-form", "effect-react", "types"),
				modules(
					"effect",
					"react",
					"react-dom",
					"@effect/atom-react",
					"@tanstack/react-router",
					"clsx",
					"tailwind-merge",
					"class-variance-authority",
					"lucide-react",
				),
			),
		)
		.demonstratedBy({
			illegal: ["packages/work-board/src/browser/handoffs/form.ts", external("node:fs")],
			legal: ["packages/work-board/src/browser/handoffs/form.ts", "packages/effect-form/src/form.ts"],
		}),
	fence("document-rendering-stays-browser-safe")
		.because(
			"The React document view and its shared Markdown plugins reach only browser-safe Board data, Effect and the existing Markdown libraries.",
		)
		.from(markdownCode)
		.mayNotReach(
			anything.except(browserCode, browserDependencies, packages("effect-contract", "effect-form", "types"), modules("effect"), MARKDOWN_MODULES),
		)
		.demonstratedBy({
			illegal: ["packages/work-board/src/browser/document/View.ts", external("node:fs")],
			legal: ["packages/work-board/src/browser/document/View.ts", external("react-markdown")],
		}),
];
