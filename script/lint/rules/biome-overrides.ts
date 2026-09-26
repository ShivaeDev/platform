import { Result, Schema } from "effect";
import { jsonDecoder } from "#lint/adapters/json.ts";
import type { Inventory } from "#lint/inventory.ts";
import { decodeRegistry, REGISTRY_FILE, type RegistryEntry } from "#lint/registry.ts";
import type { Violation } from "#lint/violation.ts";

const BIOME_FILE = "biome.json";
const RuleGroups = Schema.Record(Schema.String, Schema.Unknown);
const decodeBiome = jsonDecoder(
	Schema.Struct({
		overrides: Schema.optional(
			Schema.Array(
				Schema.Struct({
					includes: Schema.optional(Schema.Array(Schema.String)),
					linter: Schema.optional(Schema.Struct({ rules: Schema.optional(RuleGroups) })),
				}),
			),
		),
	}),
);

interface Waiver {
	readonly file: string;
	readonly pragma: string;
}

const isOff = (setting: unknown): boolean =>
	setting === "off" || (typeof setting === "object" && setting !== null && "level" in setting && setting.level === "off");

const disabledRules = (groups: Readonly<Record<string, unknown>>): readonly string[] =>
	Object.entries(groups).flatMap(([group, rules]) =>
		typeof rules === "object" && rules !== null
			? Object.entries(rules).flatMap(([rule, setting]) => (isOff(setting) ? [`biome:${group}/${rule}`] : []))
			: [],
	);

const matches = (waiver: Waiver) => (entry: RegistryEntry) => entry.file === waiver.file && entry.pragma === waiver.pragma;

const unregistered = (waiver: Waiver): Violation => ({
	file: BIOME_FILE,
	line: undefined,
	message: `override turns "${waiver.pragma}" off for "${waiver.file}" without a registry entry. Every lint escape is enumerated, with a reason, in ${REGISTRY_FILE}.`,
	rule: "biome-overrides/unregistered",
});

const stale = (entry: RegistryEntry): Violation => ({
	file: REGISTRY_FILE,
	line: undefined,
	message: `entry "${entry.pragma}" for "${entry.file}" matches no override in ${BIOME_FILE}. Remove it.`,
	rule: "biome-overrides/stale",
});

export const biomeOverrideViolations = (inventory: Inventory): readonly Violation[] => {
	const biome = decodeBiome(inventory.biomeConfig);
	if (Result.isFailure(biome)) {
		return [{ file: BIOME_FILE, line: undefined, message: "is not a readable Biome configuration.", rule: "biome-overrides/unreadable" }];
	}
	const registry = decodeRegistry(inventory.pragmaRegistry);
	if (Result.isFailure(registry)) {
		return [];
	}
	const waivers: readonly Waiver[] = (biome.success.overrides ?? []).flatMap((override) =>
		disabledRules(override.linter?.rules ?? {}).flatMap((pragma) => (override.includes ?? []).map((file) => ({ file, pragma }))),
	);
	const entries = registry.success.filter((entry) => entry.pragma.startsWith("biome:"));
	return [
		...waivers.filter((waiver) => !entries.some(matches(waiver))).map(unregistered),
		...entries.filter((entry) => !waivers.some((waiver) => matches(waiver)(entry))).map(stale),
	];
};
