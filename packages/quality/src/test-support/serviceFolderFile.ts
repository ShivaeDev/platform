export function serviceFolderFile(code: string, path = "src/services/mail/service.ts") {
	return { content: `import { defineService as service } from "@shivaedev/service/adapters/defineService.ts";\n${code}`, path };
}
