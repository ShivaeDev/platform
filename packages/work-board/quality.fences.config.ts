import { fence } from "@shivaedev/quality/imports/fence.ts";
import { anyOf, anything, external, files, folders, modules, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const boardCode = folders("packages/work-board/src").except(folders("packages/work-board/src/server"));
const markdownCode = folders("packages/work-board/src/client/document", "packages/work-board/src/render");
const markdownDependencies = modules(
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
const browserDependencies = anyOf(
	folders("packages/platform/src/rpc"),
	files("packages/access/src/permission.ts", "packages/effect-trpc/src/rejectionDecoding.ts"),
);

export default [
	fence("board-client-stays-browser-safe")
		.because("The browser modules ship to browsers: everything they reach stays browser-safe, never Node or other server code.")
		.from(folders("packages/work-board/src/client").except(markdownCode))
		.mayNotReach(
			anything.except(
				boardCode,
				browserDependencies,
				markdownDependencies,
				packages("contract", "form", "react", "types"),
				modules(
					"effect",
					"react",
					"react-dom",
					"@effect/atom-react",
					"@tanstack/react-router",
					"cn",
					"@base-ui/react",
					"class-variance-authority",
					"cmdk",
					"lucide-react",
					"@tanstack/react-table",
					"recharts",
				),
			),
		)
		.demonstratedBy({
			illegal: ["packages/work-board/src/client/handoffs/form.ts", external("node:fs")],
			legal: ["packages/work-board/src/client/handoffs/form.ts", "packages/form/src/form.ts"],
		}),
	fence("document-rendering-stays-browser-safe")
		.because(
			"The React document view and its shared Markdown plugins reach only browser-safe Board data, Effect and the existing Markdown libraries.",
		)
		.from(markdownCode)
		.mayNotReach(
			anything.except(
				boardCode,
				browserDependencies,
				markdownDependencies,
				packages("contract", "form", "types"),
				modules("effect"),
				modules("react"),
			),
		)
		.demonstratedBy({
			illegal: ["packages/work-board/src/client/document/View.ts", external("node:fs")],
			legal: ["packages/work-board/src/client/document/View.ts", external("react-markdown")],
		}),
];
