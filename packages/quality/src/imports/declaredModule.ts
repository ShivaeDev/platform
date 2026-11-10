export function declaredModule(fileName: string): string | undefined {
	const path = fileName.replaceAll("\\", "/");
	const at = path.lastIndexOf("/node_modules/");
	if (at === -1) {
		return undefined;
	}
	const [scope = "", name = "", ...rest] = path.slice(at + "/node_modules/".length).split("/");
	const pkg = scope.startsWith("@") ? `${scope}/${name}` : scope;
	if (pkg === "@types/node") {
		const module = (scope.startsWith("@") ? rest : [name, ...rest]).join("/").replace(/\.d\.[cm]?ts$/u, "");
		return `node:${module.replace(/^node:/u, "")}`;
	}
	return pkg.startsWith("@types/") ? pkg.slice("@types/".length).replace(/^(?<scope>.+)__(?<name>.+)$/u, "@$<scope>/$<name>") : pkg;
}
