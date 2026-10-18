import { biomeOverrides } from "#rules/suppressions/biomeOverrides.ts";
import { checkRule } from "#test/inputs.ts";

export const PACKAGE = "node_modules/@acme/lint";

export function weak(rule: string): string {
	return JSON.stringify({ linter: { rules: { suspicious: { [rule]: "off" } } } });
}

export function extending(...entries: readonly string[]): string {
	return JSON.stringify({ extends: entries });
}

export async function found(texts: Readonly<Record<string, string>>): Promise<readonly string[]> {
	return (await checkRule(biomeOverrides, undefined, { texts })).map(
		(finding) => `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`} ${finding.message}`,
	);
}

export async function resolvedRule(specifier: string, manifest: object, files: Readonly<Record<string, string>>): Promise<readonly string[]> {
	return (
		await found({
			"biome.json": extending(specifier),
			[`${PACKAGE}/package.json`]: JSON.stringify({ name: "@acme/lint", ...manifest }),
			...Object.fromEntries(Object.entries(files).map(([path, text]) => [`${PACKAGE}/${path}`, text])),
		})
	).map((line) => /weakens "lint\/suspicious\/(?<rule>\w+)"/u.exec(line)?.groups?.rule ?? line);
}
