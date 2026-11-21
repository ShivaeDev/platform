import { writeFiles } from "#test/fixtureProject.ts";
import { generator } from "#test/generator.ts";

// A raw SQL read decoded with an exported Schema class that marks pulse sensitive, returned inside an object and an array.
const READINGS_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/readings/latest.ts": `import { Effect, Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { readSql } from "@shivaedev/sql/readSql.ts";
import { Reading } from "#modules/readings/reading.ts";

export const Latest = query("latest", {
	*run() {
		const rows = yield* Effect.orDie(readSql\`select day, pulse from readings order by day\`);
		const history = yield* Effect.orDie(Schema.decodeUnknownEffect(Schema.Array(Reading))(rows));
		return { history, latest: history[0] ?? new Reading({ day: "today", pulse: 0 }) };
	},
});
`,
	"src/modules/readings/reading.ts": `import { Schema } from "effect";

export class Reading extends Schema.Class<Reading>("Reading")({ day: Schema.String, pulse: Schema.Number.annotate({ sensitive: true }) }) {}
`,
	"src/modules/readings/readings.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { readingsWire } from "#generated/modules/readings/readings.ts";
import { Latest } from "#modules/readings/latest.ts";

export const Readings = defineModule({
	name: "readings",
	operations: [Latest],
	wire: readingsWire,
});
`,
};

export function readingsProject() {
	return generator.trait(
		"project",
		"the project has the readings module, whose latest query decodes a raw SQL read with the Reading class that marks pulse sensitive and returns it in an object and an array",
		(engine) => writeFiles(engine.root, READINGS_PROJECT),
	);
}
