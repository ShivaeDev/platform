import { Schema } from "effect";
import rawTrees from "#test/fixtures/cli-trees.json" with { type: "json" };

const SeedFile = Schema.Struct({ content: Schema.String, path: Schema.String });

export const trees = Schema.decodeUnknownSync(Schema.Struct({ clean: Schema.Array(SeedFile), dirty: Schema.Array(SeedFile) }))(rawTrees);
