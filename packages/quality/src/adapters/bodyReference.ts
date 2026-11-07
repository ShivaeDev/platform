export interface BodyReference {
	readonly file?: string | undefined;
	readonly kind: "data" | "import" | "service" | "told";
	readonly module: string;
	readonly path: readonly string[];
}

export function dataFactory({ module, path }: BodyReference): boolean {
	return (module === "effect" && (path[0] === "Schema" || path[0] === "Data")) || module === "effect/Schema" || module === "effect/Data";
}

export function serviceFactory({ module, path }: BodyReference): boolean {
	return (
		(module === "@shivaedev/service/adapters/defineService.ts" && path[0] === "defineService")
		|| ((module === "effect" || module === "effect/Context")
			&& path.at(-1) !== undefined
			&& ["Service", "Tag", "GenericTag", "Reference"].includes(path.at(-1) ?? ""))
	);
}
