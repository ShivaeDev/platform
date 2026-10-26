import { Schema } from "effect";
import { requireThat } from "#error.ts";
import { Bump, type Source } from "#model.ts";
import { type Entry, parseBody } from "#sections.ts";
export interface Changeset extends Source {
	readonly entries: readonly Entry[];
	readonly packages: Readonly<Record<string, Bump>>;
}
function scalar(value: string): string {
	if (value.startsWith('"')) {
		return Schema.decodeUnknownSync(Schema.fromJsonString(Schema.String))(value);
	}
	return value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1).replaceAll("''", "'") : value;
}
export function parseChangeset(source: Source): Changeset {
	const match = /^---\n(?<header>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(source.text.replaceAll("\r\n", "\n"));
	requireThat(match !== null, `${source.name}: add YAML frontmatter between --- lines, mapping package names to patch, minor or major.`);
	const packages: Record<string, Bump> = {};
	for (const line of (match?.groups?.header ?? "").split("\n")) {
		if (line.trim() === "" || line.trimStart().startsWith("#")) {
			continue;
		}
		const mapping = /^\s*(?<name>"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s:'"{}[\],#]+)\s*:\s*(?<bump>"[^"]*"|'[^']*'|[^\s#]+)\s*(?:#.*)?$/u.exec(line);
		requireThat(mapping !== null, `${source.name}: use one YAML package: bump mapping per line, for example '"@scope/pkg": minor'.`);
		const name = scalar(mapping?.groups?.name ?? "");
		const bump = scalar(mapping?.groups?.bump ?? "");
		requireThat(name !== "" && !Object.hasOwn(packages, name), `${source.name}: name each package once in frontmatter.`);
		requireThat(Schema.is(Bump)(bump), `${source.name}: ${name} needs an explicit patch, minor or major bump.`);
		packages[name] = Schema.decodeUnknownSync(Bump)(bump);
	}
	requireThat(Object.keys(packages).length > 0, `${source.name}: name at least one package and its explicit bump in frontmatter.`);
	return { ...source, entries: parseBody(source.name, match?.groups?.body ?? ""), packages };
}
