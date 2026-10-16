import { Buffer, isUtf8 } from "node:buffer";
import { prepareFile } from "./template.ts";

export function appFilePath(path: string) {
	const renamed: Readonly<Record<string, string>> = {
		"app-agents.md": "AGENTS.md",
		"app-readme.md": "README.md",
		"pnpm-workspace.copy.yaml": "pnpm-workspace.yaml",
	};
	return (renamed[path] ?? path).replaceAll("starterHost", "applicationHost").replaceAll("starterDeploy", "applicationDeploy");
}

export function appFileContent(path: string, content: Buffer, versions: Readonly<Record<string, string>>) {
	if (!isUtf8(content)) {
		return content;
	}
	return Buffer.from(
		prepareFile(path, content.toString(), versions)
			.replaceAll("starterHost", "applicationHost")
			.replaceAll("StarterAuth", "ApplicationAuth")
			.replaceAll("starter_", "__APP_NAMESPACE___")
			.replaceAll(/starter/giu, "__APP_NAME__"),
	);
}
