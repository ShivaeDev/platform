import type { SeedFile } from "./tree.ts";

export function groupedModules(directory: string): readonly SeedFile[] {
	function file(path: string, content: string): SeedFile {
		return { content, path: `${directory}${path}` };
	}
	return [
		file("src/client/view.ts", "export const view = 1;"),
		file("src/server/db.ts", 'import "node:fs";'),
		...["users", "admin/users", "admin/teams"].flatMap((module) => [
			file(`src/modules/${module}/client/view.ts`, 'window.alert("view");'),
			file(`src/modules/${module}/client/app.ts`, 'import "./view.ts";\nimport "../values.ts";'),
			file(`src/modules/${module}/server/db.ts`, 'import "node:fs";'),
			file(`src/modules/${module}/server/app.ts`, 'import "./db.ts";\nimport "../values.ts";'),
			file(`src/modules/${module}/values.ts`, "export const value = 1;"),
			file(`src/modules/${module}/test-support/setup.ts`, 'import "node:fs";\nwindow.alert("test");\nimport "../client/view.ts";'),
		]),
	];
}

export function brokenModuleImports(directory: string): readonly SeedFile[] {
	return ["users", "admin/users", "admin/teams"].flatMap((module) => [
		{ content: 'import "../server/db.ts";\nimport "node:fs";', path: `${directory}src/modules/${module}/client/broken.ts` },
		{ content: 'export * from "./client/view.ts";\nexport * from "./server/db.ts";', path: `${directory}src/modules/${module}/broken.ts` },
	]);
}
