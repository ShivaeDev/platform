export function quotedSchema(schema: string): string {
	return `"${schema.replaceAll('"', '""')}"`;
}
