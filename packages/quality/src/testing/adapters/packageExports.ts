import sortPackageJson from "sort-package-json";
import type { SeedFile } from "./tree.ts";

export const LIBRARY_MANIFEST = "modules/library/package.json";

export const FILE_PATH_EXPORTS = {
	"./*.ts": { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" },
	"./package.json": "./package.json",
};

export const exportsWorkspace: SeedFile = {
	content: JSON.stringify({ name: "workspace", private: true, workspaces: ["modules/*"] }),
	path: "package.json",
};

function sourceFirst(_key: string, value: unknown): unknown {
	if (typeof value !== "object" || value === null || !("source" in value)) {
		return value;
	}
	return Object.fromEntries([["source", value.source], ...Object.entries(value).filter(([key]) => key !== "source")]);
}

export function packageExports(exports: unknown, path = LIBRARY_MANIFEST): SeedFile {
	return { content: sortPackageJson(`${JSON.stringify({ exports, name: "@acme/library" }, sourceFirst, "\t")}\n`), path };
}

export function exportsShapeMessage(reason: string): string {
	return `${reason} Import the module at its file path through the single "./*.ts" wildcard (for example, "./server/better-auth/mount.ts" for "./src/server/better-auth/mount.ts"). Map it to source "./src/*.ts", types "./dist/*.d.ts" and default "./dist/*.js"; remove aliases and per-file module exports. Non-code assets must use their exact file paths.`;
}
