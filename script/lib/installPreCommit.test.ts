import { strict as assert } from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { it } from "node:test";
import { installPreCommit } from "#lib/installPreCommit.ts";
import { checkoutWithoutHooks, withOwnPreCommit } from "#lib/test-support/hookCheckout.ts";

it("installs an executable pre-commit hook that runs the worktree's own checks", () => {
	const checkout = checkoutWithoutHooks();

	assert.equal(installPreCommit(checkout.hooks), "installed");
	assert.equal(readFileSync(checkout.preCommit, "utf8"), '#!/bin/sh\nexec "$(git rev-parse --show-toplevel)/script/hooks/pre-commit" "$@"\n');
	assert.equal(statSync(checkout.preCommit).mode & 0o777, 0o755);
});

it("installs again over its own hook", () => {
	const checkout = checkoutWithoutHooks();
	installPreCommit(checkout.hooks);

	assert.equal(installPreCommit(checkout.hooks), "installed");
});

it("keeps a pre-commit hook that is not Platform's", () => {
	const checkout = checkoutWithoutHooks();
	installPreCommit(checkout.hooks);
	withOwnPreCommit(checkout, "#!/bin/sh\nmake check\n");

	assert.equal(installPreCommit(checkout.hooks), "kept");
	assert.equal(readFileSync(checkout.preCommit, "utf8"), "#!/bin/sh\nmake check\n");
});
