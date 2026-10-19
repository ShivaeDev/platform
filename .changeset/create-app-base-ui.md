---
"@shivaedev/create-app": patch
---

### Changed

- Generated apps use stock shadcn Base UI components instead of Radix. In apps generated earlier, re-add badge, button, tabs and tooltip from the Base UI registry and replace `asChild` composition with the `render` prop (for example, `<Button render={<a href="/notes" />}>Notes</Button>`). Use `TooltipProvider`'s `delay` prop instead of `delayDuration`.
