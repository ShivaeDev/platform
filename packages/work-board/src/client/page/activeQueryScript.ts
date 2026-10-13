import { routeQueryOptions } from "./routeQuery.ts";
export function activeQueryScript() {
	return `const activeQuery = (native, doc, path) => {
 const kind = doc.dataset.projection || "document";
 if (kind === "changes") return native.api.history.query({ action: "compare", baseline: doc.querySelector("[data-baseline]")?.dataset.baseline || null });
 return native.api[kind].query(["overview", "inbox", "start", "diagnostics"].includes(kind) ? undefined : { url: path }, ${JSON.stringify(routeQueryOptions)});
};`;
}
