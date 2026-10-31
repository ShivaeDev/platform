import type { SeedFile } from "./tree.ts";

export function helperNamed(name: string): SeedFile {
	return {
		content: `export function ${name}(value: number, render: (input: number) => number): number {\n\treturn render(value);\n}\nexport function summary(count: number): number {\n\treturn ${name}(count, (input) => input);\n}\n`,
		path: `src/${name}.ts`,
	};
}

export function invalidTestTitle(path: string): SeedFile {
	return { content: 'import { describe } from "vitest";\nconst count = 2;\ndescribe(count, () => {});\n', path };
}
