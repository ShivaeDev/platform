// An import the generated file needs; the file gives each distinct one a local name and writes the import once.
export interface ImportRef {
	readonly name: string;
	readonly preferred: string;
	readonly specifier: string;
	readonly typeOnly: boolean;
}

export type Code = readonly (string | ImportRef)[];

export const SCHEMA: ImportRef = { name: "Schema", preferred: "Schema", specifier: "effect", typeOnly: false };

function isCode(part: string | ImportRef | Code): part is Code {
	return Array.isArray(part);
}

export function code(...parts: readonly (string | ImportRef | Code)[]): Code {
	return parts.flatMap((part) => (isCode(part) ? part : [part]));
}

export function joined(items: readonly Code[], separator: string): Code {
	return items.flatMap((item, index) => (index === 0 ? item : [separator, ...item]));
}
