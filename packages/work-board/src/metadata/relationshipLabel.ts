const labels = new Map([
	["board member", "Board membership"],
	["criterion evidence", "Criterion evidence"],
	["depends_on", "Depends on"],
	["evidence source", "Evidence source"],
	["implements", "Implements"],
	["informs", "Informs"],
	["relates_to", "Related to"],
]);

export function relationshipLabel(kind: string): string {
	return labels.get(kind) ?? kind;
}
