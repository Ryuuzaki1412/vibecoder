import { useCallback, useEffect, useState } from "react";
import type { PromptTemplate } from "../types";
import { loadTemplates, saveTemplates, uid, nowSecs } from "../lib/storage";

export function useTemplates() {
  const [templates, setTemplates] = useState<PromptTemplate[]>(() =>
    loadTemplates(),
  );

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  const addTemplate = useCallback(
    (
      name: string,
      content: string,
      type: PromptTemplate["type"] = "custom",
    ): PromptTemplate => {
      const tpl: PromptTemplate = {
        id: uid(),
        name,
        content,
        type,
        createdAt: nowSecs(),
      };
      setTemplates((prev) => [tpl, ...prev]);
      return tpl;
    },
    [],
  );

  const updateTemplate = useCallback(
    (id: string, patch: Partial<Omit<PromptTemplate, "id" | "createdAt">>) => {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const resetDefaults = useCallback(() => {
    // Clear and re-seed (keeps the original 3 preset ids so they're recognised as defaults)
    setTemplates((prev) => {
      const defaults = prev.filter((t) =>
        ["tpl-polish-default", "tpl-mvp-default", "tpl-code-default"].includes(
          t.id,
        ),
      );
      // If user has deleted all defaults, re-add them
      if (defaults.length === 0) {
        const rehydrated: PromptTemplate[] = [
          {
            id: "tpl-polish-default",
            name: "润色助手",
            type: "polish",
            content:
              "请润色以下内容,保持原意,使表达更清晰、专业、有条理:\n\n{{content}}",
            createdAt: nowSecs(),
          },
          {
            id: "tpl-mvp-default",
            name: "MVP 产品方案",
            type: "mvp",
            content: `你是一位资深产品经理和全栈工程师。请根据以下想法生成 MVP 产品方案:

想法:{{content}}

请输出:
1. **产品名称** + 一句话介绍
2. **核心功能** (3-5 个,按优先级排序)
3. **目标用户**
4. **技术栈建议**
5. **开发步骤** (MVP 最小可发布)
6. **预期上线时间** (1 人全职)`,
            createdAt: nowSecs() + 1,
          },
          {
            id: "tpl-code-default",
            name: "快速原型代码",
            type: "custom",
            content: `根据以下需求生成可运行的原型代码:

需求:{{content}}

要求:
- 优先 Python / TypeScript
- 完整可运行,带注释
- 提供使用示例`,
            createdAt: nowSecs() + 2,
          },
        ];
        return [...rehydrated, ...prev];
      }
      return prev;
    });
  }, []);

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetDefaults,
  };
}