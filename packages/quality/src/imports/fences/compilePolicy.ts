import type { ImportEdge } from "#imports/graph.ts";
import { type Endpoint, packageNameOf } from "#imports/resolve.ts";
import { type CompiledFence, compileFence, type FenceGraph } from "./evaluate.ts";
import type { PolicyScope } from "./match.ts";
import type { Chain, ExampleStep, Fence } from "./model.ts";

function endpointOf(step: ExampleStep): Endpoint {
	return typeof step === "string"
		? { kind: "file", path: step }
		: { kind: "external", package: packageNameOf(step.external), specifier: step.external };
}

function chainLabel(chain: Chain): string {
	return chain.map((step) => (typeof step === "string" ? step : step.external)).join(" -> ");
}

function graphOf(chain: Chain): FenceGraph | undefined {
	const importers = chain.slice(0, -1);
	const files = importers.flatMap((step) => (typeof step === "string" ? [step] : []));
	if (files.length !== importers.length) {
		return undefined;
	}
	const edges = files.map(
		(from, index): ImportEdge => ({ from, kind: "import", line: 1, specifier: "", to: endpointOf(chain[index + 1] ?? from), type: false }),
	);
	return { edges, modules: files };
}

function crossedBy(policy: readonly CompiledFence[], graph: FenceGraph): readonly string[] {
	return policy.filter((compiled) => compiled.evaluate(graph).length > 0).map((compiled) => compiled.fence.name);
}

function exampleIssues(policy: readonly CompiledFence[], fence: Fence): readonly string[] {
	const where = `fence "${fence.name}"`;
	const illegal = graphOf(fence.examples.illegal);
	const legal = graphOf(fence.examples.legal);
	if (illegal === undefined || legal === undefined) {
		return [`${where}: an example imports from an external module; only its last step may be external()`];
	}
	const crossed = crossedBy(policy, illegal);
	const passed = crossedBy(policy, legal);
	return [
		...(crossed.length === 1 && crossed[0] === fence.name
			? []
			: [
					`${where}: the illegal example ${chainLabel(fence.examples.illegal)} must cross this fence alone, and crosses ${crossed.join(", ") || "none"}`,
				]),
		...(passed.length === 0 ? [] : [`${where}: the legal example ${chainLabel(fence.examples.legal)} crosses ${passed.join(", ")}`]),
	];
}

function declarationIssues(fences: readonly Fence[]): readonly string[] {
	return fences.flatMap((fence, index) => [
		...(fence.name.trim() === "" ? [`fence ${index}: has no name`] : []),
		...(fences.findIndex((other) => other.name === fence.name) === index ? [] : [`fence "${fence.name}": an earlier fence has this name`]),
		...(fence.rationale.trim() === "" ? [`fence "${fence.name}": because() gives no reason`] : []),
	]);
}

export function compilePolicy(fences: readonly Fence[], scope: PolicyScope): readonly CompiledFence[] {
	const issues = [...declarationIssues(fences)];
	const policy = fences.map((fence) => compileFence({ issues, scope }, fence));
	if (issues.length === 0) {
		issues.push(...fences.flatMap((fence) => exampleIssues(policy, fence)));
	}
	if (issues.length > 0) {
		throw new Error(`the fence policy is invalid:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
	}
	return policy;
}
