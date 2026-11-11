import { docsReferences } from "#rules/docs/references.ts";
import { docsWorkspace, markdown, noModule } from "#test/docsRepository.ts";
import { importStory, repositoryHas } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const GENERATED = "packages/lib/src/generated";

// Quality runs the generate script before it reads the sources, so a README naming a generated file that is not on disk names one the generator does not write.
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
	"docs/references reports a README's module path and link to a file in src/generated that is not on disk",
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
