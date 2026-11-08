import { packageFolders, vitestConfig } from "#ci/adapters/packageFolders.ts";

export function testPackages(root: string) {
	return packageFolders(root)
		.filter(({ manifest }) => manifest.scripts?.test !== undefined)
		.map(({ directory, manifest }) => ({ configFile: vitestConfig(manifest.name, directory), directory, name: manifest.name }));
}
