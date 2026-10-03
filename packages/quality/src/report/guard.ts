import { describeEntry } from "../baseline/compare.ts";
import type { GuardProblem, GuardResult } from "../baseline/guard.ts";
import type { Base } from "../git/base.ts";
import { plural } from "./plural.ts";

export interface GuardContext {
	readonly baseline: string;
	readonly config: string;
	readonly base: Base;
}

const problemLine = (problem: GuardProblem, context: GuardContext): string => {
	switch (problem._tag) {
		case "Added":
			return `${problem.entry.rule} ${problem.entry.file} is new: ${describeEntry(problem.entry)}.`;
		case "Raised":
			return `${problem.entry.rule} ${problem.entry.file} rose to ${describeEntry(problem.entry)} from ${describeEntry(problem.base)}.`;
		case "Unadopted":
			return `${problem.rule} is newly baselined in ${plural(problem.entries, "file")} without being named under \`adopt\` in ${context.config}.`;
		case "NothingAdopted":
			return `\`adopt\` in ${context.config} names ${problem.rule}, which has nothing baselined. Remove it.`;
	}
};

const against = (base: Base): string => `${base.ref} (merge base ${base.commit.slice(0, 12)})`;

const held = (result: GuardResult): string =>
	[
		...(result.moved > 0 ? [`${plural(result.moved, "entry", "entries")} followed moved files`] : []),
		...(result.adopted.length > 0 ? [`adopted ${result.adopted.join(", ")}`] : []),
	]
		.map((part) => `; ${part}`)
		.join("");

export const renderGuard = (result: GuardResult, context: GuardContext): string => {
	if (result.problems.length === 0) {
		return `quality: ${context.baseline} holds against ${against(context.base)}${held(result)}.`;
	}
	return [
		[
			`error ${context.baseline} grew against ${against(context.base)}`,
			`  The baseline only shrinks. Fix new violations instead of baselining them; a rule enters the baseline for the first time only while \`adopt\` names it.`,
			...result.problems.map((problem) => `  ${problemLine(problem, context)}`),
		].join("\n"),
		`quality: baseline check failed with ${plural(result.problems.length, "problem")}.`,
	].join("\n\n");
};
