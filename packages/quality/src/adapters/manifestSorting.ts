import { sortPackageJson } from "sort-package-json";

export type Sorting = { readonly _tag: "Sorted" } | { readonly _tag: "Unsorted"; readonly sorted: string };

export function sortingOf(text: string): Sorting {
	const sorted = sortPackageJson(text);
	return sorted === text ? { _tag: "Sorted" } : { _tag: "Unsorted", sorted };
}
