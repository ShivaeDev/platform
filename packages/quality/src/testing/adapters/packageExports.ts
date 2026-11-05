import sortPackageJson from "sort-package-json";
import type { SeedFile } from "./tree.ts";

export const LIBRARY_MANIFEST = "modules/library/package.json";

export const FILE_PATH_EXPORTS = {
	"./*.ts": { "@shivaedev/source": "./src/*.ts", default: "./dist/*.js", types: "./dist/*.d.ts" },
	"./package.json": "./package.json",
};

export const exportsWorkspace: SeedFile = {
	content: JSON.stringify({ name: "workspace", private: true, workspaces: ["modules/*"] }),
	path: "package.json",
};

function sourceFirst(_key: string, value: unknown): unknown {
	if (typeof value !== "object" || value === null || !("@shivaedev/source" in value)) {
		return value;
	}
	return Object.fromEntries([
		["@shivaedev/source", value["@shivaedev/source"]],
		...Object.entries(value).filter(([key]) => key !== "@shivaedev/source"),
	]);
}

export function packageExports(exports: unknown, path = LIBRARY_MANIFEST): SeedFile {
	return packageManifest({ exports }, path);
}

export function packageImports(imports: Readonly<Record<string, unknown>>, path = LIBRARY_MANIFEST): SeedFile {
	return packageManifest({ imports }, path);
}

function packageManifest(fields: Readonly<Record<string, unknown>>, path: string): SeedFile {
	return { content: sortPackageJson(`${JSON.stringify({ ...fields, name: "@acme/library" }, sourceFirst, "\t")}\n`), path };
}

export function exportsShapeMessage(reason: string): string {
	return `${reason} Import the module at its file path through the single "./*.ts" wildcard (for example, "./server/better-auth/mount.ts" for "./src/server/better-auth/mount.ts"). Map it to source "./src/*.ts", types "./dist/*.d.ts" and default "./dist/*.js"; remove aliases and per-file module exports. Non-code assets must use their exact file paths.`;
}
