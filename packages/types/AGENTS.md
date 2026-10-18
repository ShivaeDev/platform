# @shivaedev/types

You are changing the shared compile-time helpers that keep Platform packages from repeating the same TypeScript rule. A function property normally checks its parameters strictly; some boundaries must collect callbacks with different input types. `Bivariant` makes that exception explicit without changing the callback's implementation. Keep application types with the package that owns them and runtime behavior with the package that executes it. This is not a general TypeScript utility catalogue: a helper exposes the TypeScript mechanism rather than a new type vocabulary.

When goals conflict, prefer a precise ordinary TypeScript type, then an explicit and narrowly placed relaxation, then a shared helper over repeated definitions. A helper belongs here when multiple Platform packages need the same compile-time rule. Keep its effect visible at the use site; a shorter declaration is not worth making every callback permissive. Compiler regressions must show both the assignment the helper permits and the mistake it still rejects. Do not treat compilation as proof that a caller supplies valid data at runtime.

The usage guide is in [README.md](README.md).
