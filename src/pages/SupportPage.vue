<script setup lang="ts">
import { CircleHelp, ExternalLink, Mail, RefreshCw, Settings2, ShieldAlert, Wrench } from "@lucide/vue";
import PageHeader from "../components/PageHeader.vue";
import SiteLayout from "../components/SiteLayout.vue";

const supportCards = [
  {
    icon: Mail,
    title: "邮件支持",
    text: "描述设备、系统版本、应用版本、Provider 类型和复现步骤。",
    action: "support@gloscai.com",
    href: "mailto:support@gloscai.com"
  },
  {
    icon: ExternalLink,
    title: "GitHub Issues",
    text: "适合提交可复现的缺陷、构建问题和功能建议。",
    action: "打开项目",
    href: "https://github.com/glosc-ai/Glosc-Chat/issues"
  }
];

const checks = [
  {
    icon: Settings2,
    title: "Provider 连接失败",
    text: "检查 API Base URL 是否包含正确路径，API Key 是否仍有效，模型名是否与供应商返回一致。"
  },
  {
    icon: RefreshCw,
    title: "流式回复中断",
    text: "先重试当前消息；如果反复发生，切换网络或降低上下文消息数量后再发送。"
  },
  {
    icon: ShieldAlert,
    title: "隐私和密钥问题",
    text: "导出数据不应包含 API Key。如怀疑密钥泄露，请立即到对应 Provider 后台轮换密钥。"
  }
];
</script>

<template>
  <SiteLayout>
    <PageHeader
      eyebrow="Support"
      title="技术支持"
      description="这里整理 Glosc Chat 的常见排障路径、反馈方式和提交问题时需要提供的信息。"
    />

    <section class="bg-white">
      <div class="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div class="grid gap-4 md:grid-cols-2">
          <a
            v-for="card in supportCards"
            :key="card.title"
            :href="card.href"
            class="rounded-lg border border-black/10 bg-[#fbfaf6] p-6 transition hover:-translate-y-0.5 hover:border-moss-700 hover:shadow-soft"
            rel="noreferrer"
            target="_blank"
          >
            <component :is="card.icon" class="mb-5 size-7 text-moss-700" aria-hidden="true" />
            <h2 class="text-xl font-semibold text-ink-950">{{ card.title }}</h2>
            <p class="mt-3 text-sm leading-7 text-ink-700">{{ card.text }}</p>
            <p class="mt-5 text-sm font-semibold text-moss-700">{{ card.action }}</p>
          </a>
        </div>
      </div>
    </section>

    <section class="border-y border-black/10 bg-[#f7f5ef]">
      <div class="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div class="mb-10 flex max-w-3xl items-start gap-4">
          <span class="grid size-11 shrink-0 place-items-center rounded-full bg-moss-100 text-moss-700">
            <Wrench class="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 class="text-3xl font-semibold tracking-normal text-ink-950">优先检查这些问题</h2>
            <p class="mt-3 text-base leading-8 text-ink-700">
              Glosc Chat 采用 BYOK 和本地优先设计，大多数运行问题与 Provider 配置、网络、模型能力或系统权限有关。
            </p>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
          <article v-for="item in checks" :key="item.title" class="rounded-lg border border-black/10 bg-white p-6">
            <component :is="item.icon" class="mb-5 size-7 text-moss-700" aria-hidden="true" />
            <h3 class="text-lg font-semibold text-ink-950">{{ item.title }}</h3>
            <p class="mt-3 text-sm leading-7 text-ink-700">{{ item.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="bg-white">
      <div class="mx-auto max-w-4xl px-5 py-16 sm:px-8">
        <div class="mb-8 flex items-center gap-3">
          <CircleHelp class="size-6 text-moss-700" aria-hidden="true" />
          <h2 class="text-2xl font-semibold text-ink-950">提交问题时请附带</h2>
        </div>
        <div class="prose-list">
          <ul>
            <li>设备型号、系统版本、Glosc Chat 应用版本。</li>
            <li>使用的 Provider 类型、API Base URL 格式和模型名；不要发送完整 API Key。</li>
            <li>触发问题的操作步骤、错误提示截图或脱敏后的错误文本。</li>
            <li>是否开启附件、视觉模型、较长上下文或导入导出操作。</li>
          </ul>
        </div>
      </div>
    </section>
  </SiteLayout>
</template>
