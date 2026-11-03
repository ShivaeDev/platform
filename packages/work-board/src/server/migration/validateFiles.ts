import { Effect } from "effect";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import type { MetadataDocument } from "#integration/metadata.ts";
import { metadataParse } from "#metadata/adapters/parse.ts";
import { sourceValue } from "#server/migration/adapters/sourceValue.ts";

export function validateFiles(
	files: readonly { readonly file: string; readonly source: string }[],
): Effect.Effect<readonly MetadataDocument[], BadRequest> {
	const documents = files.map(({ file, source }) => ({ file, parsed: metadataParse(source), source }));
	const problems = documents.flatMap(({ file, parsed, source }) =>
		parsed.diagnostics.map((problem) => {
			const field = problem.field ?? "frontmatter";
			const value = sourceValue(source, field);
			return `${file}: ${field}: ${value}: ${problem.message}`;
		}),
	);
	return problems.length > 0
		? Effect.fail(new BadRequest({ message: `Cannot migrate Board; no files changed.\n${problems.join("\n")}` }))
		: Effect.succeed(documents);
}
