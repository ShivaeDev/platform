import { maxPerFile } from "#rules/comments/maxPerFile.ts";
import { noBanner } from "#rules/comments/noBanner.ts";
import { noEnvironmentPragma } from "#rules/comments/noEnvironmentPragma.ts";
import { noJsdoc } from "#rules/comments/noJsdoc.ts";
import { noLineReference } from "#rules/comments/noLineReference.ts";
import { noPrReference } from "#rules/comments/noPrReference.ts";
import { noTodo } from "#rules/comments/noTodo.ts";
import { distinctCase } from "#rules/files/distinctCase.ts";
import { folderNames } from "#rules/files/folderNames.ts";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { otherNames } from "#rules/files/otherNames.ts";
import { importsAliased } from "#rules/imports/aliased.ts";
import { importCycles } from "#rules/imports/cycles.ts";
import { importFences } from "#rules/imports/fences.ts";
import { importsManifest } from "#rules/imports/manifest.ts";
import { noTestCode } from "#rules/imports/noTestCode.ts";
import { importsResolvable } from "#rules/imports/resolvable.ts";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { authSql } from "#rules/stories/authSql.ts";
import { storyEngine } from "#rules/stories/engine.ts";
import { httpStatus } from "#rules/stories/httpStatus.ts";
import { namedValues } from "#rules/stories/namedValues.ts";
import { noExpect } from "#rules/stories/noExpect.ts";
import { noLimitImports } from "#rules/stories/noLimitImports.ts";
import { queueSql } from "#rules/stories/queueSql.ts";
import { storySetup } from "#rules/stories/setup.ts";
import { specHelpers } from "#rules/stories/specHelpers.ts";
import { storySpecs } from "#rules/stories/specs.ts";
import { biomeOverrides } from "#rules/suppressions/biomeOverrides.ts";
import { biomeRecommended } from "#rules/suppressions/biomeRecommended.ts";
import { noDoubleCast } from "#rules/suppressions/noDoubleCast.ts";
import { noIgnoreDeprecations } from "#rules/suppressions/noIgnoreDeprecations.ts";
import { noInline } from "#rules/suppressions/noInline.ts";
import { testsColocated } from "#rules/test-names/colocated.ts";
import { testsFollow } from "#rules/test-names/follow.ts";
import { biome } from "./biome.ts";
import { manifestsExportsShape } from "./manifestsExportsShape.ts";
import { manifestsSorted } from "./manifestsSorted.ts";
import { manifestsSourceFirst } from "./manifestsSourceFirst.ts";
import { maxDepth } from "./maxDepth.ts";
import { maxLines } from "./maxLines.ts";
import { noBarrel } from "./noBarrel.ts";

export const builtInRules = [
	maxLines,
	maxDepth,
	noBarrel,
	noJsdoc,
	noLineReference,
	noPrReference,
	noBanner,
	noTodo,
	noEnvironmentPragma,
	maxPerFile,
	noInline,
	noDoubleCast,
	noIgnoreDeprecations,
	biomeOverrides,
	biomeRecommended,
	biome,
	importCycles,
	importFences,
	importsRuntime,
	importsResolvable,
	importsManifest,
	importsAliased,
	noTestCode,
	manifestsSorted,
	manifestsSourceFirst,
	manifestsExportsShape,
	namedAfterExport,
	folderNames,
	distinctCase,
	otherNames,
	testsFollow,
	testsColocated,
	storySetup,
	storySpecs,
	storyEngine,
	queueSql,
	authSql,
	noExpect,
	specHelpers,
	httpStatus,
	namedValues,
	noLimitImports,
] as const;
