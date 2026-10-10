# Roadmap

This file owns shared type-helper implementation, compiler coverage and open questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed application features and host-level validation. A callback integration's runtime behavior belongs to that integration's package roadmap.

## Built

- [x] `Bivariant<Fn>` in `bivariant.ts`, an explicit method-style parameter assignment check for a function property.
- [x] Compiler regressions that accept a string callback under an `unknown` input shape, reject it under an ordinary strict property, and reject an incompatible return type.

## Next

- [ ] Add a focused compiler regression when a real consumer needs a callback signature beyond the ordinary one-parameter cases; use that evidence to define the supported contract.

## Open questions

- Should admission require the same compile-time rule in multiple Platform packages, or may this become a wider utility package with helpers used only once? The north star uses repeated need as the admission rule.
- Do overloaded functions, generic signatures or explicit `this` parameters need a supported contract? The compiler fixtures establish ordinary callback assignment; they do not settle those cases.
