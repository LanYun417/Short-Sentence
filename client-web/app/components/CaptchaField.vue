<script setup lang="ts">
/**
 * 图形验证码输入（登录 / 注册共用）。
 * 图片本身就是「刷新」按钮——用户看不清时的第一反应就是点图。
 */
defineProps<{
  /** 验证码图片（data:image/png;base64） */
  image: string;
  /** 是否正在拉取新验证码 */
  loading?: boolean;
}>();

const code = defineModel<string>({ required: true });

const emit = defineEmits<{ refresh: [] }>();
</script>

<template>
  <UFormField label="验证码">
    <div class="flex items-center gap-2">
      <UInput
        v-model="code"
        required
        autocomplete="off"
        autocapitalize="characters"
        size="lg"
        class="flex-1"
        placeholder="输入图片中的字符"
        icon="i-lucide-shield-check"
      />
      <button
        type="button"
        class="grid h-9 w-[108px] shrink-0 place-items-center overflow-hidden rounded-lg ring-1 ring-slate-200 transition hover:ring-sky-400 dark:ring-slate-700"
        :class="loading && 'opacity-50'"
        title="看不清？点击刷新"
        aria-label="刷新验证码"
        @click="emit('refresh')"
      >
        <img :src="image" alt="验证码" class="h-full w-full object-cover" />
      </button>
    </div>
    <template #hint>
      <span class="text-xs text-slate-400">看不清？点击右侧图片刷新</span>
    </template>
  </UFormField>
</template>
