import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { importSourceOf, successOf } from "#test/generatedText.ts";
import { generatedOnce, generator } from "#test/generator.ts";
import { readingsProject } from "#test/readingsProject.ts";

generator.it(
	"latest's Reading in an object and in an array is the Reading class imported from its module, not restated, so the generated success still marks pulse and only pulse",
	[readingsProject(), generatedOnce()],
	function* ({ generatedFile, marksOf }) {
		const text = yield* generatedFile("src/generated/modules/readings/readings.ts");
		yield* outcomes([
			[
				"latest's success",
				() => Effect.succeed(successOf(text, "latest")),
				"Schema.Struct({ history: Schema.mutableKey(Schema.Array(Reading)), latest: Schema.mutableKey(Reading) })",
			],
			["Reading's source", () => Effect.succeed(importSourceOf(text, "Reading")), "#modules/readings/reading.ts"],
			["marked names", () => marksOf("readings", "latest"), ["pulse"]],
		]);
	},
);
