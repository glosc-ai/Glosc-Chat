<script setup lang="ts">
import {
    CloudOff,
    Database,
    Download,
    ExternalLink,
    KeyRound,
    Layers3,
    LockKeyhole,
    ShieldCheck,
    Smartphone,
} from "@lucide/vue";
import ProductPreview from "../components/ProductPreview.vue";
import SiteLayout from "../components/SiteLayout.vue";

const strengths = [
    {
        icon: KeyRound,
        title: "BYOK 模式",
        text: "使用你已有的 API Key 和模型服务，不要求迁移到新的平台账号体系。",
    },
    {
        icon: Layers3,
        title: "多 Provider 统一入口",
        text: "OpenAI-compatible、Anthropic、Gemini 和自定义服务可在同一界面中管理。",
    },
    {
        icon: Database,
        title: "本地会话历史",
        text: "会话、模型配置和偏好默认保存在本机，便于长期保留和备份。",
    },
    {
        icon: ShieldCheck,
        title: "清晰隐私边界",
        text: "应用不默认建设服务端，也不会默认把你的聊天内容上传到额外平台。",
    },
];

const workflows = [
    "添加 Provider、API Base URL、API Key 和模型名",
    "在移动端快速新建会话、切换模型并接收流式回复",
    "搜索、置顶、归档、导出 Markdown 或 JSON 备份",
    "按会话设置系统提示词、上下文数量和常用提示词变量",
];

const screenshots = [
    {
        title: "聊天",
        description: "会话、模型切换和 Markdown 回复在同一个移动端界面里完成。",
        image: "/app-screenshots/glosc-chat-chat.png",
    },
    {
        title: "模型",
        description: "按 Provider 统一管理模型能力、上下文窗口和启用状态。",
        image: "/app-screenshots/glosc-chat-models.png",
    },
    {
        title: "设置",
        description: "本地数据、导入导出、提示词模板和外观偏好集中配置。",
        image: "/app-screenshots/glosc-chat-settings.png",
    },
];
</script>

