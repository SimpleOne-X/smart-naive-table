<script setup lang="ts">
// 占位:modules/ProtoM{N}.vue 还不存在时由注册表挂这个(对照页不是设计稿,不受「不放说明文字」限制)。
defineProps<{ no: number; name?: string }>()
</script>

<template>
  <div class="proto-host proto-placeholder" data-placeholder>模块 {{ no }} 未在对照页实现</div>
</template>

<style scoped>
.proto-placeholder {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--px-text-2);
  font-size: 13px;
}
</style>
