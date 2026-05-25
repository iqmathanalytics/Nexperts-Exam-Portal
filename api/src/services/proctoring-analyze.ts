import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../lib/env.js";

export type FrameAnalysis = {
  person_count: number;
  phone_detected: boolean;
  face_detected: boolean;
  violations: string[];
  violation_count: number;
  source: "yolo" | "opencv" | "unavailable";
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROCTORING_DIR = path.resolve(__dirname, "../../../proctoring-service");

async function analyzeViaHttp(frame: string): Promise<FrameAnalysis | null> {
  if (!env.proctoringServiceUrl) return null;
  try {
    const res = await fetch(`${env.proctoringServiceUrl.replace(/\/$/, "")}/analyze-frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as FrameAnalysis & { source?: string };
    return {
      ...data,
      source: (data.source as FrameAnalysis["source"]) ?? "opencv",
    };
  } catch {
    return null;
  }
}

function analyzeViaPythonScript(frame: string): Promise<FrameAnalysis | null> {
  return new Promise((resolve) => {
    const script = path.join(PROCTORING_DIR, "analyze_once.py");
    const proc = spawn("python", [script], { cwd: PROCTORING_DIR, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", () => {});
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        const data = JSON.parse(out) as FrameAnalysis;
        resolve({ ...data, source: data.source ?? "opencv" });
      } catch {
        resolve(null);
      }
    });
    proc.stdin.write(JSON.stringify({ frame }));
    proc.stdin.end();
  });
}

export async function analyzeProctoringFrame(frame: string): Promise<FrameAnalysis> {
  const http = await analyzeViaHttp(frame);
  if (http) return http;

  const script = await analyzeViaPythonScript(frame);
  if (script) return script;

  return {
    person_count: 0,
    phone_detected: false,
    face_detected: true,
    violations: [],
    violation_count: 0,
    source: "unavailable",
  };
}
