import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface HookCheckout {
	readonly hooks: string;
	readonly preCommit: string;
}

export function checkoutWithoutHooks(): HookCheckout {
	const hooks = join(mkdtempSync(join(tmpdir(), "platform-hooks-")), "hooks");
	return { hooks, preCommit: join(hooks, "pre-commit") };
}

export function withOwnPreCommit(checkout: HookCheckout, script: string): HookCheckout {
	writeFileSync(checkout.preCommit, script);
	return checkout;
}
