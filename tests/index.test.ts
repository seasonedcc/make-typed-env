import { z } from "zod/mini";
import { describe, expect, test, vi } from "vite-plus/test";
import { camelKeys } from "string-ts";
import { EnvValidationError, makeTypedEnv } from "../src";

describe("makeTypedEnv", () => {
  test("returns parsed values from a valid schema", () => {
    const schema = z.object({
      NODE_ENV: z.literal("production"),
      PORT: z.number(),
    });

    const getEnv = makeTypedEnv(schema);
    const env = getEnv({ NODE_ENV: "production", PORT: 3000 });

    type _Env = Expect<Equal<typeof env, { NODE_ENV: "production"; PORT: number }>>;

    expect(env).toEqual({ NODE_ENV: "production", PORT: 3000 });
  });

  test("applies transform via options", () => {
    const schema = z.object({
      DATABASE_URL: z.string(),
      API_KEY: z.string(),
    });

    const toLowerCase = (obj: Record<string, unknown>) => {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(obj)) {
        result[key.toLowerCase()] = obj[key];
      }
      return result;
    };

    const getEnv = makeTypedEnv(schema, { transform: toLowerCase });
    const env = getEnv({ DATABASE_URL: "postgres://localhost", API_KEY: "secret" });

    type _Env = Expect<Equal<typeof env, Record<string, unknown>>>;

    expect(env).toEqual({ database_url: "postgres://localhost", api_key: "secret" });
  });

  test("throws EnvValidationError with variable names and error count", () => {
    const schema = z.object({
      DATABASE_URL: z.string(),
      NODE_ENV: z.enum(["development", "production", "test"]),
    });

    const getEnv = makeTypedEnv(schema);

    expect(() => getEnv({})).toThrow(EnvValidationError);
    expect(() => getEnv({})).toThrow("Environment validation failed (2 errors)");
    expect(() => getEnv({})).toThrow("✗ DATABASE_URL:");
    expect(() => getEnv({})).toThrow("✗ NODE_ENV:");
  });

  test("EnvValidationError exposes issues array and correct name", () => {
    const schema = z.object({ SECRET: z.string() });
    const getEnv = makeTypedEnv(schema);

    try {
      getEnv({});
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(EnvValidationError);
      const err = e as EnvValidationError;
      expect(err.name).toBe("EnvValidationError");
      expect(err.issues).toHaveLength(1);
      expect(err.issues[0].path).toEqual(["SECRET"]);
    }
  });

  test("EnvValidationError.toJSON() returns structured data for loggers", () => {
    const schema = z.object({ API_KEY: z.string(), DB_HOST: z.string() });
    const getEnv = makeTypedEnv(schema);

    try {
      getEnv({});
      expect.unreachable("should have thrown");
    } catch (e) {
      const err = e as EnvValidationError;
      const json = err.toJSON();
      expect(json.name).toBe("EnvValidationError");
      expect(json.message).toContain("Environment validation failed");
      expect(json.issues).toHaveLength(2);
    }
  });

  test("shows singular 'error' for single validation failure", () => {
    const schema = z.object({
      ONLY_VAR: z.string(),
    });

    const getEnv = makeTypedEnv(schema);

    expect(() => getEnv({})).toThrow("(1 error)");
  });

  test("falls back to message-only when path is empty (root-level check)", () => {
    const schema = z.object({ FOO: z.string() }).check(
      z.check((ctx) => {
        ctx.issues.push({ message: "Root-level failure", path: [], code: "custom", input: ctx });
      }),
    );

    const getEnv = makeTypedEnv(schema);

    expect(() => getEnv({ FOO: "valid" })).toThrow("✗ Root-level failure");
  });

  test("throws TypeError on async schema", () => {
    const asyncSchema = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: () => Promise.resolve({ value: {} }),
      },
    };

    const getEnv = makeTypedEnv(asyncSchema);

    expect(() => getEnv({})).toThrow(TypeError);
    expect(() => getEnv({})).toThrow("Async schemas are not supported");
  });
});

describe("caching", () => {
  test("does not cache by default", () => {
    const schema = z.object({ FOO: z.string() });
    const spy = vi.spyOn(schema["~standard"], "validate");

    const getEnv = makeTypedEnv(schema);
    const args = { FOO: "bar" };

    getEnv(args);
    getEnv(args);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("cache: true caches by args reference", () => {
    const schema = z.object({ FOO: z.string() });
    const spy = vi.spyOn(schema["~standard"], "validate");

    const getEnv = makeTypedEnv(schema, { cache: true });
    const args = { FOO: "bar" };

    const first = getEnv(args);
    const second = getEnv(args);

    expect(first).toBe(second);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("cache: true re-validates with a different args reference", () => {
    const schema = z.object({ FOO: z.string() });
    const spy = vi.spyOn(schema["~standard"], "validate");

    const getEnv = makeTypedEnv(schema, { cache: true });

    const first = getEnv({ FOO: "a" });
    const second = getEnv({ FOO: "b" });

    expect(first).not.toBe(second);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("type tests", () => {
  test("without options returns the schema output type", () => {
    const schema = z.object({
      DATABASE_URL: z.string(),
      PORT: z.number(),
      DEBUG: z.boolean(),
    });

    const getEnv = makeTypedEnv(schema);

    type _GetEnv = Expect<
      Equal<
        typeof getEnv,
        (args: Record<string, unknown>) => { DATABASE_URL: string; PORT: number; DEBUG: boolean }
      >
    >;
  });

  test("with transform returns the transform output type", () => {
    const schema = z.object({
      DATABASE_URL: z.string(),
      PORT: z.number(),
    });

    const transform = (obj: { DATABASE_URL: string; PORT: number }) => ({
      db: obj.DATABASE_URL,
      port: obj.PORT,
    });

    const getEnv = makeTypedEnv(schema, { transform });

    type _GetEnv = Expect<
      Equal<typeof getEnv, (args: Record<string, unknown>) => { db: string; port: number }>
    >;
  });

  test("infers literal and union types from schema", () => {
    const schema = z.object({
      NODE_ENV: z.enum(["development", "production", "test"]),
      OPTIONAL: z.optional(z.string()),
    });

    const getEnv = makeTypedEnv(schema);
    type Env = ReturnType<typeof getEnv>;

    type _NodeEnv = Expect<Equal<Env["NODE_ENV"], "development" | "production" | "test">>;
    type _Optional = Expect<Equal<Env["OPTIONAL"], string | undefined>>;
  });

  test("accepts Record<string, unknown> as args", () => {
    const schema = z.object({ FOO: z.string() });
    const getEnv = makeTypedEnv(schema);

    type _Args = Expect<Equal<Parameters<typeof getEnv>, [args: Record<string, unknown>]>>;
  });

  test("infers correct return type with generic transform like camelKeys", () => {
    const schema = z.object({
      FOO_BAR: z.string(),
      BAZ_QUX: z.number(),
    });

    const getEnv = makeTypedEnv(schema, { transform: camelKeys });
    type Env = ReturnType<typeof getEnv>;

    type _Env = Expect<Equal<Env, { fooBar: string; bazQux: number }>>;
  });
});
