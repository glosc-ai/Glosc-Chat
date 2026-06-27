<script setup lang="ts">
import PageHeader from "../components/PageHeader.vue";
import SiteLayout from "../components/SiteLayout.vue";

const sections = [
  {
    title: "服务范围",
    body: [
      "Glosc Chat 是一个多模型 AI 聊天客户端，用于连接你自行配置的模型 Provider，并在本机管理会话、模型配置和偏好设置。",
      "Glosc Chat 不提供模型推理服务本身。模型输出、可用性、费用、速率限制和数据处理由你选择的 Provider 决定。"
    ]
  },
  {
    title: "你的责任",
    body: [
      "你需要确保自己有权使用所配置的 API Key、模型服务、Base URL 和相关数据。",
      "你应遵守对应 Provider 的服务条款，不应使用本应用生成或处理违法、侵权、危险或违反第三方规则的内容。",
      "你应自行备份重要会话和配置，并妥善保管导出的文件。"
    ]
  },
  {
    title: "应用状态",
    body: [
      "Glosc Chat 仍在持续开发中，部分能力可能随版本变化调整。",
      "我们会尽力保持数据结构、导入导出和配置路径的稳定，但不能保证所有版本都完全无故障或永久兼容。"
    ]
  },
  {
    title: "免责声明",
    body: [
      "AI 模型输出可能不准确、不完整或不适合直接用于医疗、法律、金融等高风险决策。你需要自行核验输出内容。",
      "因第三方 Provider 故障、密钥失效、网络问题、设备损坏或用户配置错误导致的影响，需要根据具体责任边界处理。"
    ]
  },
  {
    title: "条款更新",
    body: [
      "我们可能根据产品变化更新本条款。更新后会在官网页面标注新的日期。",
      "如对条款有疑问，请联系 support@gloscai.com。"
    ]
  }
];
</script>

<template>
  <SiteLayout>
    <PageHeader
      eyebrow="Terms"
      title="服务条款"
      description="使用 Glosc Chat 前，请了解客户端、第三方模型 Provider、API Key 和本地数据之间的责任边界。最后更新：2026 年 6 月 28 日。"
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
