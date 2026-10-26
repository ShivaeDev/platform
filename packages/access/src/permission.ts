export interface Permission {
	readonly name: string;
	readonly strength: "own" | "any";
}

export interface OwnPermission extends Permission {
	readonly any: Permission;
	readonly strength: "own";
}

export function permission<const TName extends `${string}.${string}`>(name: TName) {
	return { any: { name, strength: "any" }, name, strength: "own" } as const;
}
