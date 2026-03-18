---
name: make-typed-env-usage
description: Generate code examples and usage patterns for the make-typed-env library. Use when writing examples, documentation, demos, answering questions about the make-typed-env API, or helping users set up type-safe environment variables with Standard Schema, Zod, Valibot, ArkType, or string-ts key transformations.
---

# make-typed-env Usage Guide

## What is make-typed-env?

A minimal library for type-safe environment variables in TypeScript. It validates any `Record<string, unknown>` — `process.env`, `import.meta.env`, `Deno.env.toObject()`, `Bun.env` — against any [Standard Schema](https://standardschema.dev/) compatible schema and optionally transforms the output.

Zero runtime dependencies. Works with Zod, Valibot, ArkType, or any Standard Schema implementor.

## API

### `makeTypedEnv(schema)`

Accept a Standard Schema and return a function that validates and returns the parsed result.

```ts
import { makeTypedEnv } from "make-typed-env";
import { z } from "zod";

const getEnv = makeTypedEnv(
  z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string(),
  }),
);

const env = getEnv(process.env);
// type: { NODE_ENV: "development" | "production" | "test"; DATABASE_URL: string }
```

### `makeTypedEnv(schema, transform)`

Accept a second argument to transform the parsed result. The return type is inferred from the transform function.

```ts
import { makeTypedEnv } from "make-typed-env";
import { camelKeys } from "string-ts";
import { z } from "zod";

const getEnv = makeTypedEnv(
  z.object({
    DATABASE_URL: z.string(),
    SESSION_SECRET: z.string().min(1),
  }),
  camelKeys,
);

const env = getEnv(process.env);
// type: { databaseUrl: string; sessionSecret: string }
```

## Input sources

The returned function accepts any `Record<string, unknown>`:

```ts
// Node.js
getEnv(process.env);

// Vite (client-side VITE_ prefixed vars)
getEnv(import.meta.env);

// Deno
getEnv(Deno.env.toObject());

// Bun
getEnv(Bun.env);
```

## Key transformation with string-ts

Combine with [`string-ts`](https://github.com/gustavoguichard/string-ts) for type-level key transformations. Any of the `*Keys` functions work:

```ts
import { camelKeys, snakeKeys, kebabKeys, pascalKeys } from "string-ts";

makeTypedEnv(schema, camelKeys); // SCREAMING_SNAKE → camelCase
makeTypedEnv(schema, snakeKeys); // camelCase → snake_case
makeTypedEnv(schema, kebabKeys); // camelCase → kebab-case
makeTypedEnv(schema, pascalKeys); // snake_case → PascalCase
```

Custom transforms also work:

```ts
const getEnv = makeTypedEnv(schema, (parsed) => ({
  db: parsed.DATABASE_URL,
  secret: parsed.SESSION_SECRET,
}));
```

### Stripping prefixes

Use `replaceKeys` from `string-ts` to strip prefixes like `VITE_` before camelCasing:

```ts
import { camelKeys, replaceKeys } from "string-ts";

const getEnv = makeTypedEnv(schema, (parsed) => camelKeys(replaceKeys(parsed, "VITE_", "")));
// VITE_GOOGLE_MAPS_API_KEY → googleMapsApiKey
```

## Schema libraries

### Zod

```ts
import { z } from "zod";

const getEnv = makeTypedEnv(
  z.object({
    PORT: z.coerce.number().default(3000),
    DEBUG: z.coerce.boolean().default(false),
  }),
);
```

### Zod Mini

```ts
import { z } from "zod/mini";

const getEnv = makeTypedEnv(
  z.object({
    PORT: z.string(),
    DATABASE_URL: z.string(),
  }),
);
```

### Valibot

```ts
import * as v from "valibot";

const getEnv = makeTypedEnv(
  v.object({
    PORT: v.pipe(v.unknown(), v.transform(Number)),
    DATABASE_URL: v.pipe(v.string(), v.minLength(1)),
  }),
);
```

### ArkType

```ts
import { type } from "arktype";

const getEnv = makeTypedEnv(
  type({
    PORT: "string",
    DATABASE_URL: "string",
  }),
);
```

## Common patterns

### Split public and server environments

```ts
// env.shared.ts
const publicSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  VITE_STRIPE_PUBLIC_KEY: z.string().min(1),
  VITE_SENTRY_DSN: z.string().optional(),
});

const getPublicEnv = makeTypedEnv(publicSchema, camelKeys);
export { getPublicEnv, publicSchema };

// env.server.ts
const serverSchema = publicSchema.extend({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
});

const getEnv = makeTypedEnv(serverSchema, camelKeys);
export const env = () => getEnv(process.env);
```

### Lazy singleton

Defer validation until first access:

```ts
const getEnv = makeTypedEnv(schema, camelKeys);
export const env = () => getEnv(process.env);
```

### Vite client-side env

Use `import.meta.env` for `VITE_` prefixed variables exposed by Vite:

```ts
const getPublicEnv = makeTypedEnv(
  z.object({
    VITE_GOOGLE_MAPS_API_KEY: z.string(),
    VITE_STRIPE_PUBLIC_KEY: z.string(),
  }),
  camelKeys,
);

const env = getPublicEnv(import.meta.env);
// env.viteGoogleMapsApiKey → string
```

## Error behavior

- Throws `Error` with a message listing all validation issues when schema validation fails
- Throws `TypeError` if an async schema is passed (environment parsing is synchronous)

## Implementation notes

- Uses the [Standard Schema](https://standardschema.dev/) `~standard.validate()` interface
- `@standard-schema/spec` is a types-only dev dependency — zero runtime cost
- The transform function's return type flows through generics, so `camelKeys` produces `CamelKeys<T>` at the type level automatically
