import { exportsPackage } from "#test/exportsPackage.ts";
import { FILE_PATH_EXPORTS } from "#testing/adapters/packageExports.ts";

export const RUNTIME_MANIFEST = "packages/runtime/package.json";

export function publishedTestingFiles(fields: Readonly<Record<string, unknown>> = {}, module?: string) {
	return [
		exportsPackage({ exports: FILE_PATH_EXPORTS, name: "@acme/runtime", ...fields }, RUNTIME_MANIFEST),
		...(module === undefined ? [] : [{ content: "export const helper = 1;\n", path: `packages/runtime/src/${module}` }]),
	];
}
