import { Effect } from "effect";
import type { Level } from "../config.ts";
import type { Decoded } from "../decoded.ts";
import type { ActiveRule } from "../engine/run-rules.ts";
import { covers, type RuleIndex } from "../engine/violation.ts";
import type { Rule } from "../rule.ts";
import { builtInRules } from "../rules/built-in.ts";
import type { ConfigInput } from "./decode.ts";

export interface ResolvedRules extends RuleIndex {
	readonly active: readonly ActiveRule[];
}

type Setting = NonNullable<ConfigInput["rules"]>[string];

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const levelOf = (setting: Setting | undefined): Level => (typeof setting === "string" ? setting : (setting?.level ?? "error"));

const optionsOf = (setting: Setting | undefined): unknown => (typeof setting === "object" ? setting.options : undefined);

const duplicateIssues = (rules: readonly Rule[]): readonly string[] =>
	rules.flatMap((rule, index) =>
		rules.findIndex((other) => other.id === rule.id) === index ? [] : [`local: rule id "${rule.id}" is already defined`],
	);

const activate = (rule: Rule, setting: Setting | undefined): Effect.Effect<Decoded<ActiveRule | undefined>> => {
	const level = levelOf(setting);
	if (level === "off") {
		return Effect.succeed({ _tag: "Valid", value: undefined });
	}
	return Effect.tryPromise({ catch: messageOf, try: () => rule.configure(optionsOf(setting)) }).pipe(
		Effect.map(
			(configured): Decoded<ActiveRule | undefined> =>
				configured._tag === "Invalid"
					? { _tag: "Invalid", issues: configured.issues.map((issue) => `rules.${rule.id}.options: ${issue}`) }
					: { _tag: "Valid", value: { check: configured.check, description: rule.description, family: rule.family === true, id: rule.id, level } },
		),
		Effect.catch((failure: string) =>
			Effect.succeed<Decoded<ActiveRule | undefined>>({ _tag: "Invalid", issues: [`rules.${rule.id}.options: validation threw: ${failure}`] }),
		),
	);
};

export const resolveRules = (config: ConfigInput): Effect.Effect<Decoded<ResolvedRules>> =>
	Effect.gen(function* () {
		const rules: readonly Rule[] = [...builtInRules, ...(config.local ?? [])];
		const settings = config.rules ?? {};
		const known = new Set(rules.map((rule) => rule.id));
		const families = new Set(rules.filter((rule) => rule.family === true).map((rule) => rule.id));
		const adoptable = (id: string): boolean => known.has(id) || [...families].some((family) => covers(family, id));
		const unknown = [
			...Object.keys(settings)
				.filter((id) => !known.has(id))
				.map((id) => `rules.${id}`),
			...(config.adopt ?? []).filter((id) => !adoptable(id)).map((id) => `adopt.${id}`),
		].map((path) => `${path}: no built-in or local rule has this id`);
		const activated = yield* Effect.forEach(rules, (rule) => activate(rule, settings[rule.id]));
		const issues = [...duplicateIssues(rules), ...unknown, ...activated.flatMap((result) => (result._tag === "Invalid" ? result.issues : []))];
		if (issues.length > 0) {
			return { _tag: "Invalid", issues };
		}
		const active = activated.flatMap((result) => (result._tag === "Valid" && result.value !== undefined ? [result.value] : []));
		const levels = new Map(rules.map((rule) => [rule.id, levelOf(settings[rule.id])]));
		const unregistrable = new Set(rules.filter((rule) => rule.registrable === false).map((rule) => rule.id));
		return { _tag: "Valid", value: { active, families, levels, unregistrable } };
	});
