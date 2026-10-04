import type { OwnExport } from "#naming/ownExports.ts";

export function mainExport(exports: readonly OwnExport[]): OwnExport | undefined {
	const values = exports.filter((entry) => entry.kind === "value");
	const types = exports.filter((entry) => entry.kind === "type");
	const [value] = values;
	if (values.length === 1 && value !== undefined && types.every((type) => type.name.startsWith(value.name))) {
		return value;
	}
	return values.length === 0 && types.length === 1 ? types[0] : undefined;
}
