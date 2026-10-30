import { RpcGroup } from "effect/rpc";
import type { AdminPage } from "./page.ts";

export interface AdminRegistry<TPages extends readonly AdminPage[]> {
	readonly group: RpcGroup.RpcGroup<RpcGroup.Rpcs<TPages[number]["contract"]>>;
	readonly pages: TPages;
}

export interface AnyAdminRegistry {
	readonly group: RpcGroup.Any;
	readonly pages: readonly AdminPage[];
}

export type UniquePageIds<TPages extends readonly AdminPage[], TSeen extends string = never> = TPages extends readonly [
	infer TPage extends AdminPage,
	...infer TRest extends readonly AdminPage[],
]
	? TPage["id"] extends TSeen
		? never
		: UniquePageIds<TRest, TSeen | TPage["id"]>
	: unknown;

export type RegistryPages<TRegistries extends readonly AnyAdminRegistry[]> = TRegistries extends readonly [
	infer TFirst extends AnyAdminRegistry,
	...infer TRest extends readonly AnyAdminRegistry[],
]
	? readonly [...TFirst["pages"], ...RegistryPages<TRest>]
	: number extends TRegistries["length"]
		? readonly TRegistries[number]["pages"][number][]
		: readonly [];

export function mergeAdminRegistries<const TRegistries extends readonly AnyAdminRegistry[]>(
	...registries: TRegistries & UniquePageIds<RegistryPages<TRegistries>>
): AdminRegistry<RegistryPages<TRegistries>>;
export function mergeAdminRegistries(...registries: readonly AnyAdminRegistry[]) {
	return adminRegistry(...registries.flatMap((registry) => registry.pages));
}

export function adminRegistry<const TPages extends readonly AdminPage[]>(...pages: TPages & UniquePageIds<TPages>): AdminRegistry<TPages> {
	const ids = new Set<string>();
	const paths = new Set<string>();
	const tags = new Set<string>();
	function unique(seen: Set<string>, value: string, kind: string) {
		if (seen.has(value)) {
			throw new Error(`Duplicate admin ${kind}: ${value}`);
		}
		seen.add(value);
	}
	for (const page of pages) {
		unique(ids, page.id, "page id");
		unique(paths, page.route.path, "path");
		for (const tag of page.contract.requests.keys()) {
			unique(tags, tag, "RPC tag");
		}
	}
	return { group: RpcGroup.make().merge(...pages.map((page) => page.contract)), pages };
}
