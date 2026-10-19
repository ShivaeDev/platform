---
"@shivaedev/work-board": patch
---

### Fixed

- Under `moduleResolution: nodenext`, the error channels of `HandoffsService` and of the `Responses` and `Workspace` services in `responses` keep their typed errors. Their declarations used relative imports without a file extension, which NodeNext cannot resolve, so the errors read as `any`.
