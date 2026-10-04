import { ref, type Ref } from 'vue'
import type { UseTableCrudOptions, UseTableCrudReturn } from './types'

/**
 * CRUD 弹窗状态机(UI 无关):visible/mode/model/submit/removeRow。
 * 成功自动关窗并回调 onSuccess;失败保窗并回调 onError。包内不弹任何 UI。
 */
export function useTableCrud<Row, Form>(
  opts: UseTableCrudOptions<Row, Form>,
): UseTableCrudReturn<Row, Form> {
  const visible = ref(false)
  const mode = ref<'create' | 'edit'>('create')
  const model = ref(opts.form()) as Ref<Form>
  const editingRow = ref(null) as Ref<Row | null>
  const submitting = ref(false)

  // 缺省行→表单:浅拷贝行上与空表单同名的字段(表单形状由 form() 定义)
  function defaultToForm(row: Row): Form {
    const form = opts.form() as Record<string, unknown>
    const source = row as Record<string, unknown>
    for (const k of Object.keys(form)) {
      if (k in source) form[k] = source[k]
    }
    return form as Form
  }

  function openCreate() {
    mode.value = 'create'
    editingRow.value = null
    model.value = opts.form()
    visible.value = true
  }

  function openEdit(row: Row) {
    mode.value = 'edit'
    editingRow.value = row
    model.value = opts.toForm ? opts.toForm(row) : defaultToForm(row)
    visible.value = true
  }

  async function submit(): Promise<boolean> {
    if (submitting.value) return false
    submitting.value = true
    try {
      if (mode.value === 'create') {
        await opts.create(model.value)
      } else {
        await opts.update(model.value, editingRow.value as Row)
      }
      visible.value = false
      opts.onSuccess?.()
      return true
    } catch (e) {
      opts.onError?.(e)
      return false
    } finally {
      submitting.value = false
    }
  }

  async function removeRow(row: Row): Promise<boolean> {
    if (!opts.remove) return false
    try {
      await opts.remove(row)
      opts.onSuccess?.()
      return true
    } catch (e) {
      opts.onError?.(e)
      return false
    }
  }

  function close() {
    visible.value = false
  }

  return {
    visible,
    mode,
    model,
    editingRow,
    submitting,
    openCreate,
    openEdit,
    submit,
    removeRow,
    close,
  }
}
