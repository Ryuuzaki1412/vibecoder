import { useCallback, useEffect, useState } from "react";
import type { AIConfig } from "../types";
import { loadAIConfig, saveAIConfig } from "../lib/storage";

export function useSettings() {
  const [config, setConfig] = useState<AIConfig>(() => loadAIConfig());

  useEffect(() => {
    saveAIConfig(config);
  }, [config]);

  const updateConfig = useCallback((patch: Partial<AIConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKey: "",
      model: "claude-3-5-sonnet-latest",
      timeoutSecs: 120,
    });
  }, []);

  return { config, updateConfig, resetConfig };
}