<script setup lang="ts">
import { computed, ref } from 'vue'
import { darkTheme, dateZhCN, NConfigProvider, NMessageProvider, NSpace, NSwitch, NTabPane, NTabs, zhCN } from 'naive-ui'
import DemoBasic from './DemoBasic.vue'
import DemoWide from './DemoWide.vue'
import DemoFilter from './DemoFilter.vue'
import DemoCrud from './DemoCrud.vue'
import DemoAbsorb from './DemoAbsorb.vue'
import { locale, tt } from './locale'
import { mockState } from './mock'

const dark = ref(false)
const theme = computed(() => (dark.value ? darkTheme : null))
const isZh = computed({
  get: () => locale.value === 'zh',
  set: (v: boolean) => (locale.value = v ? 'zh' : 'en'),
})
// Naive 自带文案(占位符、日期面板)同步切换;null 即 Naive 内置英文
const naiveLocale = computed(() => (isZh.value ? zhCN : null))
const naiveDateLocale = computed(() => (isZh.value ? dateZhCN : null))
</script>

<template>
  <n-config-provider :theme="theme" :locale="naiveLocale" :date-locale="naiveDateLocale">
    <n-message-provider>
      <div class="page" :class="{ dark }">
        <n-space align="center" justify="space-between" style="margin-bottom: 16px">
          <h2 style="margin: 0">smart-naive-table</h2>
          <n-space align="center" :size="16">
            <label><n-switch v-model:value="dark" size="small" /> {{ tt('暗色', 'Dark')() }}</label>
            <label><n-switch v-model:value="isZh" size="small" /> {{ isZh ? '中文' : 'EN' }}</label>
            <label><n-switch v-model:value="mockState.fail" size="small" /> {{ tt('请求失败模拟', 'Fail requests')() }}</label>
          </n-space>
        </n-space>

        <n-tabs type="line" default-value="basic">
          <n-tab-pane name="basic" :tab="tt('基础', 'Basic')()"><DemoBasic /></n-tab-pane>
          <n-tab-pane name="wide" :tab="tt('宽表', 'Wide')()"><DemoWide /></n-tab-pane>
          <n-tab-pane name="filter" :tab="tt('过滤 / 列宽', 'Filter / Resize')()"><DemoFilter /></n-tab-pane>
          <n-tab-pane name="crud" :tab="'CRUD'"><DemoCrud /></n-tab-pane>
          <n-tab-pane name="absorb" tab="列宽余量"><DemoAbsorb /></n-tab-pane>
        </n-tabs>
      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
  background: #f5f6f8;
}
.page.dark {
  background: #101014;
  color: #e5e7eb;
}
</style>
