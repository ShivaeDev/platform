import { Effect, Schema } from "effect";
import { ChangesetError } from "#error.ts";
import { Bump, type Source } from "#model.ts";
import { type Entry, parseBody } from "#sections.ts";
export interface Changeset extends Source {
	readonly entries: readonly Entry[];
	readonly packages: Readonly<Record<string, Bump>>;
}
const scalar = Effect.fn("Changesets.scalar")(function* (value: string) {
	if (value.startsWith('"')) {
		return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.String))(value).pipe(
			Effect.mapError((cause) => new ChangesetError({ cause, message: cause.message })),
		);
	}
	return value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1).replaceAll("''", "'") : value;
});
export const parseChangeset = Effect.fn("Changesets.parseChangeset")(function* (source: Source) {
	const match = /^---\n(?<header>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(source.text.replaceAll("\r\n", "\n"));
	if (match === null) {
		return yield* new ChangesetError({
			message: `${source.name}: add YAML frontmatter between --- lines, mapping package names to patch, minor or major.`,
		});
	}
	const packages = yield* parseHeader(source.name, match.groups?.header ?? "");
	return {
		...source,
		entries: yield* parseBody(source.name, match.groups?.body ?? ""),
		packages,
	} satisfies Changeset;
});

const parseHeader = Effect.fn("Changesets.parseHeader")(function* (file: string, header: string) {
	const packages: Record<string, Bump> = {};
	for (const line of header.split("\n")) {
		if (line.trim() === "" || line.trimStart().startsWith("#")) {
			continue;
		}
		const mapping = /^\s*(?<name>"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s:'"{}[\],#]+)\s*:\s*(?<bump>"[^"]*"|'[^']*'|[^\s#]+)\s*(?:#.*)?$/u.exec(line);
		if (mapping === null) {
			return yield* new ChangesetError({
				message: `${file}: use one YAML package: bump mapping per line, for example '"@scope/pkg": minor'.`,
			});
		}
		const name = yield* scalar(mapping.groups?.name ?? "");
		const bump = yield* scalar(mapping.groups?.bump ?? "");
		if (name === "" || Object.hasOwn(packages, name)) {
			return yield* new ChangesetError({ message: `${file}: name each package once in frontmatter.` });
		}
		if (!Schema.is(Bump)(bump)) {
			return yield* new ChangesetError({ message: `${file}: ${name} needs an explicit patch, minor or major bump.` });
		}
		packages[name] = bump;
	}
	if (Object.keys(packages).length === 0) {
		return yield* new ChangesetError({ message: `${file}: name at least one package and its explicit bump in frontmatter.` });
	}
	return packages;
});
