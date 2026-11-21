import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesRepository, uncollectedData } from "#test/better-auth/uncollectedData.ts";

const MISSING_COLLECTOR =
	"No collector receives the owned models that repositories report, so identity cannot see what to export, erase or count as covered: provide collectRepositoryModels from @shivaedev/sql/RepositoryModels.ts before the repositories are built, as appHost does";

uncollectedData.it(
	"without the host's collector, export, erase and the coverage check fail naming the missing Layer instead of passing with nothing owned",
	[notesRepository],
	function* ({ check, erase, exportAccount }) {
		const exported = yield* exportAccount("alice");

		yield* outcomes([
			["export", () => Effect.succeed(exported), MISSING_COLLECTOR],
			["erase", () => erase("alice"), MISSING_COLLECTOR],
			["coverage check", () => check(), MISSING_COLLECTOR],
		]);
	},
);
