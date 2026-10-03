import { maxPerFile } from "./comments/max-per-file.ts";
import { noBanner } from "./comments/no-banner.ts";
import { noJsdoc } from "./comments/no-jsdoc.ts";
import { noLineReference } from "./comments/no-line-reference.ts";
import { noPrReference } from "./comments/no-pr-reference.ts";
import { noTodo } from "./comments/no-todo.ts";
import { maxLines } from "./max-lines.ts";
import { biomeOverrides } from "./suppressions/biome-overrides.ts";
import { noDoubleCast } from "./suppressions/no-double-cast.ts";
import { noInline } from "./suppressions/no-inline.ts";
import { noTypeAssertion } from "./suppressions/no-type-assertion.ts";

export const builtInRules = [
	maxLines,
	noJsdoc,
	noLineReference,
	noPrReference,
	noBanner,
	noTodo,
	maxPerFile,
	noInline,
	noDoubleCast,
	noTypeAssertion,
	biomeOverrides,
] as const;
