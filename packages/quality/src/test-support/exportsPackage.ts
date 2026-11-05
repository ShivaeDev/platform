import sortPackageJson from "sort-package-json";
import type { SeedFile } from "#testing/adapters/tree.ts";

export const SOURCE_EXPORTS = { "./*.ts": "./src/*.ts" };

export function exportsPackage(fields: Readonly<Record<string, unknown>>, path: string): SeedFile {
	return {
		content: sortPackageJson(
			`${JSON.stringify({
				exports: SOURCE_EXPORTS,
				imports: { "#*.ts": "./src/*.ts", "#test/*": "./src/test-support/*" },
				name: "@acme/library",
				...fields,
			})}\n`,
		),
		path,
	};
}
