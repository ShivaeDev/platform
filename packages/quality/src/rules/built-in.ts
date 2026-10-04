import { maxPerFile } from "#rules/comments/max-per-file.ts";
import { noBanner } from "#rules/comments/no-banner.ts";
import { noEnvironmentPragma } from "#rules/comments/no-environment-pragma.ts";
import { noJsdoc } from "#rules/comments/no-jsdoc.ts";
import { noLineReference } from "#rules/comments/no-line-reference.ts";
import { noPrReference } from "#rules/comments/no-pr-reference.ts";
import { noTodo } from "#rules/comments/no-todo.ts";
import { folderNames } from "#rules/files/folderNames.ts";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { otherNames } from "#rules/files/otherNames.ts";
import { importsAliased } from "#rules/imports/aliased.ts";
import { importCycles } from "#rules/imports/cycles.ts";
import { importFences } from "#rules/imports/fences.ts";
import { importsResolvable } from "#rules/imports/resolvable.ts";
import { biomeOverrides } from "#rules/suppressions/biome-overrides.ts";
import { noDoubleCast } from "#rules/suppressions/no-double-cast.ts";
import { noInline } from "#rules/suppressions/no-inline.ts";
import { testsColocated } from "#rules/test-names/colocated.ts";
import { testsFollow } from "#rules/test-names/follow.ts";
import { biome } from "./biome.ts";
import { manifestsSorted } from "./manifests-sorted.ts";
import { maxLines } from "./max-lines.ts";

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
	importsAliased,
	manifestsSorted,
	namedAfterExport,
	folderNames,
	otherNames,
	testsFollow,
	testsColocated,
] as const;
