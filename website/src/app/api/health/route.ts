import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function GET() {
  const startTime = Date.now();
  try {
    const healthStatus = {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: "0.1.0",
      latencyMs: Date.now() - startTime,
    };

    logger.info("Health check requested", { status: "ok" });
    return NextResponse.json(healthStatus, { status: 200 });
  } catch (error) {
    logger.error("Health check failed", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Health check failed",
      },
      { status: 503 }
    );
  }
}
