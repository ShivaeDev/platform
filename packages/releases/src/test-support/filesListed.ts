import { editManifest } from "./manifests.ts";
import { workspace } from "./workspace.ts";

export function filesListed(name: string, files: readonly string[]) {
	return workspace.trait("changed", `${name} lists ${JSON.stringify(files)} in files`, ({ root }) =>
		editManifest(root, name, ({ json }) => ({ ...json, files })),
	);
}
