const entities: Readonly<Record<string, string>> = { "'": "&#39;", '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" };

export const escapeHtml = (text: string): string => text.replaceAll(/[&<>"']/gu, (character) => entities[character] ?? character);
