# make-typed-env

Type-safe environment variables for TypeScript. Validate with any schema library, transform keys however you want.

## Features

🛡️ Validates all env vars against a schema — fail fast at startup, not with cryptic `undefined` in production.

🔮 Fully typed return object — autocomplete, type errors, and zero manual annotations.

🔌 Works with any [Standard Schema](https://standardschema.dev/) library — Zod, Valibot, ArkType, and more.

🔑 Accepts `process.env`, `import.meta.env`, or any `Record<string, unknown>`.

🔄 Optional key transformation — pass [`camelKeys`](https://github.com/gustavoguichard/string-ts) or any function to reshape the output with full type inference.

⚡ Built-in caching by reference — re-validates only when the args object changes.

📋 Replaces `.env.sample` files — your schema _is_ the documentation for required variables.

🪶 Zero runtime dependencies.

## Install

```bash
npm install make-typed-env
```

## Usage

### With `process.env`

```ts
import { makeTypedEnv } from "make-typed-env";
import { z } from "zod";

const getEnv = makeTypedEnv(
  z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string(),
    SESSION_SECRET: z.string().min(1),
  }),
);

const env = getEnv(process.env);
// env.NODE_ENV       → 'development' | 'production' | 'test'
// env.DATABASE_URL   → string
// env.SESSION_SECRET → string
```

### With `import.meta.env` (Vite)

Vite exposes variables prefixed with `VITE_` to the client via `import.meta.env`:

```ts
const getPublicEnv = makeTypedEnv(
  z.object({
    VITE_GOOGLE_MAPS_API_KEY: z.string(),
    VITE_STRIPE_PUBLIC_KEY: z.string(),
  }),
  { transform: camelKeys },
);

const env = getPublicEnv(import.meta.env);
// env.viteGoogleMapsApiKey → string
// env.viteStripePublicKey  → string
```

### With Deno, Bun, Cloudflare Workers...

It works with any `Record<string, unknown>` — not tied to Node.js:

```ts
// Deno
const env = getEnv(Deno.env.toObject());

// Bun
const env = getEnv(Bun.env);
```

## Transforming keys

Pass a `transform` function in the options to reshape the parsed object. Combine with [`string-ts`](https://github.com/gustavoguichard/string-ts) for type-safe key transformations:

```bash
npm install string-ts
```

```ts
import { makeTypedEnv } from "make-typed-env";
import { camelKeys } from "string-ts";
import { z } from "zod";

const getEnv = makeTypedEnv(
  z.object({
    DATABASE_URL: z.string(),
    SESSION_SECRET: z.string().min(1),
    STRIPE_API_KEY: z.string().min(1),
  }),
  { transform: camelKeys },
);

const env = getEnv(process.env);
// env.databaseUrl   → string
// env.sessionSecret → string
// env.stripeApiKey  → string
```

The return type is `CamelKeys<T>` — fully inferred, no manual type annotations needed.

Any of the key transformation functions from `string-ts` work:

```ts
import { snakeKeys, kebabKeys, pascalKeys } from "string-ts";

makeTypedEnv(schema, { transform: snakeKeys });
makeTypedEnv(schema, { transform: kebabKeys });
makeTypedEnv(schema, { transform: pascalKeys });
```

Or write your own:

```ts
const getEnv = makeTypedEnv(schema, {
  transform: (parsed) => ({
    db: parsed.DATABASE_URL,
    secret: parsed.SESSION_SECRET,
  }),
});
```

## Schema libraries

`make-typed-env` works with any library that implements the [Standard Schema](https://standardschema.dev/) spec.

### Zod

```ts
import { z } from "zod";

const getEnv = makeTypedEnv(
  z.object({
    PORT: z.coerce.number().default(3000),
    DEBUG: z.coerce.boolean().default(false),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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

## Patterns

### Splitting public and server environments

Separate variables safe for the client from server-only secrets:

```ts
// env.shared.ts
import { makeTypedEnv } from "make-typed-env";
import { camelKeys } from "string-ts";
import { z } from "zod";

const publicSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  VITE_STRIPE_PUBLIC_KEY: z.string().min(1),
  VITE_SENTRY_DSN: z.string().optional(),
});

const getPublicEnv = makeTypedEnv(publicSchema, { transform: camelKeys });
export { getPublicEnv, publicSchema };
```

```ts
// env.server.ts
import { makeTypedEnv } from "make-typed-env";
import { camelKeys } from "string-ts";
import { z } from "zod";
import { publicSchema } from "./env.shared";

const serverSchema = publicSchema.extend({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
});

const getEnv = makeTypedEnv(serverSchema, { transform: camelKeys });
export const env = () => getEnv(process.env);
```

### Caching

Results are cached by reference by default. When called with the same args object (e.g., `process.env`), validation runs only once:

```ts
const getEnv = makeTypedEnv(schema);

getEnv(process.env); // validates
getEnv(process.env); // cached — same reference
getEnv(import.meta.env); // validates — different reference
```

Disable caching with `cache: false` if you need to re-validate on every call:

```ts
const getEnv = makeTypedEnv(schema, { cache: false });
```

### Stripping prefixes

Use `replaceKeys` from `string-ts` to strip prefixes like `VITE_` before camelCasing:

```ts
import { camelKeys, replaceKeys } from "string-ts";

const getEnv = makeTypedEnv(schema, {
  transform: (parsed) => camelKeys(replaceKeys(parsed, "VITE_", "")),
});
// VITE_GOOGLE_MAPS_API_KEY → googleMapsApiKey
```

## Error messages

When validation fails, you get a clear error listing every issue:

```
Environment validation failed:
  - DATABASE_URL is required
  - SESSION_SECRET must be at least 1 character
```

No more guessing which variable is missing.

## API

### `makeTypedEnv(schema)`

Returns a function `(args: Record<string, unknown>) => T` that validates `args` against the schema and returns the parsed result. Caches by default.

### `makeTypedEnv(schema, options)`

| Option      | Type               | Default | Description                                                        |
| ----------- | ------------------ | ------- | ------------------------------------------------------------------ |
| `transform` | `(parsed: T) => R` | —       | Transform the parsed result. Return type is inferred.              |
| `cache`     | `boolean`          | `true`  | Cache by args reference. Set to `false` to re-validate every call. |

### Errors

- Throws `Error` with a descriptive message when validation fails
- Throws `TypeError` if an async schema is passed (environment parsing is synchronous)
