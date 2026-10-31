import { qualityInstalled, repositoryHas } from "./repositoryStory.ts";

export function unusedToolConfiguration(content: string) {
	return [
		qualityInstalled(),
		repositoryHas(
			{ content: '{"name":"app","type":"module","devDependencies":{"vitest":"*"}}', path: "package.json" },
			{ content, path: "vitest.config.ts" },
			{ content: "export const abandoned = 1;", path: "src/abandoned.ts" },
		),
	];
}
