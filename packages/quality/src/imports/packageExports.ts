export function exportEntry(exports: unknown, subpath: string): readonly [string, unknown] | undefined {
	if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
		return undefined;
	}
	const entries = Object.entries(exports);
	const exact = entries.find(([key]) => key === subpath);
	if (exact !== undefined) {
		return exact;
	}
	const matching = entries.filter(([key]) => {
		const [prefix = "", suffix, ...rest] = key.split("*");
		return (
			suffix !== undefined
			&& rest.length === 0
			&& subpath.length > prefix.length + suffix.length
			&& subpath.startsWith(prefix)
			&& subpath.endsWith(suffix)
		);
	});
	return matching.toSorted(([left], [right]) => right.indexOf("*") - left.indexOf("*") || right.length - left.length)[0];
}

export function blockedExport(exports: unknown, subpath: string): boolean {
	return exportEntry(exports, subpath)?.[1] === null;
}

export function exportTargets(value: unknown): string[] {
	if (typeof value === "string") {
		return [value];
	}
	return typeof value === "object" && value !== null ? Object.values(value).flatMap(exportTargets) : [];
}

export function exportedModule(exports: unknown, local: string): boolean {
	if (typeof exports !== "object" || exports === null) {
		return false;
	}
	const paths = [
		`./${local}`,
		`./${local.replace(/^src\//u, "dist/").replace(/\.(?<mode>[cm]?)tsx?$/u, ".$<mode>js")}`,
		`./${local.replace(/^src\//u, "dist/").replace(/\.(?<mode>[cm]?)tsx?$/u, ".d.$<mode>ts")}`,
	];
	return Object.entries(exports).some(([key, value]) =>
		exportTargets(value).some((target) =>
			paths.some((path) => {
				const [prefix = "", suffix] = target.split("*");
				if (suffix === undefined) {
					return path === target && !blockedExport(exports, key);
				}
				if (!(path.startsWith(prefix) && path.endsWith(suffix)) || path.length <= prefix.length + suffix.length) {
					return false;
				}
				const star = path.slice(prefix.length, path.length - suffix.length);
				return !blockedExport(exports, key.replace("*", star));
			}),
		),
	);
}
