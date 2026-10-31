import { config, type SeedFile } from "./tree.ts";

const BROKEN = `import "./missing.ts";
// @ts-ignore
debugger;
export const actual = 1;
${"\n".repeat(150)}`;

export function shadcnApplication(extension = "tsx", packageImports = false): readonly SeedFile[] {
	return [
		config('{ sources: ["src"] }'),
		{
			content: JSON.stringify({
				dependencies: { "@base-ui/react": "*" },
				imports: packageImports ? { "#ui/*": "./src/components/ui/*" } : undefined,
				name: "shadcn-app",
				scripts: { start: "node src/main.ts" },
				type: "module",
			}),
			path: "package.json",
		},
		{
			content: JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } }, include: ["src"] }),
			path: "tsconfig.json",
		},
		{ content: JSON.stringify({ aliases: { ui: packageImports ? "#ui" : "@/components/ui" } }), path: "components.json" },
		{ content: "export {};", path: "src/main.ts" },
		{ content: `import "@base-ui/react";\n${BROKEN}`, path: `src/components/ui/button.${extension}` },
		{ content: BROKEN, path: `src/components/ui/handWritten.${extension}` },
		{ content: '{"license":"MIT","main":"index.js","name":"@base-ui/react"}', path: "node_modules/@base-ui/react/package.json" },
		{ content: "export {};", path: "node_modules/@base-ui/react/index.js" },
	];
}
