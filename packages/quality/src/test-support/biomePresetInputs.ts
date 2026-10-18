import { biomeOverrides } from "#rules/suppressions/biomeOverrides.ts";
import { checkRule } from "#test/inputs.ts";

export type Options = Parameters<typeof biomeOverrides.configure>[0];

export const REASON = "Tools load their config files through the default export.";

export const PACKAGE = "node_modules/@acme/lint";

export function manifest(exports: unknown) {
	return JSON.stringify({ exports, name: "@acme/lint" });
}

export function off(group: string, rule: string) {
	return { linter: { rules: { [group]: { [rule]: "off" } } } };
}

export function presetTexts(preset: unknown, declarations?: unknown): Readonly<Record<string, string>> {
	return {
		[`${PACKAGE}/package.json`]: manifest({ "./biome": { biome: "./biome/biome.json", default: "./biome/other.json" } }),
		[`${PACKAGE}/biome/biome.json`]: JSON.stringify(preset),
		...(declarations === undefined ? {} : { [`${PACKAGE}/biome/declarations.json`]: JSON.stringify(declarations) }),
	};
}

export function consumer(config: object) {
	return JSON.stringify({ extends: ["@acme/lint/biome"], ...config }, null, "\t");
}

export async function check(texts: Readonly<Record<string, string>>, options?: Options, files?: readonly string[]) {
	return (await checkRule(biomeOverrides, options, { files: files ?? [], texts })).map(
		(finding) => `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`} ${finding.message}`,
	);
}

export function withPreset(preset: unknown, declarations: unknown, config: object, options?: Options) {
	return check({ ...presetTexts(preset, declarations), "biome.json": consumer(config) }, options);
}

export function declaring(rule: string, ...includes: readonly [string, ...string[]]): Options {
	return { declared: [{ includes, reason: REASON, rule }] };
}
