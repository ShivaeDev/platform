import { Result } from "effect";
import type { Inventory, SourceFile } from "#lint/inventory.ts";
import { decodeRegistry, REGISTRY_FILE, type RegistryEntry } from "#lint/registry.ts";
import type { Violation } from "#lint/violation.ts";

const PRAGMA = "@ts-expect-error";

const invalidRegistry = (): readonly Violation[] => [
	{
		file: REGISTRY_FILE,
		line: undefined,
		message: "must be a JSON array of entries with string file and pragma fields and a non-empty reason.",
		rule: "pragmas/registry-invalid",
	},
];

const fileViolations = (file: SourceFile, registry: readonly RegistryEntry[]): readonly Violation[] =>
	file.comments.flatMap((comment) => {
		const detected = comment.content.includes(PRAGMA);
		const registered = registry.some((entry) => entry.file === file.path && comment.content.includes(entry.pragma));
		return !detected || registered
			? []
			: [
					{
						file: file.path,
						line: comment.line,
						message: `uses "${PRAGMA}" without a registry entry. Every lint escape is enumerated, with a reason, in script/pragma-registry.json.`,
						rule: "pragmas/unregistered",
					},
				];
	});

export const pragmaViolations = (inventory: Inventory): readonly Violation[] => {
	const registry = decodeRegistry(inventory.pragmaRegistry);
	return Result.isFailure(registry) ? invalidRegistry() : inventory.sources.flatMap((file) => fileViolations(file, registry.success));
};
