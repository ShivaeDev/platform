import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path } from "effect";
import { type RouterOptions, tanstackRoutes } from "#adapters/tanstackRoutes.ts";
import { SetupFailure } from "#failure.ts";
import { readRequiredText } from "#inventory/filesystem.ts";
import { posix as portable } from "#inventory/ignoreScope.ts";
import { walk } from "#inventory/walk.ts";

const CONFIG = /^(?:tsr\.config\.json|vite\.config\.[cm]?[jt]s)$/u;
const CODE = /\.[jt]sx?$/u;

interface RouteFolder {
	readonly directory: string;
	readonly ignorePattern: RegExp | undefined;
	readonly ignorePrefix: string;
	readonly prefix: string | undefined;
}

function owns(file: string, folder: RouteFolder): boolean {
	if (!(CODE.test(file) && file.startsWith(`${folder.directory}/`))) {
		return false;
	}
	const parts = file.slice(folder.directory.length + 1).split("/");
	return parts.every(
		(part) =>
			!(part.startsWith(".") || (folder.ignorePrefix !== "" && part.startsWith(folder.ignorePrefix)) || folder.ignorePattern?.test(part))
			&& (folder.prefix === undefined || part.startsWith(folder.prefix)),
	);
}

export const routeFiles = Effect.fn("Inventory.routeFiles")(function* (root: string) {
	const { basename, dirname, relative, resolve } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));
	const paths = yield* walk(root);
	const configs = paths
		.filter((path) => CONFIG.test(basename(path)))
		.sort((left, right) => Number(basename(right) === "tsr.config.json") - Number(basename(left) === "tsr.config.json"));
	const byApp = new Map<string, RouterOptions>();
	for (const path of configs) {
		const text = yield* readRequiredText(path);
		const options = yield* Effect.try({
			catch: (cause) => new SetupFailure({ cause, message: `cannot read routes from ${path}: ${String(cause)}` }),
			try: () => tanstackRoutes(path, text),
		});
		for (const option of options) {
			const base = dirname(path);
			byApp.set(base, { ...byApp.get(base), ...option });
		}
	}
	const folders = yield* Effect.try({
		catch: (cause) => new SetupFailure({ cause, message: `cannot resolve TanStack Router folders: ${String(cause)}` }),
		try: () =>
			[...byApp].map(
				([base, options]): RouteFolder => ({
					directory: portable(relative(root, resolve(base, options.routesDirectory ?? "src/routes"))),
					ignorePattern:
						options.routeFileIgnorePattern === undefined || options.routeFileIgnorePattern === ""
							? undefined
							: new RegExp(options.routeFileIgnorePattern, "u"),
					ignorePrefix: options.routeFileIgnorePrefix ?? "-",
					prefix: options.routeFilePrefix,
				}),
			),
	});
	const files = new Set<string>();
	const ownedFolders = new Set<string>();
	for (const absolute of paths) {
		const file = portable(relative(root, absolute));
		const folder = folders.find((candidate) => owns(file, candidate));
		if (folder === undefined) {
			continue;
		}
		files.add(file);
		for (let current = dirname(file); current.startsWith(`${folder.directory}/`) || current === folder.directory; current = dirname(current)) {
			ownedFolders.add(current);
		}
	}
	return { files, folders: ownedFolders };
});
