import { repositoryHas, repositoryLinks } from "./ruleStory.ts";
import { packageRoot, type SeedFile } from "./tree.ts";

function installed(name: string, fields: object = {}): SeedFile[] {
	return [
		{ content: JSON.stringify({ main: "index.js", name, ...fields }), path: `node_modules/${name}/package.json` },
		{ content: "export const value = 1;", path: `node_modules/${name}/index.js` },
	];
}

function applicationFiles(unused: boolean): readonly SeedFile[] {
	return [
		{ content: "node_modules/\n.worktrees/\n", path: ".gitignore" },
		{
			content: JSON.stringify({
				dependencies: {
					...(unused ? { "unused-tool": "*" } : {}),
					"@base-ui/react": "*",
					"@fontsource-variable/geist": "*",
					"class-variance-authority": "*",
					"job-service": "*",
					"pg-boss": "*",
					"shadcn": "*",
					"tailwindcss": "*",
					"tw-animate-css": "*",
				},
				devDependencies: { vitest: "*" },
				name: "plain-app",
				scripts: { start: "node src/main.ts", test: "vitest run" },
				type: "module",
			}),
			path: "package.json",
		},
		{ content: '{"compilerOptions":{"paths":{"#ui/*":["./src/components/ui/*"]}},"include":["src"]}', path: "tsconfig.json" },
		{ content: '{"aliases":{"ui":"#ui"}}', path: "components.json" },
		{ content: 'import "./app.css"; import "job-service";', path: "src/main.ts" },
		{
			content: '@import "@fontsource-variable/geist"; @import "tw-animate-css"; @import "shadcn/tailwind.css"; @import "tailwindcss";',
			path: "src/app.css",
		},
		{ content: 'import "@base-ui/react"; import "class-variance-authority";', path: "src/components/ui/button.ts" },
		{ content: "export default 1;", path: "src/server/migrations/0001_accounts.ts" },
		{ content: "export default 2;", path: "src/server/migrations/2_invoices.ts" },
		{ content: 'import { helper } from "./test-support/helper.ts"; console.log(helper);', path: "src/app.test.ts" },
		{ content: "export const helper = 1;", path: "src/test-support/helper.ts" },
		{ content: 'import { screen } from "../src/test-support/screen.ts"; console.log(screen);', path: "screens/capture.ts" },
		{ content: "export const screen = 1;", path: "src/test-support/screen.ts" },
		{ content: 'export default { root: process.cwd(), test: { include: ["screens/capture.ts"] } };', path: "vitest.screens.config.ts" },
		...installed("@base-ui/react"),
		...installed("@fontsource-variable/geist"),
		...installed("class-variance-authority"),
		...installed("job-service", { peerDependencies: { "pg-boss": "*" } }),
		...installed("pg-boss"),
		...installed("shadcn"),
		{ content: "", path: "node_modules/shadcn/tailwind.css" },
		...installed("tailwindcss"),
		...installed("tw-animate-css"),
		...(unused ? [{ content: "export const abandoned = 1;", path: "src/abandoned.ts" }, ...installed("unused-tool")] : []),
	];
}

export function unusedApplication(unused = false) {
	return [repositoryHas(...applicationFiles(unused)), repositoryLinks("node_modules/vitest", `${packageRoot}/node_modules/vitest`)];
}
