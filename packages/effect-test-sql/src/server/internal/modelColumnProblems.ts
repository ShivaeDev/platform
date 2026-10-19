import type { PostgresColumn } from "#migrationUpgrade.ts";

interface NameTransforms {
	readonly transformQueryNames?: ((name: string) => string) | undefined;
	readonly transformResultNames?: ((name: string) => string) | undefined;
}

export function modelColumnProblems(
	columns: readonly PostgresColumn[],
	fields: object,
	expectedTypes: Readonly<Record<string, string>>,
	transforms: NameTransforms | undefined,
): readonly string[] {
	const queryFields = new Map(Object.keys(fields).map((name) => [transforms?.transformQueryNames?.(name) ?? name, name]));
	function fieldName(name: string) {
		return queryFields.get(name) ?? transforms?.transformResultNames?.(name) ?? name;
	}
	function columnKey(name: string) {
		return transforms?.transformQueryNames === undefined ? fieldName(name) : name;
	}
	const actual = new Map(columns.map(({ name, type }) => [columnKey(name), type]));
	const problems: string[] = [];
	for (const name of Object.keys(fields)) {
		const type = actual.get(transforms?.transformQueryNames?.(name) ?? name);
		if (type === undefined) {
			problems.push(`Missing column: ${name}`);
		} else if (type !== expectedTypes[name]) {
			problems.push(`Wrong type for ${name}: expected ${expectedTypes[name]}, received ${type}`);
		}
		if (!Object.hasOwn(expectedTypes, name)) {
			problems.push(`Missing expected PostgreSQL type: ${name}`);
		}
	}
	for (const column of columns) {
		if (!queryFields.has(columnKey(column.name))) {
			problems.push(`Extra column: ${fieldName(column.name)}`);
		}
	}
	for (const name of Object.keys(expectedTypes)) {
		if (!Object.hasOwn(fields, name)) {
			problems.push(`Extra expected PostgreSQL type: ${name}`);
		}
	}
	return problems;
}
