import { createAuthClient } from "better-auth/client";
import type { Effect } from "effect";
import { expectTypeOf } from "vitest";
import type { AuthFailure } from "#client/AuthFailure.ts";
import { changeEmail } from "#client/adapters/changeEmail.ts";

const submit = changeEmail(createAuthClient());
const changed = submit({ newEmail: "alice-new@example.test", password: "current-password" });
expectTypeOf<Effect.Error<typeof changed>["code"]>().toEqualTypeOf<AuthFailure["code"]>();
expectTypeOf<Effect.Success<typeof changed>>().toEqualTypeOf<{ status: boolean } | null>();
submit({ "callbackURL": "/email-changed", newEmail: "alice-new@example.test", password: "current-password" });
// @ts-expect-error Changing email requires the current password.
submit({ newEmail: "alice-new@example.test" });
