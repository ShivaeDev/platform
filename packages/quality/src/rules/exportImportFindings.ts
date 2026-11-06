import type { Finding } from "#rule.ts";

function sourceImport(value: unknown): boolean {
	if (value === "./src/*.ts") {
		return true;
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const source = "@shivaedev/source" in value ? "@shivaedev/source" : "source";
	const conditions = { default: "./dist/*.js", [source]: "./src/*.ts", types: "./dist/*.d.ts" };
	return Object.keys(value).length === 3 && Object.entries(conditions).every(([key, target]) => Reflect.get(value, key) === target);
}

function localTestTree(value: unknown): boolean {
	return typeof value === "string" && /^\.\/(?:test|tests|test-support)\/(?:[^*\\]+\/)?\*$/u.test(value) && !value.split("/").includes("..");
}

export function exportImportFindings(file: string, imports: Readonly<Record<string, unknown>> = {}, isPrivate = false): readonly Finding[] {
	return Object.entries(imports).flatMap(([key, value]) => {
		if (key === "#*.ts" && !sourceImport(value)) {
			return [
				{
					file,
					message:
						'Import "#*.ts" must preserve the path from the source root. Map it to "./src/*.ts", or to source "./src/*.ts", types "./dist/*.d.ts" and default "./dist/*.js". Include subfolders in import specifiers, for example "#server/module.ts".',
					subject: key,
				},
			];
		}
		if (key === "#test/*" && value !== "./src/test-support/*" && !(isPrivate && localTestTree(value))) {
			return [
				{
					file,
					message: isPrivate
						? 'Import "#test/*" must map to "./src/test-support/*" or the package’s own test/, tests/ or test-support/ tree.'
						: 'Import "#test/*" must map to "./src/test-support/*". Keep test helpers under the source root’s test-support folder.',
					subject: key,
				},
			];
		}
		return [];
	});
}
