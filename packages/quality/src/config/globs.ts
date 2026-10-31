import { Effect, Schema } from "effect";
import ignore from "ignore";

const GlobDeclaration = Schema.Struct({
	glob: Schema.NonEmptyString,
	reason: Schema.String.check(Schema.isPattern(/\S/u, { expected: "a reason for this glob" })),
});

export const GlobDeclarations = Schema.Array(GlobDeclaration).pipe(Schema.withDecodingDefaultKey(Effect.succeed([])));

type GlobOptions = Readonly<Record<string, readonly (typeof GlobDeclaration.Type)[]>>;

export function globPatterns(declarations: readonly (typeof GlobDeclaration.Type)[]): readonly string[] {
	return declarations.map(({ glob }) => glob);
}

function matchesIgnorePattern(file: string, glob: string): boolean {
	const result = ignore().add(glob).test(file);
	return result.ignored || result.unignored;
}

export function validateGlobs(
	{ files, options }: { readonly files: readonly string[]; readonly options: GlobOptions },
	matches: (file: string, glob: string) => boolean = matchesIgnorePattern,
): readonly string[] {
	return Object.entries(options).flatMap(([option, declarations]) =>
		declarations.flatMap(({ glob }, index) =>
			files.some((file) => matches(file, glob)) ? [] : [`${option}.${index}.glob: "${glob}" matches no current file. Remove the stale glob.`],
		),
	);
}
