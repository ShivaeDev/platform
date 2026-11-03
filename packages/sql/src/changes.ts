import { type BucketKey, type ItemKey, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { type AnnouncementOptions, invalidateOnCommit } from "#transact.ts";

export interface ChangeDeclaration {
	readonly covers: Readonly<Record<string, readonly (ItemKey | BucketKey)[]>>;
	readonly record: (options?: AnnouncementOptions) => ReturnType<typeof invalidateOnCommit>;
}

export function changes(covers: ChangeDeclaration["covers"]): ChangeDeclaration {
	const keys = invalidationKeys(Object.values(covers).flat());
	return { covers, record: (options) => invalidateOnCommit(keys, options) };
}
