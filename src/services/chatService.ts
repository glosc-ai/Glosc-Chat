export async function streamMockAssistantReply(
  prompt: string,
  modelName: string,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = chooseResponse(prompt, modelName);

  for (const chunk of Array.from(response)) {
    if (signal.aborted) {
      throw new DOMException("Streaming aborted", "AbortError");
    }

    onChunk(chunk);
    await wait(14 + Math.random() * 18, signal);
  }
}

function chooseResponse(prompt: string, modelName: string): string {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("python") || prompt.includes("代码")) {
    return `可以。这里给你一个尽量小的 Python 示例，用来表达完整流程：\n\n\`\`\`python\ndef summarize(items: list[str]) -> str:\n    cleaned = [item.strip() for item in items if item.strip()]\n    return "；".join(cleaned[:3])\n\nprint(summarize(["读取输入", "清洗数据", "输出结果"]))\n\`\`\`\n\n如果要接入 Glosc Chat 的消息流，建议把输入校验、Provider 调用、持久化分别放到不同服务里，UI 只订阅状态变化。`;
  }

  if (prompt.includes("翻译")) {
    return "可以翻译。建议把原文粘贴过来，并说明目标语气，例如正式、口语、技术文档或产品文案。";
  }

  if (prompt.includes("总结") || prompt.includes("要点")) {
    return "我会按三个层次总结：核心结论、关键依据、后续动作。当前这段内容的处理建议是先提取主题，再合并重复信息，最后把可执行事项单独列出。";
  }

  if (prompt.includes("量子")) {
    return "量子计算的基本单位是量子比特。它可以处于叠加态，并通过纠缠和干涉让某些计算路径的概率增强。\n\n需要注意的是，量子计算并不是对所有问题都更快。它更适合特定算法和问题类型，例如量子模拟、部分搜索问题和大整数分解。";
  }

  if (prompt.includes("provider") || prompt.includes("api")) {
    return "Glosc Chat 里 Provider 的关键边界是：UI 不直接拼接供应商请求，业务服务只依赖统一的 Provider Adapter，API Key 只通过安全存储引用进入请求过程。\n\n当前这个 Vue/Tauri 版本已经把 Provider 配置、模型列表和聊天状态分开，后续可以把模拟响应替换成 Rust 网络代理或安全存储插件。";
  }

  return `收到。我会用 ${modelName} 的上下文来处理这个问题。\n\n从产品实现角度，建议先保证聊天闭环稳定：保存用户消息、创建助手占位、流式更新、支持停止和重试，再逐步接入真实 Provider、知识库和工具调用。`;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Streaming aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
