import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { pageQueries } from "./pageQueries.ts";
import type { ShellApi } from "./ShellApi.ts";

export function retryPage(api: ShellApi, registry: AtomRegistry.AtomRegistry, url: string) {
	const doc = document.getElementById("doc");
	const queries = pageQueries(api, doc?.dataset.projection ?? "document", url);
	if (Number(doc?.dataset.status ?? 200) < 400 && !queries.some((query) => registry.get(query)._tag === "Failure")) {
		return false;
	}
	for (const query of queries) {
		registry.refresh(query);
	}
	return true;
}
