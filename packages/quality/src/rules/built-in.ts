import { biome } from "./biome.ts";
import { maxPerFile } from "./comments/max-per-file.ts";
import { noBanner } from "./comments/no-banner.ts";
import { noEnvironmentPragma } from "./comments/no-environment-pragma.ts";
import { noJsdoc } from "./comments/no-jsdoc.ts";
import { noLineReference } from "./comments/no-line-reference.ts";
import { noPrReference } from "./comments/no-pr-reference.ts";
import { noTodo } from "./comments/no-todo.ts";
import { importCycles } from "./imports/cycles.ts";
import { importFences } from "./imports/fences.ts";
import { importsResolvable } from "./imports/resolvable.ts";
import { manifestsSorted } from "./manifests-sorted.ts";
import { maxLines } from "./max-lines.ts";
import { biomeOverrides } from "./suppressions/biome-overrides.ts";
import { noDoubleCast } from "./suppressions/no-double-cast.ts";
import { noInline } from "./suppressions/no-inline.ts";

export const builtInRules = [
	maxLines,
	noJsdoc,
	noLineReference,
	noPrReference,
	noBanner,
	noTodo,
	noEnvironmentPragma,
	maxPerFile,
	noInline,
	noDoubleCast,
	biomeOverrides,
	biome,
	importCycles,
	importFences,
	importsResolvable,
	manifestsSorted,
] as const;
