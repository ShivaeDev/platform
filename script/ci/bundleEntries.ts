import { join } from "node:path";
import { bins, type Manifest, targets } from "#package-check/model.ts";

export function bundleEntries(directory: string, manifest: Manifest): Readonly<Record<string, string>> {
	const paths = [...Object.values(manifest.exports ?? {}).flatMap(targets), ...Object.values(bins(manifest))];
	return Object.fromEntries(
		[...new Set(paths)]
			.filter((path) => path.startsWith("./dist/") && path.match(/\.[cm]?js$/u) !== null)
			.map((path) => [path.slice("./dist/".length).replace(/\.[cm]?js$/u, ""), join(directory, path)]),
	);
}
