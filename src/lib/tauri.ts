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

// ============================================================
// Online update
// ============================================================

export interface UpdateAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_name: string | null;
  release_notes: string | null;
  release_url: string;
  published_at: string | null;
  assets: UpdateAsset[];
}

export async function checkUpdate(): Promise<UpdateInfo> {
  return await invoke<UpdateInfo>("check_update");
}

export async function downloadUpdate(
  url: string,
  filename: string,
): Promise<string> {
  return await invoke<string>("download_update", { url, filename });
}