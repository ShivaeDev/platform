import type { SeedFile } from "@shivaedev/test-kits/quality/adapters/tree.ts";

export const stylesheetImports = {
	importing: (path: string, specifier: string): SeedFile => ({ content: `import "${specifier}";\n`, path }),
	manifest: (path: string, imports: object): SeedFile => ({ content: JSON.stringify({ imports }), path }),
	stylesheet: (path: string, content = ""): SeedFile => ({ content, path }),
};
