import { posix } from "node:path";
import { defineRule, type Finding } from "#rule.ts";

const CODE = /\.(?<mode>[cm]?)[jt]sx?$/u;

function sourcesByPath(files: readonly string[]): ReadonlyMap<string, readonly string[]> {
	const sources = new Map<string, readonly string[]>();
	function add(path: string, source: string) {
		const known = sources.get(path) ?? [];
		sources.set(path, known.includes(source) ? known : [...known, source]);
	}
	for (const file of files) {
		add(file.replace(CODE, ".$<mode>js"), file);
		for (let folder = posix.dirname(file); folder !== "."; folder = posix.dirname(folder)) {
			add(folder, folder);
		}
	}
	return sources;
}

function collisionsOf(paths: Iterable<string>): ReadonlyMap<string, readonly string[]> {
	const groups = new Map<string, readonly string[]>();
	for (const path of paths) {
		const key = path.toLowerCase();
		groups.set(key, [...(groups.get(key) ?? []), path]);
	}
	return new Map([...groups].filter(([, group]) => group.length > 1));
}

function message(source: string, others: readonly string[]): string {
	const names = others.map((other) => `"${posix.basename(other)}"`).join(", ");
	return `"${posix.basename(source)}" and ${names} differ only by case, in their names or in the files they build to, so they are one path on a case-insensitive filesystem such as macOS or Windows. Rename one of them.`;
}

export const distinctCase = defineRule({
	check: ({ files }) => {
		const sources = sourcesByPath(files);
		const collisions = collisionsOf(sources.keys());
		return [...collisions]
			.filter(([key]) => !collisions.has(posix.dirname(key)))
			.flatMap(([, group]): readonly Finding[] => {
				const all = group.flatMap((path) => sources.get(path) ?? []).sort();
				return all.map((source) => ({
					file: source,
					message: message(
						source,
						all.filter((other) => other !== source),
					),
				}));
			});
	},
	description: "No two paths, or the files they build to, differ only by case, so a checkout and a build work on a case-insensitive filesystem.",
	id: "files/distinct-case",
});
