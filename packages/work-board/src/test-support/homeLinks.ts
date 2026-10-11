import { linkSync, symlinkSync } from "node:fs";
import { join } from "node:path";

export const homeLinks = {
	aliases: (root: string) => {
		symlinkSync("plan.md", join(root, "alias.md"));
		linkSync(join(root, "plan.md"), join(root, "a-copy.md"));
	},
	nestedAlias: (root: string) => {
		symlinkSync("plan.md", join(root, "alias.md"));
		linkSync(join(root, "plan.md"), join(root, ".drafts/plan-copy.md"));
	},
	outside: (root: string, outside: string) => symlinkSync(join(outside, "private.md"), join(root, "home-link.md")),
};
