import { repositoryHas } from "./ruleStory.ts";

export const ROUTE_CONTENT = "export const Route = {};\n";
export const APP = "apps/store";

export function fileRoutedApp(configuration: string, folder: string, vite?: string) {
	return repositoryHas(
		{ content: '{"name":"store","private":true}', path: `${APP}/package.json` },
		{ content: configuration, path: `${APP}/tsr.config.json` },
		{ content: ROUTE_CONTENT, path: `${APP}/${folder}/__root.tsx` },
		{ content: "export const ordinary = 1;\n", path: `${APP}/src/ordinary.ts` },
		...(vite === undefined ? [] : [{ content: vite, path: `${APP}/vite.config.ts` }]),
	);
}

export function viteRoutedApp(options: string, folder: string, plugin: "tanstackRouter" | "TanStackRouterVite" = "tanstackRouter") {
	const module = plugin === "tanstackRouter" ? "@tanstack/router-plugin/vite" : "@tanstack/router-vite-plugin";
	return repositoryHas(
		{ content: '{"name":"store","private":true}', path: `${APP}/package.json` },
		{
			content: `import { ${plugin} as router } from "${module}";\nexport default { plugins: [router(${options})] };\n`,
			path: `${APP}/vite.config.ts`,
		},
		{ content: ROUTE_CONTENT, path: `${APP}/${folder}/__root.tsx` },
	);
}
