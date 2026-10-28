# @shivaedev/access

Declare which permissions each application role grants and use that policy in server enforcement and browser interfaces. Store one role string per user, with a Schema that rejects names the application does not declare.

## One policy for each application

Applications need to check what a user can do wherever the action appears. Explicit grants keep those decisions together, including the difference between acting on your own records and acting on anyone's.

```ts
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";

const ReadUsers = permission("users.read");
const Member = role("member", [ReadUsers]);
const Operator = role("operator", [ReadUsers.any]);
const Access = roleSet(Member, Operator);

Access.canAccess({ id: "alice", role: "member" }, ReadUsers, "alice");
Access.canAccess({ id: "alice", role: "operator" }, ReadUsers, "bob");
```

Both checks return `true`: the member owns the first record, and the operator holds the explicit override.

## Declare and use access

### Permissions and roles

A permission names the domain and action, such as `users.read`, `roles.assign` or `jobs.read`. `permission(name)` declares the default strength and exposes a separate override value as `.any`. Each role receives an explicit list of grants. There are no wildcard, prefix or implied grants: holding `users.read.any` does not add `users.read` to the role's list. The ownership check accepts either strength as appropriate for the record.

```ts
const AssignRoles = permission("roles.assign");
const ReadJobs = permission("jobs.read");
const Operator = role("operator", [ReadUsers.any, AssignRoles, ReadJobs]);
const Guest = role("guest", []);
const Access = roleSet(Member, Operator, Guest);
```

Keep these declarations in application code. The package provides no persistence or runtime role editor.

### Store and decode the role string

The role set exposes `Role`, a native Schema whose type and encoded value are the closed union of the declared names. Use it in the application's user Schema and decode database values before authorization.

```ts
import { Schema } from "effect";

type AppRole = typeof Access.Role.Type;
const AppUser = Schema.Struct({ id: Schema.String, role: Access.Role });
const decodeUser = Schema.decodeUnknownEffect(AppUser);
const decodeRole = Schema.decodeUnknownEffect(Access.Role);
```

`AppRole` is `"member" | "operator" | "guest"`. An unknown stored name fails in the typed `SchemaError` channel. `yield* Access.resolve(stored)` decodes the same Schema and returns `{ role, permissions }`, with only the grants declared for that role. `@shivaedev/identity` accepts the role set as the `roles` option of its session policy and its Better Auth mount.

### Check grants and enforce actions

`hasPermission(role, permission)` checks the exact listed grant. `requirePermission(user, permission)` enforces that same check. A user supplies `{ id, role }`; a `null` or `undefined` user fails with `Unauthorized`, and a missing grant fails with `Forbidden`. These are the shared failures from `@shivaedev/errors/taxonomy.ts`.

```ts
const user = { id: "alice", role: "operator" } as const;
const showAssignment = Access.hasPermission(user.role, AssignRoles);
const enforceAssignment = Access.requirePermission(user, AssignRoles);
```

Use permissions in application decisions instead of comparing role names.

### Check record ownership

`canAccess(user, permission, ownerId)` returns a boolean for a record. Pass the default permission and the record's owner ID: the default grant requires the acting user's ID to match, while its `.any` override permits either owner. Ownership alone grants nothing. Signed-out callers get `false`.

`requireAccess(user, permission, ownerId)` enforces that same ownership policy as an Effect. Signed-out callers fail with `Unauthorized`; signed-in callers without access fail with `Forbidden`.

```ts
const canRead = Access.canAccess(user, ReadUsers, "bob");
const enforceRead = Access.requireAccess(user, ReadUsers, "bob");
```

Use the ownership APIs when an action targets a record; the exact grant APIs do not check an owner.

### Install

```sh
pnpm add @shivaedev/access effect
```
