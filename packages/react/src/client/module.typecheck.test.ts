import type { AnyRoute } from "@tanstack/react-router";
import { expectTypeOf } from "vitest";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { type ClientApp, clientApp } from "#client/app.ts";
import { clientModule } from "#client/module.ts";
import { Counter, Profile } from "#test/client-app/backend.ts";

export const counted = clientModule({ profile: Profile, tally: Counter }, ({ profile, tally }) => {
	expectTypeOf(tally).toEqualTypeOf<ContractClient<typeof Counter>>();
	expectTypeOf(profile).toEqualTypeOf<ContractClient<typeof Profile>>();
	// @ts-expect-error A module's client has only its own contract's operations.
	tally.viewer.query();
	// @ts-expect-error A command's payload stays typed.
	tally.bump.run({ title: "Dune" });
	return { warm: [tally.count.query()] };
});

// @ts-expect-error A module names only contracts.
export const unnamed = clientModule({ tally: "Counter" }, () => ({}));

// @ts-expect-error warm takes atoms.
export const unwarmed = clientModule({ tally: Counter }, ({ tally }) => ({ warm: [tally.count] }));

export const app: ClientApp<AnyRoute> = clientApp([counted, unwarmed]);
