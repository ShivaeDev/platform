import { FILE_PATH_EXPORTS } from "@shivaedev/test-kits/quality/adapters/packageExports.ts";
import { exportsPackage } from "./exportsPackage.ts";

export const RUNTIME_MANIFEST = "packages/runtime/package.json";

export function publishedTestingFiles(fields: Readonly<Record<string, unknown>> = {}, module?: string) {
	return [
		exportsPackage({ exports: FILE_PATH_EXPORTS, name: "@acme/runtime", ...fields }, RUNTIME_MANIFEST),
		...(module === undefined ? [] : [{ content: "export const helper = 1;\n", path: `packages/runtime/src/${module}` }]),
	];
}
