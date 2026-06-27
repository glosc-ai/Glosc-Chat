<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Menu, MessageSquareText, X } from "lucide-vue-next";

const route = useRoute();
const isMenuOpen = ref(false);

const navItems = [
  { label: "首页", to: "/" },
  { label: "技术支持", to: "/support" },
  { label: "隐私政策", to: "/privacy" },
  { label: "服务条款", to: "/terms" }
];

const activePath = computed(() => route.path);

function closeMenu() {
  isMenuOpen.value = false;
}
</script>

<template>
  <div class="min-h-screen bg-[#f7f5ef] text-ink-950">
    <header class="sticky top-0 z-40 border-b border-black/10 bg-[#f7f5ef]/92 backdrop-blur-xl">
      <nav class="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <RouterLink class="flex items-center gap-3 text-base font-semibold tracking-normal" to="/" @click="closeMenu">
          <span class="grid size-10 place-items-center rounded-full bg-ink-950 text-white shadow-sm">
            <MessageSquareText class="size-5" aria-hidden="true" />
          </span>
          <span>Glosc Chat</span>
        </RouterLink>

        <div class="hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-full px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-white hover:text-ink-950"
            :class="{ 'bg-white text-ink-950 shadow-sm': activePath === item.to }"
          >
            {{ item.label }}
          </RouterLink>
        </div>

        <a
          class="hidden rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss-700 md:inline-flex"
          href="https://github.com/glosc-ai/Glosc-Chat/releases"
          rel="noreferrer"
          target="_blank"
        >
          获取应用
        </a>

        <button
          class="grid size-10 place-items-center rounded-full border border-black/10 bg-white text-ink-950 md:hidden"
          type="button"
          aria-label="打开导航"
          @click="isMenuOpen = !isMenuOpen"
        >
          <X v-if="isMenuOpen" class="size-5" aria-hidden="true" />
          <Menu v-else class="size-5" aria-hidden="true" />
        </button>
      </nav>

      <div v-if="isMenuOpen" class="border-t border-black/10 bg-[#f7f5ef] px-5 py-4 md:hidden">
        <div class="mx-auto grid max-w-7xl gap-2">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-xl px-4 py-3 text-sm font-semibold text-ink-700"
            :class="{ 'bg-white text-ink-950 shadow-sm': activePath === item.to }"
            @click="closeMenu"
          >
            {{ item.label }}
          </RouterLink>
          <a
            class="rounded-xl bg-ink-950 px-4 py-3 text-sm font-semibold text-white"
            href="https://github.com/glosc-ai/Glosc-Chat/releases"
            rel="noreferrer"
            target="_blank"
            @click="closeMenu"
          >
            获取应用
          </a>
        </div>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <footer class="border-t border-black/10 bg-ink-950 text-white">
      <div class="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <div class="mb-4 flex items-center gap-3">
            <span class="grid size-10 place-items-center rounded-full bg-white text-ink-950">
              <MessageSquareText class="size-5" aria-hidden="true" />
            </span>
            <span class="text-base font-semibold">Glosc Chat</span>
          </div>
          <p class="max-w-xl text-sm leading-7 text-white/68">
            移动端优先、本地优先的 BYOK 多模型 AI 聊天客户端。你掌控 Provider、API Key 和本地数据。
          </p>
        </div>

        <div>
          <h2 class="mb-4 text-sm font-semibold text-white">页面</h2>
          <div class="grid gap-3 text-sm text-white/68">
            <RouterLink to="/">首页</RouterLink>
            <RouterLink to="/support">技术支持</RouterLink>
            <RouterLink to="/privacy">隐私政策</RouterLink>
            <RouterLink to="/terms">服务条款</RouterLink>
          </div>
        </div>

        <div>
          <h2 class="mb-4 text-sm font-semibold text-white">联系</h2>
          <div class="grid gap-3 text-sm text-white/68">
            <a href="mailto:support@gloscai.com">support@gloscai.com</a>
            <a href="https://github.com/glosc-ai/Glosc-Chat" rel="noreferrer" target="_blank">GitHub 项目</a>
          </div>
        </div>
      </div>
      <div class="border-t border-white/10 px-5 py-5 text-center text-xs text-white/48">
        © 2026 Glosc AI. All rights reserved.
      </div>
    </footer>
  </div>
</template>
