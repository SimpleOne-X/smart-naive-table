<script setup lang="ts">
// 「拖过列宽后的余量」场景页(B8 / Task 12 的浏览器验证用):同一份静态数据,四种列配置 × 容器宽度 × 隐藏最后一列。
import { computed, ref, watch } from 'vue'
import { NButton, NRadioButton, NRadioGroup, NSpace } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { allRows, type DemoRow } from './mock'

type Scenario = 'plain' | 'allfixed' | 'fixedright' | 'opnofix'
const scenario = ref<Scenario>('plain')
const hostWidth = ref(1000)
const hideLast = ref(false)
const rows = allRows.slice(0, 30)
watch(scenario, () => (hideLast.value = false))

const columns = computed<SmartTableColumn<DemoRow>[]>(() => {
  let cols: SmartTableColumn<DemoRow>[]
  switch (scenario.value) {
    case 'allfixed': // 全部列都 fixed:吸收列走退路(最后一列写显式宽度)
      cols = [
        { key: 'account', title: 'A', width: 150, fixed: 'left', resizable: true },
        { key: 'name', title: 'B', width: 150, fixed: 'left', resizable: true },
        { key: 'email', title: 'C', width: 150, fixed: 'right' },
      ]
      break
    case 'fixedright': // 含 fixed: 'right' 的操作列:天然不参与吸收
      cols = [
        { key: 'account', title: 'A', width: 150 },
        { key: 'name', title: 'B', width: 150 },
        { key: 'email', title: 'C', width: 150 },
        { key: 'status', title: 'Op', width: 100, fixed: 'right' },
      ]
      break
    case 'opnofix': // 未 fixed 但 resizable: false 的操作列:退出吸收(宿主的回退入口)
      cols = [
        { key: 'account', title: 'A', width: 150 },
        { key: 'name', title: 'B', width: 150 },
        { key: 'email', title: 'C', width: 150 },
        { key: 'status', title: 'Op', width: 100, resizable: false },
      ]
      break
    default:
      cols = [
        { key: 'account', title: 'A', width: 150 },
        { key: 'name', title: 'B', width: 150 },
        { key: 'email', title: 'C', width: 150 },
        { key: 'deptId', title: 'D', width: 150 },
      ]
  }
  // 「隐藏最后一列」= hideInTable:吸收列的身份随之变化(与列设置里取消勾选走同一条路)
  if (hideLast.value)
    cols[cols.length - 1] = {
      ...cols[cols.length - 1],
      hideInTable: true,
    } as SmartTableColumn<DemoRow>
  return cols
})
</script>

<template>
  <div>
    <n-space align="center" :size="12" style="margin-bottom: 12px">
      <n-radio-group v-model:value="scenario" size="small" data-testid="scenario">
        <n-radio-button value="plain">plain</n-radio-button>
        <n-radio-button value="allfixed">allfixed</n-radio-button>
        <n-radio-button value="fixedright">fixedright</n-radio-button>
        <n-radio-button value="opnofix">opnofix</n-radio-button>
      </n-radio-group>
      <n-radio-group v-model:value="hostWidth" size="small" data-testid="width">
        <n-radio-button :value="700">700</n-radio-button>
        <n-radio-button :value="1000">1000</n-radio-button>
      </n-radio-group>
      <n-button size="small" data-testid="hide-last" @click="hideLast = !hideLast"
        >隐藏 / 显示最后一列</n-button
      >
    </n-space>
    <div :style="{ width: hostWidth + 'px' }" data-testid="host">
      <SmartTable
        :key="scenario"
        :columns="columns"
        :data="rows"
        resizable
        :pagination="false"
        :toolbar="false"
        :search="false"
        :single-line="false"
      />
    </div>
  </div>
</template>
