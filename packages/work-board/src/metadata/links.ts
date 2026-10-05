import type { MetadataModel } from "./model.ts";

export function identityUrl(id: string): string {
	return `/_board/item/${encodeURIComponent(id)}/`;
}
export function referenceTarget(reference: string, model: MetadataModel): string | undefined {
	if (model.unavailable.length > 0) {
		return undefined;
	}
	const [id = "", criterion] = reference.split("#");
	const targets = model.ids.get(id);
	if (targets?.length !== 1) {
		return undefined;
	}
	if (criterion && targets[0]?.parsed.fields.criteria?.filter((item) => item.id === criterion).length !== 1) {
		return undefined;
	}
	return identityUrl(id) + (criterion ? `#criterion-${encodeURIComponent(criterion)}` : "");
}
