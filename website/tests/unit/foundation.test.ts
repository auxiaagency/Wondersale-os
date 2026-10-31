import { describe, it, expect } from "vitest";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

describe("Foundation checks", () => {
  it("loads and validates environment configuration properly", () => {
    expect(env).toBeDefined();
    expect(env.NODE_ENV).toBeDefined();
    expect(typeof env.DATABASE_URL).toBe("string");
  });

  it("exports logger with expected methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });
});
