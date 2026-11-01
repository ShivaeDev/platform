import { posix } from "node:path";
import { isTestCode } from "#naming/testName.ts";
import type { Finding, SourceFile } from "#rule.ts";
import { adminEvidence, adminPath, composition, sourceRoot } from "./adminEvidence.ts";
import type { ImportGraph } from "./graph.ts";

function reachable(seeds: readonly string[], next: (file: string) => readonly string[]): Set<string> {
	const reached = new Set<string>();
	const pending = [...seeds];
	for (const file of pending) {
		if (!reached.has(file)) {
			reached.add(file);
			pending.push(...next(file));
		}
	}
	return reached;
}

function destination(file: string, admin: boolean): string {
	if (!admin) {
		const root = sourceRoot(file) ?? "";
		return posix.dirname(root + file.slice(root.length).replace(/(?:^|\/)admin\//u, (segment) => (segment.startsWith("/") ? "/" : "")));
	}
	const runtime = /^(?<root>.*\/(?:client|server))\/(?<local>.*)$/u.exec(file)?.groups;
	if (runtime?.root !== undefined && runtime.local !== undefined) {
		return posix.dirname(`${runtime.root}/admin/${runtime.local}`);
	}
	return `${posix.dirname(file)}/admin`;
}

export function adminFindings(graph: ImportGraph, sources: readonly SourceFile[]): readonly Finding[] {
	const files = sources.filter((file) => sourceRoot(file.path) !== undefined && !isTestCode(file.path));
	const paths = new Set(files.map((file) => file.path));
	const seeds = new Set(files.filter((file) => adminPath(file.path) || adminEvidence(file)).map((file) => file.path));
	const edges = graph.edges.filter((edge) => edge.kind === "import" && paths.has(edge.from));
	const adjacency = new Map<string, string[]>();
	const imported = new Set<string>();
	for (const edge of edges) {
		if (edge.to.kind === "file" && paths.has(edge.to.path) && sourceRoot(edge.from) === sourceRoot(edge.to.path)) {
			adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to.path]);
			imported.add(edge.to.path);
		}
	}
	function next(file: string): readonly string[] {
		return adjacency.get(file) ?? [];
	}
	const admin = reachable([...seeds], next);
	const members = files.filter(({ path }) => !seeds.has(path) && (!(admin.has(path) && imported.has(path)) || composition(path)));
	const member = reachable(
		members.map((file) => file.path),
		(file) =>
			next(file).filter(
				(target) => !(composition(file) && seeds.has(target) && /\/(?:[^/]*[Rr]egistration|pages|make)\.[cm]?[jt]sx?$/u.test(target)),
			),
	);
	return files.flatMap(({ path }): Finding[] => {
		if (adminPath(path) && member.has(path)) {
			return [{ file: path, message: `Member code reaches this admin/ file. Move it to ${destination(path, false)}/.` }];
		}
		if (!adminPath(path) && admin.has(path) && !member.has(path)) {
			return [{ file: path, message: `Only admin permissions or registrations reach this file. Move it to ${destination(path, true)}/.` }];
		}
		return [];
	});
}
