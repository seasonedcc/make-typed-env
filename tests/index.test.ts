import { z } from "zod/mini";
import { describe, expect, test } from "vite-plus/test";
import { makeTypedEnv } from "../src";

describe("makeTypedEnv", () => {
  test("returns parsed values from a valid schema", () => {
    const schema = z.object({
      NODE_ENV: z.literal("production"),
      PORT: z.number(),
    });

    const getEnv = makeTypedEnv(schema);
    const env = getEnv({ NODE_ENV: "production", PORT: 3000 });

    expect(env).toEqual({ NODE_ENV: "production", PORT: 3000 });
  });

  test("applies transform function when provided", () => {
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

    const getEnv = makeTypedEnv(schema, toLowerCase);
    const env = getEnv({ DATABASE_URL: "postgres://localhost", API_KEY: "secret" });

    expect(env).toEqual({ database_url: "postgres://localhost", api_key: "secret" });
  });

  test("throws on validation failure with descriptive message", () => {
    const schema = z.object({
      DATABASE_URL: z.string(),
      NODE_ENV: z.enum(["development", "production", "test"]),
    });

    const getEnv = makeTypedEnv(schema);

    expect(() => getEnv({})).toThrow("Environment validation failed");
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
