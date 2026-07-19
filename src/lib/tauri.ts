import { invoke } from "@tauri-apps/api/core";
import type { AIConfig } from "../types";

// ============================================================
// Tauri command wrappers
// All AI calls go through the Rust backend so we never expose
// the API key to the webview's console.
// ============================================================

export interface AIResult {
  text: string;
}

export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  return await invoke<string>("call_ai", {
    config,
    systemPrompt,
    userMessage,
  });
}

export async function testAI(config: AIConfig): Promise<string> {
  return await invoke<string>("test_ai", { config });
}