import type { Key } from "@shivaedev/contract/keys.ts";
import { documents, identities, index, navigation } from "#rpc/keys.ts";
import { referencesFrom } from "#server/metadata/backlinks.ts";
import type { MetadataModel } from "#server/metadata/model.ts";
import { referencesOf } from "#server/metadata/referencesOf.ts";
import { malformedResponse } from "#server/responses/records.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

type Indexed = Pick<Snapshot, "model" | "modified">;

function versions({ model, modified }: Indexed) {
	const parsed = new Map(model.documents.map((document) => [document.file, document.parsed]));
	return (path: string) => JSON.stringify([modified.get(path), parsed.get(path)?.raw, parsed.get(path)?.body]);
}
function uncertain(previous: MetadataModel, current: MetadataModel, paths: readonly string[]) {
	if (previous.unavailable.length > 0 || current.unavailable.length > 0) {
		return true;
	}
	const before = new Map(previous.documents.map((doc) => [doc.file, doc.parsed]));
	const after = new Map(current.documents.map((doc) => [doc.file, doc.parsed]));
	const known = new Set([...before.keys(), ...after.keys()]);
	if (paths.some((path) => !known.has(path))) {
		return true;
	}
	const announced = new Set(paths);
	return [...known].some((file) => {
		const old = before.get(file);
		const next = after.get(file);
		return !announced.has(file) && (old?.body !== next?.body || old?.raw !== next?.raw || old?.bodyLine !== next?.bodyLine);
	});
}
function connectIdentities(model: MetadataModel, connect: (from: string, to: string) => void) {
	for (const duplicates of model.ids.values()) {
		const first = duplicates[0];
		if (first === undefined) {
			continue;
		}
		for (const duplicate of duplicates.slice(1)) {
			connect(first.file, duplicate.file);
			connect(duplicate.file, first.file);
		}
	}
}
function linkedFiles(models: readonly MetadataModel[], paths: readonly string[]) {
	const edges = new Map<string, Set<string>>();
	function connect(from: string, to: string) {
		const targets = edges.get(from) ?? new Set();
		targets.add(to);
		edges.set(from, targets);
	}
	for (const model of models) {
		connectIdentities(model, connect);
		const managed = model.documents.filter((document) => document.parsed.fields.attention?.some((request) => request.managed));
		for (const document of model.documents) {
			const uncertainReceipt = document.parsed.diagnostics.some(
				(problem) => problem.field === "request_receipt" || problem.field === "requestReceipt",
			);
			const targets = [
				...referencesFrom(document, model).flatMap((link) => (link.target === undefined ? [] : [link.target])),
				...referencesOf(document).flatMap((reference) => (model.ids.get(reference.target.split("#")[0] ?? "") ?? []).map((target) => target.file)),
				...(malformedResponse(document) || uncertainReceipt ? managed.map((source) => source.file) : []),
			];
			for (const target of targets) {
				connect(document.file, target);
				connect(target, document.file);
			}
		}
	}
	const files = new Set(paths);
	for (const file of files) {
		for (const linked of edges.get(file) ?? []) {
			files.add(linked);
		}
	}
	return files;
}
export function affected(previous: Indexed, current: Indexed, paths: readonly string[]): readonly Key[] | undefined {
	if (uncertain(previous.model, current.model, paths)) {
		return undefined;
	}
	const before = versions(previous);
	const after = versions(current);
	const changed = paths.filter((path) => before(path) !== after(path));
	if (changed.length === 0) {
		return [];
	}
	const models = [previous.model, current.model];
	const files = linkedFiles(models, changed);
	const keys: Key[] = [index.list, navigation.list, ...[...files].map((file) => documents.item(file))];
	for (const model of models) {
		if (model.rootFile && files.has(model.rootFile)) {
			keys.push(documents.item(""));
		}
		for (const document of model.documents) {
			if (files.has(document.file) && document.parsed.fields.id) {
				keys.push(identities.item(document.parsed.fields.id));
			}
		}
	}
	return keys;
}
