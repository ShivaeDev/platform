import { runQuality } from "#test/cli.ts";

export async function installedIn(root: string): Promise<string> {
	await runQuality(root, "hooks", "install");
	return root;
}

export function preCommit(root: string) {
	return runQuality(root, "hooks", "pre-commit");
}
