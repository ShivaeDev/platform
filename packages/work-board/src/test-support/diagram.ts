export function diagram(source: string) {
	return `\n\n\`\`\`mermaid\ngraph TD; ${source}\n\`\`\`\n`;
}
