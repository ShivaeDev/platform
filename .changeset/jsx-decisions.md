---
"@shivaedev/quality": minor
---

### Breaking

- Apps get new findings from `react/jsx-conditionals` for `&&` and ternaries in JSX children. Decide before the JSX with early returns or a precomputed variable, or extract a component that returns `null`; inside `.map`, extract an item component. Attribute values remain accepted. Record existing findings with `quality baseline write --rule react/jsx-conditionals`. The shared Biome preset turns off `noLeakedRender`, whose ternary repair is also reported by the new rule.