<template>
    <SiteLayout>
        <section
            class="relative overflow-hidden border-b border-black/10 bg-[#f7f5ef]"
        >
            <div class="absolute inset-0 hero-grid opacity-70"></div>
            <div
                class="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.04fr_0.96fr] lg:py-16"
            >
                <div class="max-w-3xl">
                    <p
                        class="mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/78 px-4 py-2 text-sm font-semibold text-ink-700"
                    >
                        <Smartphone
                            class="size-4 text-moss-700"
                            aria-hidden="true"
                        />
                        移动端优先 · 本地优先 · 多模型
                    </p>
                    <h1
                        class="text-5xl font-semibold leading-[1.02] tracking-normal text-ink-950 sm:text-6xl lg:text-7xl"
                    >
                        Glosc Chat
                    </h1>
                    <p
                        class="mt-6 max-w-2xl text-lg leading-8 text-ink-700 sm:text-xl"
                    >
                        一款 BYOK 多模型 AI 聊天客户端。你自行接入
                        OpenAI-compatible、Anthropic、Gemini
                        或自定义模型服务，在一个应用里统一聊天、切换模型、管理会话和导出数据。
                    </p>

                    <div
                        class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
                    >
                        <a
                            class="inline-flex items-center justify-center gap-2 rounded-full bg-ink-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-moss-700"
                            href="https://github.com/glosc-ai/Glosc-Chat/releases"
                            rel="noreferrer"
                            target="_blank"
                        >
                            <Download class="size-4" aria-hidden="true" />
                            下载
                        </a>
                        <a
                            class="inline-flex items-center justify-center gap-2 rounded-full border border-black/12 bg-white px-6 py-3 text-sm font-semibold text-ink-950 transition hover:border-moss-700 hover:text-moss-700"
                            href="https://one.gloscai.com/keys"
                            rel="noreferrer"
                            target="_blank"
                        >
                            <KeyRound class="size-4" aria-hidden="true" />
                            获取 key
                        </a>
                        <a
                            class="inline-flex items-center justify-center gap-2 rounded-full border border-black/12 bg-white px-6 py-3 text-sm font-semibold text-ink-950 transition hover:border-moss-700 hover:text-moss-700"
                            href="https://github.com/glosc-ai/Glosc-Chat"
                            rel="noreferrer"
                            target="_blank"
                        >
                            <ExternalLink class="size-4" aria-hidden="true" />
                            GitHub
                        </a>
                    </div>
                </div>

                <div class="lg:row-span-2">
                    <ProductPreview />
                </div>

                <div
                    class="grid max-w-2xl grid-cols-1 gap-3 text-sm text-ink-700 sm:grid-cols-3 lg:col-start-1 lg:row-start-2"
                >
                    <div class="rounded-lg bg-white/78 p-4">
                        <strong class="block text-2xl text-ink-950">4+</strong>
                        Provider 类型
                    </div>
                    <div class="rounded-lg bg-white/78 p-4">
                        <strong class="block text-2xl text-ink-950">0</strong>
                        默认服务端依赖
                    </div>
                    <div class="rounded-lg bg-white/78 p-4">
                        <strong class="block text-2xl text-ink-950"
                            >本地</strong
                        >
                        会话与配置优先
                    </div>
                </div>
            </div>
        </section>

        <section class="bg-white">
            <div class="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
                <div class="mb-10 max-w-3xl">
                    <p
                        class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-moss-700"
                    >
                        App Preview
                    </p>
                    <h2
                        class="text-3xl font-semibold tracking-normal text-ink-950 sm:text-4xl"
                    >
                        直接查看真实应用界面
                    </h2>
                    <p class="mt-4 text-base leading-8 text-ink-700">
                        以下截图来自当前 Glosc Chat
                        app，用于在下载前快速了解聊天、模型和设置页面。
                    </p>
                </div>

                <div class="grid gap-5 md:grid-cols-3">
                    <article
                        v-for="screenshot in screenshots"
                        :key="screenshot.title"
                        class="overflow-hidden rounded-lg border border-black/10 bg-[#fbfaf6]"
                    >
                        <img
                            class="aspect-[430/932] w-full bg-[#eef1f4] object-cover object-top"
                            :src="screenshot.image"
                            :alt="`Glosc Chat ${screenshot.title}界面截图`"
                            loading="lazy"
                        />
                    </article>
                </div>
            </div>
        </section>

        <section class="bg-white">
            <div class="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
                <div class="mb-10 max-w-3xl">
                    <p
                        class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-moss-700"
                    >
                        Core Value
                    </p>
                    <h2
                        class="text-3xl font-semibold tracking-normal text-ink-950 sm:text-4xl"
                    >
                        为自己掌控模型来源和数据边界的用户设计
                    </h2>
                </div>

                <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <article
                        v-for="item in strengths"
                        :key="item.title"
                        class="rounded-lg border border-black/10 bg-[#fbfaf6] p-6"
                    >
                        <component
                            :is="item.icon"
                            class="mb-5 size-7 text-moss-700"
                            aria-hidden="true"
                        />
                        <h3 class="text-lg font-semibold text-ink-950">
                            {{ item.title }}
                        </h3>
                        <p class="mt-3 text-sm leading-7 text-ink-700">
                            {{ item.text }}
                        </p>
                    </article>
                </div>
            </div>
        </section>

        <section class="border-y border-black/10 bg-ink-950 text-white">
            <div
                class="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:py-20"
            >
                <div>
                    <p
                        class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-sun-500"
                    >
                        Privacy First
                    </p>
                    <h2
                        class="text-3xl font-semibold tracking-normal sm:text-4xl"
                    >
                        本地优先不是口号，是默认架构。
                    </h2>
                    <p class="mt-5 text-base leading-8 text-white/70">
                        Glosc Chat
                        默认不托管密钥，不建设中转服务端。聊天请求会发送给你配置的模型
                        Provider，因此你仍需要确认对应模型服务的隐私政策。
                    </p>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                    <div
                        class="rounded-lg border border-white/12 bg-white/8 p-5"
                    >
                        <LockKeyhole
                            class="mb-4 size-6 text-sun-500"
                            aria-hidden="true"
                        />
                        <h3 class="font-semibold">密钥安全存储</h3>
                        <p class="mt-2 text-sm leading-7 text-white/68">
                            API Key 通过系统安全存储保存，不写入普通本地数据库。
                        </p>
                    </div>
                    <div
                        class="rounded-lg border border-white/12 bg-white/8 p-5"
                    >
                        <CloudOff
                            class="mb-4 size-6 text-sun-500"
                            aria-hidden="true"
                        />
                        <h3 class="font-semibold">无默认云端同步</h3>
                        <p class="mt-2 text-sm leading-7 text-white/68">
                            同步能力作为后续可选项规划，不作为当前默认路径。
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <section class="bg-[#f7f5ef]">
            <div
                class="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-20"
            >
                <div>
                    <p
                        class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-moss-700"
                    >
                        Workflow
                    </p>
                    <h2
                        class="text-3xl font-semibold tracking-normal text-ink-950 sm:text-4xl"
                    >
                        从配置到持续对话，路径尽量短。
                    </h2>
                </div>
                <ol class="grid gap-4">
                    <li
                        v-for="(item, index) in workflows"
                        :key="item"
                        class="flex gap-4 rounded-lg border border-black/10 bg-white p-5"
                    >
                        <span
                            class="grid size-9 shrink-0 place-items-center rounded-full bg-moss-100 text-sm font-bold text-moss-700"
                        >
                            {{ index + 1 }}
                        </span>
                        <p class="pt-1 text-base leading-7 text-ink-700">
                            {{ item }}
                        </p>
                    </li>
                </ol>
            </div>
        </section>
    </SiteLayout>
</template>
