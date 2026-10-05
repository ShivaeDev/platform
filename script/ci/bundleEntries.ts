import { posix } from "node:path";
import { exportTargets } from "#package-check/exports.ts";
import { bins, type Manifest } from "#package-check/model.ts";

const SCRIPT = /\.[cm]?js$/u;

export function bundleEntries(manifest: Manifest, packed: ReadonlySet<string>): Readonly<Record<string, string>> {
	const paths = [...exportTargets(manifest, packed), ...Object.values(bins(manifest))].map((path) => posix.normalize(path));
	return Object.fromEntries(
		[...new Set(paths)]
			.filter((path) => path.startsWith("dist/") && SCRIPT.test(path) && packed.has(path))
			.toSorted((left, right) => left.localeCompare(right))
			.map((path) => [path.slice("dist/".length).replace(SCRIPT, ""), path]),
	);
}
