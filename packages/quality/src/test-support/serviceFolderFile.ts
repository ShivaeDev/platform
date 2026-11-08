export function serviceFolderFile(code: string, path = "src/services/mail/service.ts") {
	return { content: `import { defineService as service } from "@shivaedev/service/defineService.ts";\n${code}`, path };
}
