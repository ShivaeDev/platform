# North star

## The problem

A shared callback boundary often knows less than each callback it holds. A rule registry holds rules with different option types; a contract container holds operations with different payloads; an implementation overload accepts callbacks whose public declaration is more precise. Each callback should retain its real input type, but a common storage shape cannot always carry all of those types.

TypeScript checks function-property parameters strictly. That is the useful default: a property accepting any value must not quietly receive a callback accepting only strings. Where a boundary deliberately erases callback inputs, method-style parameter assignment is sometimes necessary. Repeating the mechanism in every package makes the exception harder to recognize and review.

## The ideal

A package author reaches for an ordinary precise TypeScript type first. When a shared boundary needs a relaxation, its declaration names the exception with a small type helper. The helper changes assignment checking without adding a runtime layer or obscuring who must supply valid input.

`Bivariant` serves that job. The important distinction is between collecting callbacks and calling them. A permissive storage shape is not permission to pass arbitrary values to the narrower function it holds. The integration that matches a callback to its input owns that safety.

## Which way to lean

1. **Precise types first.** Keep each callback's own input and result visible. Do not relax a public callback merely to simplify an implementation signature.
2. **Make exceptions local.** A property that needs method-style parameter assignment says `Bivariant`; surrounding properties remain strict.
3. **Share a repeated rule.** Extract a helper when multiple Platform packages need the same compile-time rule. Application-specific types stay with their owner.
4. **Prove both sides.** Compiler fixtures show an intended assignment that succeeds and an unintended one that fails. Passing compilation says nothing about whether runtime data is valid.
5. **Stay small.** A helper should expose the TypeScript mechanism rather than build a new type vocabulary around it.

## Trade-offs

- **Flexible storage costs a caller guarantee.** Accepting a narrower callback under a broad input shape gives up the stricter property's protection at that boundary. The owning integration must preserve the callback/input relationship or validate the input before invocation.
- **One shared helper earns its place through repeated use.** Keeping a type local is simpler until packages need the same rule. A broad name is not a reason to collect every possible utility.
- **Compiler evidence has a narrow meaning.** Assignment regressions protect the declared type contract. Runtime validation, callback routing and framework composition need tests in the package that performs them.

## What it leaves out

- Runtime utilities, data validation and callback dispatch.
- Application model types or a second vocabulary for Effect services, schemas, contracts or forms.
- Blanket relaxation of function properties.
- A general TypeScript utility catalogue without a repeated Platform need.
