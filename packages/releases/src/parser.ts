import { Effect, Schema } from "effect";
import { ChangesetError } from "#error.ts";
import { Bump, type Source } from "#model.ts";
import { type Entry, parseBody } from "#sections.ts";
export const packageAttribution = /^- `(?<package>(?:@[^`/\s]+\/)?[^`/\s]+)`: /mu;
export interface Changeset extends Source {
	readonly entries: readonly (Entry & { readonly package: string })[];
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
		entries: yield* attributeEntries(source.name, yield* parseBody(source.name, match.groups?.body ?? ""), Object.keys(packages)),
		packages,
	} satisfies Changeset;
});

const attributeEntries = Effect.fn("Changesets.attributeEntries")(function* (file: string, entries: readonly Entry[], packages: readonly string[]) {
	return yield* Effect.forEach(entries, (entry) =>
		Effect.gen(function* () {
			const attribution = packageAttribution.exec(entry.text);
			const name = attribution?.groups?.package ?? (packages.length === 1 ? packages[0] : undefined);
			if (name === undefined || !packages.includes(name)) {
				return yield* new ChangesetError({
					message: `${file}: attribute each bullet to one package named in frontmatter with '- \`package-name\`: text'; found ${entry.text.split("\n")[0]}.`,
				});
			}
			const text = attribution === null ? entry.text : `- ${entry.text.slice(attribution[0].length)}`;
			if (text.slice(2).trim() === "") {
				return yield* new ChangesetError({ message: `${file}: write text after the package attribution.` });
			}
			return { ...entry, package: name, text };
		}),
	);
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
