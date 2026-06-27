<script setup lang="ts">
import { Bot, Check, KeyRound, Paperclip, SendHorizontal } from "@lucide/vue";
</script>

<template>
  <div class="relative mx-auto w-full max-w-[420px]" aria-label="Glosc Chat 应用界面预览">
    <div class="absolute inset-x-10 top-8 h-56 rounded-full bg-moss-100 blur-3xl"></div>
    <div class="relative rounded-[2rem] border border-black/12 bg-ink-950 p-3 shadow-soft">
      <div class="rounded-[1.45rem] bg-[#f9f7f1] p-4">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-ink-500">当前模型</p>
            <p class="text-sm font-semibold text-ink-950">OpenAI-compatible / GPT-4.1</p>
          </div>
          <span class="inline-flex items-center gap-1 rounded-full bg-moss-100 px-3 py-1 text-xs font-semibold text-moss-700">
            <Check class="size-3.5" aria-hidden="true" />
            本地保存
          </span>
        </div>

        <div class="space-y-3">
          <div class="max-w-[82%] rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm">
            <p class="text-sm leading-6 text-ink-700">
              帮我把今天的产品想法整理成一份发布计划。
            </p>
          </div>
          <div class="ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-ink-950 px-4 py-3 text-white">
            <div class="mb-2 flex items-center gap-2 text-xs font-semibold text-white/76">
              <Bot class="size-4" aria-hidden="true" />
              Glosc Chat
            </div>
            <p class="text-sm leading-6 text-white/82">
              可以。先按目标用户、核心价值、发布检查和风险恢复四部分拆解，适合移动端快速审阅。
            </p>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-2xl bg-sun-100 px-3 py-3 text-xs font-semibold text-ink-900">
              Provider 自定义
            </div>
            <div class="rounded-2xl bg-clay-100 px-3 py-3 text-xs font-semibold text-ink-900">
              Markdown 导出
            </div>
          </div>
        </div>

        <div class="mt-5 rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
          <div class="flex items-center gap-2">
            <button class="grid size-9 shrink-0 place-items-center rounded-full bg-[#f4f1e8] text-ink-700" type="button">
              <Paperclip class="size-4" aria-hidden="true" />
            </button>
            <div class="min-w-0 flex-1 rounded-full bg-[#f4f1e8] px-4 py-2 text-sm text-ink-500">
              输入消息，选择模型发送
            </div>
            <button class="grid size-9 shrink-0 place-items-center rounded-full bg-moss-700 text-white" type="button">
              <SendHorizontal class="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="absolute -left-3 top-16 hidden rounded-2xl bg-white p-4 shadow-soft sm:block">
      <KeyRound class="mb-2 size-5 text-moss-700" aria-hidden="true" />
      <p class="text-xs font-semibold text-ink-950">API Key 不进普通数据库</p>
    </div>
  </div>
</template>
