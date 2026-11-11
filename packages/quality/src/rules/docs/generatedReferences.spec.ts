import { docsReferences } from "#rules/docs/references.ts";
import { docsWorkspace, markdown, noModule } from "#test/docsRepository.ts";
import { generatedDeclared, importStory, repositoryHas } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const GENERATED = "packages/lib/src/generated";

// The generator writes the client after checkout, so the README names a file that is not on disk yet.
const README = markdown(
	"packages/lib/README.md",
	"# @acme/lib",
	"",
	"Browser code imports `Notes` from `@acme/lib/generated/Notes.ts`.",
	"",
	"[The generated client](src/generated/Notes.ts) holds no server code.",
);

const REPOSITORY = repositoryHas(...docsWorkspace, { content: "Written by `pnpm generate`.\n", path: `${GENERATED}/README.md` }, README);

importStory.it(
	"docs/references accepts a README's module path and link into a declared generated folder before the generator writes the file",
	[REPOSITORY, generatedDeclared(GENERATED)],
	function* ({ check }) {
		yield* assertThat(yield* check(docsReferences), (actual) => actual.toEqual([]));
	},
);

importStory.it(
	"docs/references reports a README's module path and link into a folder nobody declared generated",
	[REPOSITORY],
	function* ({ check }) {
		yield* assertThat(yield* check(docsReferences), (actual) =>
			actual.toEqual([
				{ file: README.path, line: 3, message: noModule("@acme/lib/generated/Notes.ts", "@acme/lib"), subject: "@acme/lib/generated/Notes.ts" },
				{
					file: README.path,
					line: 5,
					message: `"src/generated/Notes.ts" links to ${GENERATED}/Notes.ts, which does not exist. Link to the file's current path, or remove the link.`,
					subject: "src/generated/Notes.ts",
				},
			]),
		);
	},
);
