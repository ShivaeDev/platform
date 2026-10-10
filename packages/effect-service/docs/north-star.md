# North star

## The problem

An Effect service brings together dependencies, initialization and application methods. When each method binds its own dependencies, the declaration no longer tells a reader what the service needs: the answer is distributed across Layer construction, closures and method bodies. Initialization state may leak into the public interface, and a helper that hides all requirements can hide the caller's resource scope too.

The application needs one service definition that removes this repeated work while leaving Effect's dependency, failure and resource model visible. A caller should see what the service does. The composition boundary should see what it needs. An agent changing it should be able to find both in one declaration.

## The ideal

`defineService` is the one path for defining application services. The definition lists the services it requires, produces private state in an initialization Effect, and turns that state into ordinary Effect-returning methods. Its result is a native Context service with a native Layer, so the application's existing Effect composition stays usable.

A dependency listed in the declaration is bound to the service's methods. A caller does not repeat that requirement or replace the dependency around an individual call. A resource acquired during initialization belongs to the Layer's scope. A resource acquired during a method belongs to that method's caller scope, which stays visible in its public type.

The public declaration communicates argument, success and failure types. The Layer communicates initialization failures and required dependencies. Initialization state is available to the method factory and absent from the public service interface.

## Which way to lean

1. **Preserve Effect semantics.** Native Context, Layer, typed errors and caller scope matter more than saving a few lines in a declaration. Do not hide resource ownership to make a method easier to call.
2. **Make the dependency contract truthful.** An ordinary method cannot quietly use a service absent from the declaration. Unsupported signatures should fail at definition time rather than emit a misleading public method type.
3. **Keep one declaration per service.** Initialization and methods belong with their dependency list. Applications should not rebuild binding machinery or choose between parallel service helpers.
4. **Prove both sides of a type boundary.** Positive declarations are insufficient without fixtures that reject invalid definitions. Resource and binding promises need runtime tests as well as types.
5. **Wrap thinly.** Use the service to organize application behavior. Keep the native composition tools visible and keep other packages' responsibilities out of the declaration helper.

## Trade-offs

### A concrete signature over an inaccurate generic one

Subtracting declared dependencies from an arbitrary generic function can destroy the relationship between its input and output types. Ordinary application methods should use concrete signatures. A requirement-free service may explicitly mark a generic method, retaining that method's caller requirements. The supported shapes follow compiler fixtures; the checks are not a general analysis of every generic or overloaded signature. Prefer a concrete signature when its relationships cannot be preserved.

### Explicit caller scope over hidden resource ownership

Requiring a caller scope makes resource-owning methods less convenient to call. It also makes the owner of the resource visible. Initialization scope is appropriate for a service's resources; it should not absorb a resource whose lifetime is one method call.

### Private state over a second public interface

The initialization value can hold identities, counters or acquired resources that public methods share. The caller sees the methods that use that state, not a second way to reach and mutate it. A native test Layer supplies the same public method interface.

## What this package leaves out

- A runtime or dependency container alongside Effect's Context and Layer.
- Repository operations, transaction policies or migrations; those belong to `effect-sql`.
- Query and command declarations; those belong to `effect-contract`.
- Request identity, authentication and RPC transport policy; those belong to the application's request boundary and the `platform` modules.
- Retries, scheduling or domain behavior added to every service method by convention.
- A service lifetime chosen for a particular HTTP server, browser or worker. The host's composition boundary owns that decision.

[The roadmap](./roadmap.md) owns package implementation status and questions. [The framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns cross-package integration, host runtime ownership and version alignment.
