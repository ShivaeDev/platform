import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expectTypeOf } from "vitest";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import type { ResumeSource } from "@shivaedev/contract/resume.ts";
import { JobsPermission } from "#permissions.ts";
import { collectionPage } from "#test/collectionPage.ts";
import { Jobs } from "#test/pages.ts";

const page = collectionPage();
expectTypeOf(page.contract.declaration.keyScope).toEqualTypeOf<"session">();
expectTypeOf(page.contract.middleware(JobsPermission).declaration.keyScope).toEqualTypeOf<"session">();
expectTypeOf(Jobs.contract.declaration.keyScope).toEqualTypeOf<undefined>();

declare const registry: AtomRegistry.AtomRegistry;
declare const resume: ResumeSource;
makeClient({ workspaces: page.contract }, { registry });
// @ts-expect-error Admin pages retain the session contract's owning-registry requirement.
makeClient({ workspaces: page.contract });
// @ts-expect-error Other client options do not replace the owning registry.
makeClient({ workspaces: page.contract }, { resume });
