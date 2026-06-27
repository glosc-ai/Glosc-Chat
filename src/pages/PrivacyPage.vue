<script setup lang="ts">
import PageHeader from "../components/PageHeader.vue";
import SiteLayout from "../components/SiteLayout.vue";

const sections = [
  {
    title: "我们收集什么",
    body: [
      "Glosc Chat 的默认设计是本地优先。会话、消息、模型配置、Provider 元数据和偏好设置默认保存在你的设备上。",
      "如果你通过邮件、GitHub Issues 或其他渠道联系我们，我们会收到你主动提供的联系信息、问题描述和必要的技术上下文。"
    ]
  },
  {
    title: "API Key 与 Provider 请求",
    body: [
      "Glosc Chat 采用 BYOK 模式。你自行提供模型服务的 API Key，并自行选择要连接的 Provider。",
      "应用设计上不将 API Key 写入普通本地数据库；密钥应通过系统安全存储保存，导出数据不应包含完整 API Key。",
      "当你发送聊天请求时，请求内容会发送到你配置的模型 Provider。对应 Provider 如何处理数据，受其自身隐私政策和服务条款约束。"
    ]
  },
  {
    title: "本地数据与导出",
    body: [
      "你可以导出聊天内容、配置和备份数据。导出的聊天内容可能包含个人信息、商业信息或其他敏感内容，请自行妥善保存。",
      "导入导出功能不会改变第三方 Provider 已收到的数据处理方式。"
    ]
  },
  {
    title: "我们不默认做什么",
    body: [
      "我们不默认托管你的 API Key。",
      "我们不默认建立服务端保存你的聊天历史。",
      "我们不默认把你的会话同步到额外平台。后续如果提供同步能力，应作为独立可选功能说明加密边界。"
    ]
  },
  {
    title: "联系我们",
    body: ["如需咨询隐私问题，可发送邮件至 support@gloscai.com。"]
  }
];
</script>

<template>
  <SiteLayout>
    <PageHeader
      eyebrow="Privacy"
      title="隐私政策"
      description="本政策说明 Glosc Chat 如何处理本地数据、API Key、Provider 请求和用户主动提交的支持信息。最后更新：2026 年 6 月 28 日。"
    />

    <section class="bg-white">
      <div class="mx-auto max-w-4xl px-5 py-16 sm:px-8">
        <div class="space-y-10">
          <article v-for="section in sections" :key="section.title" class="policy-section">
            <h2>{{ section.title }}</h2>
            <p v-for="paragraph in section.body" :key="paragraph">{{ paragraph }}</p>
          </article>
        </div>
      </div>
    </section>
  </SiteLayout>
</template>
