import type { ExceptionDeclaration } from "./declaration.ts";
import type { RegistryEntry } from "./registry.ts";

export function registryEntries(declarations: readonly ExceptionDeclaration[]): readonly RegistryEntry[] {
	return declarations.flatMap(({ files, reason, rules, subject }) =>
		rules
			.filter((rule) => !rule.startsWith("biome/"))
			.flatMap((rule) => files.map((file) => ({ file, reason, rule, ...(subject === undefined ? {} : { subject }) }))),
	);
}
