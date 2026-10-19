import type { ResultProjection } from "#browser/views/ResultProjection.ts";

type Target = ResultProjection["targets"][number];

export function resultChecks(data: ResultProjection): readonly Target[] {
	const identity = data.document.identity;
	const targets = data.targets.filter((target) => !(target.link.label === identity && target.available && target.criteria.length === 0));
	return targets.every((target) => target.available && target.criteria.length === 0) ? [] : targets;
}
