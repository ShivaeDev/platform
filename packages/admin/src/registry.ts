import { RpcGroup } from "effect/rpc";
import type { AdminPage } from "./page.ts";

export interface AdminRegistry<TPages extends readonly AdminPage[]> {
	readonly group: RpcGroup.RpcGroup<RpcGroup.Rpcs<TPages[number]["contract"]>>;
	readonly pages: TPages;
}

export function adminRegistry<const TPages extends readonly AdminPage[]>(...pages: TPages): AdminRegistry<TPages> {
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
