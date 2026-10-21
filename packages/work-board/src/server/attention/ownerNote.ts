import type { MetadataDocument } from "#server/metadata/model.ts";

export function ownerNote(fields: MetadataDocument["parsed"]["fields"], maintainer: string): string | undefined {
	const owner = fields.owner?.trim();
	if (!(owner && fields.nextAction) || owner === "codex" || owner === "claude") {
		return undefined;
	}
	const note = personNote(fields.nextAction, fields.status);
	return owner === "marvin" || owner === maintainer ? note : `${owner} notes: ${note}`;
}

function personNote(action: string, status: string | undefined): string {
	const echo = status?.trim().toLowerCase();
	const note = echo && action.toLowerCase().startsWith(`${echo}:`) ? action.slice(echo.length + 1).trim() : action;
	return note ? note.charAt(0).toUpperCase() + note.slice(1) : action;
}
