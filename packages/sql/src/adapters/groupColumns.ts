import type { Schema } from "effect";
import { Predicate, SchemaAST } from "effect";
import type { SqlNameTransforms } from "#clientOptions.ts";

interface Column {
	readonly column: string;
	readonly key: string;
	readonly member: PropertyKey | undefined;
}

export function groupColumns(fields: Schema.Struct.Fields, keys: readonly string[] = Object.keys(fields)): Column[] {
	return keys.flatMap<Column>((key) => {
		const ast = fields[key]?.ast;
		const prefix = ast?.annotations?.["@shivaedev/sql/groupPrefix"];
		return typeof prefix === "string" && ast !== undefined && SchemaAST.isObjects(ast)
			? ast.propertySignatures.map((field) => ({ column: `${prefix}${String(field.name)}`, key, member: field.name }))
			: [{ column: key, key, member: undefined }];
	});
}

export function rowMapping(fields: Schema.Struct.Fields, names?: SqlNameTransforms) {
	const columns = groupColumns(fields);
	function returnedName(column: string) {
		return names?.transformResultNames?.(names.transformQueryNames?.(column) ?? column) ?? column;
	}
	const seen = new Set<string>();
	for (const { column } of columns) {
		if (seen.has(column)) {
			throw new Error(`Duplicate grouped column: ${column}`);
		}
		seen.add(column);
	}
	return {
		expand: (row: Readonly<Record<string, unknown>>) => {
			const expanded: Record<string, unknown> = { ...row };
			for (const { key, member, column } of columns) {
				if (member !== undefined && Object.hasOwn(row, returnedName(column))) {
					const held = expanded[key];
					expanded[key] = { ...(typeof held === "object" && held !== null ? held : {}), [member]: row[returnedName(column)] };
					delete expanded[returnedName(column)];
				}
			}
			return expanded;
		},
		flatten: (row: unknown) => {
			const flat: Record<string, unknown> = {};
			if (!Predicate.isObject(row)) {
				return flat;
			}
			for (const { key, member, column } of columns) {
				if (!Object.hasOwn(row, key)) {
					continue;
				}
				if (member === undefined) {
					flat[column] = row[key];
					continue;
				}
				const value = row[key];
				if (Predicate.isObject(value) && Object.hasOwn(value, member)) {
					flat[column] = Reflect.get(value, member);
				}
			}
			return flat;
		},
	};
}
