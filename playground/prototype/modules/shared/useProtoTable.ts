// 每个模块 setup 的第一行:拿到外壳状态、翻译函数、必带的表格 props、toast。
//   const { shell, t, tableProps, toast } = useProtoTable()
//   <SmartTable v-bind="tableProps" …/>
// 必须在 NMessageProvider 里调用(模块都挂在 ProtoApp 里,天然满足;单测用 tests/proto/_mount.ts 的 mountApp)。
import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { useT } from '../../i18n'
import { useShell } from '../../shell'

export function useProtoTable() {
  const shell = useShell()
  const t = useT()
  const message = useMessage()
  /** 提示条:文案走 t()(「已导出 12 条」这类整句由 i18n-dict 的句式翻译)。 */
  const toast = (msg: string, type: 'default' | 'success' | 'error' | 'warning' = 'default') =>
    message.create(t(msg), { type })
  return {
    shell,
    t,
    /** computed:{ defaultDensity, resizable } —— 响应外壳「密度」开关;所有 <SmartTable> 都要 v-bind(模板里自动解包)。 */
    tableProps: computed(() => shell.tableProps),
    toast,
    message,
  }
}
