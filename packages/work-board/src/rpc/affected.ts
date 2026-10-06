import type { Key } from "@shivaedev/effect-contract/keys.ts";
import { backlinksOf } from "#metadata/backlinks.ts";
import type { MetadataModel } from "#metadata/model.ts";
import { documents, identities, index, navigation } from "./keys.ts";

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
		for (const document of model.documents) {
			for (const link of backlinksOf(document.file, model)) {
				connect(document.file, link.file);
				connect(link.file, document.file);
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
export function affected(previous: MetadataModel, current: MetadataModel, paths: readonly string[]): readonly Key[] | undefined {
	if (uncertain(previous, current, paths)) {
		return undefined;
	}
	const models = [previous, current];
	const files = linkedFiles(models, paths);
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
