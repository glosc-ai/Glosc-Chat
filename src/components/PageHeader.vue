<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="border-b border-black/10 bg-[#f7f5ef]">
    <div class="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
      <p class="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-moss-700">{{ eyebrow }}</p>
      <h1 class="max-w-4xl text-4xl font-semibold tracking-normal text-ink-950 sm:text-5xl">
        {{ title }}
      </h1>
      <p class="mt-5 max-w-3xl text-base leading-8 text-ink-700 sm:text-lg">
        {{ description }}
      </p>
    </div>
  </section>
</template>
