// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { NMessageProvider } from 'naive-ui'
import { DATA, delRow } from '../../playground/prototype/data'
import CrudModal from '../../playground/prototype/modules/shared/CrudModal.vue'
import { tableOf } from './m7-tableOf'
import { mountApp, useAppStubs } from './_mount'

// 模块 9「增删改弹窗」:CrudModal(useTableCrud + NModal / 窄档底部抽屉)的表单、校验、提交、业务失败保窗;整页的新增 / 编辑入口。
useAppStubs()
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises()
}
const card = () => document.querySelector('.n-modal.n-card') as HTMLElement | null
const inputOf = (ph: string) =>
  card()!.querySelector(`input[placeholder="${ph}"]`) as HTMLInputElement
const type = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  el.value = v
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
const btn = (txt: string) =>
  [...card()!.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === txt,
  ) as HTMLButtonElement

/** 单独挂 CrudModal(宽档:narrow=false),收集 success 事件 */
async function mountModal(narrow = false) {
  const events: unknown[] = []
  const inst = ref<InstanceType<typeof CrudModal> | null>(null)
  const Host = defineComponent({
    render: () =>
      h(NMessageProvider, null, {
        default: () =>
          h(CrudModal, { ref: inst, narrow, onSuccess: (p: unknown) => events.push(p) }),
      }),
  })
  const w = mount(Host, { attachTo: document.body })
  await flushPromises()
  return { w, events, modal: () => inst.value! }
}
const created: string[] = []
afterEach(() => {
  while (created.length) delRow(created.pop()!)
})

describe('CrudModal 宽档:NModal preset=card 宽 480', () => {
  it('新增:标题「新增物料」、8 个字段、默认值(负责人张伟 / 状态未审核 / 部门采购部)、取消 / 保存', async () => {
    const { w, modal } = await mountModal()
    modal().openCreate()
    await settle()
    expect(card()!.style.width).toBe('480px')
    expect(card()!.querySelector('.n-card-header__main')?.textContent).toBe('新增物料')
    expect(
      [...card()!.querySelectorAll('.n-form-item-label')].map((l) =>
        l.textContent?.replace(/\s|\*/g, ''),
      ),
    ).toEqual(['物料编码', '物料名称', '负责人', '单据状态', '部门', '金额', '单据日期', '备注'])
    expect(card()!.textContent).toContain('张伟')
    expect(card()!.textContent).toContain('未审核')
    expect(card()!.textContent).toContain('采购部')
    expect(btn('取消')).toBeTruthy()
    expect(btn('保存')).toBeTruthy()
    w.unmount()
  })

  it('必填校验:空表单点保存 → 编码 / 名称 / 日期的提示,不提交;输入后提示消失', async () => {
    const { w, modal, events } = await mountModal()
    modal().openCreate()
    await settle()
    btn('保存').click()
    await settle()
    const txt = () => card()!.querySelector('.n-form')!.textContent!
    expect(txt()).toContain('请输入物料编码')
    expect(txt()).toContain('请输入物料名称')
    expect(events).toHaveLength(0)
    type(inputOf('请输入物料编码'), 'T-9001')
    await settle()
    expect(txt()).not.toContain('请输入物料编码')
    expect(txt()).toContain('请输入物料名称')
    w.unmount()
  })

  it('提交成功:写进数据层(放最前)、窗口关闭、message「操作成功」、emit success(create)', async () => {
    const { w, modal, events } = await mountModal()
    modal().openCreate()
    await settle()
    type(inputOf('请输入物料编码'), 'T-9002')
    type(inputOf('请输入物料名称'), '测试件')
    await settle()
    btn('保存').click()
    await settle()
    created.push('T-9002')
    expect(DATA[0]).toMatchObject({
      no: 'T-9002',
      name: '测试件',
      owner: '张伟',
      status: '未审核',
      dept: '采购部',
    })
    expect(events).toEqual([{ mode: 'create', orig: null, no: 'T-9002' }])
    expect(document.body.textContent).toContain('操作成功')
    expect(modal().crud.visible.value).toBe(false)
    w.unmount()
  })

  it('编码唯一(后端业务规则):重复 → message.error「物料编码 X 已存在」,窗口保持,不 emit', async () => {
    const { w, modal, events } = await mountModal()
    modal().openCreate()
    await settle()
    type(inputOf('请输入物料编码'), 'M1000-A')
    type(inputOf('请输入物料名称'), '重复件')
    await settle()
    btn('保存').click()
    await settle()
    expect(document.body.textContent).toContain('物料编码 M1000-A 已存在')
    expect(modal().crud.visible.value).toBe(true)
    expect(card()).toBeTruthy()
    expect(events).toHaveLength(0)
    expect(DATA.filter((r) => r.no === 'M1000-A')).toHaveLength(1)
    w.unmount()
  })

  it('编辑:标题「编辑物料」、回填该行;改名保存后 emit(edit, orig, 新编码)', async () => {
    const { w, modal, events } = await mountModal()
    const row = DATA.find((r) => r.no === 'M1099')!
    const backup = { ...row }
    modal().openEdit(row)
    await settle()
    expect(card()!.querySelector('.n-card-header__main')?.textContent).toBe('编辑物料')
    expect(inputOf('请输入物料编码').value).toBe('M1099')
    expect(inputOf('请输入物料名称').value).toBe('不锈钢螺栓')
    type(inputOf('请输入物料名称'), '不锈钢螺栓-改')
    await settle()
    btn('保存').click()
    await settle()
    expect(row.name).toBe('不锈钢螺栓-改')
    expect(events).toEqual([{ mode: 'edit', orig: 'M1099', no: 'M1099' }])
    Object.assign(row, backup)
    w.unmount()
  })

  it('取消:关窗、不写数据', async () => {
    const { w, modal, events } = await mountModal()
    const n = DATA.length
    modal().openCreate()
    await settle()
    btn('取消').click()
    await settle()
    expect(modal().crud.visible.value).toBe(false)
    expect(DATA).toHaveLength(n)
    expect(events).toHaveLength(0)
    w.unmount()
  })
})

describe('CrudModal 窄档:底部抽屉', () => {
  it('narrow=true 用 NDrawer(bottom),不出 NModal 卡片;表单同样 8 项', async () => {
    const { w, modal } = await mountModal(true)
    modal().openCreate()
    await settle()
    expect(card()).toBeNull()
    const drawer = document.querySelector('.n-drawer') as HTMLElement
    expect(drawer).toBeTruthy()
    expect(drawer.classList.contains('n-drawer--bottom-placement')).toBe(true)
    expect(drawer.querySelector('.n-drawer-header__main')?.textContent).toBe('新增物料')
    expect(drawer.querySelectorAll('.n-form-item')).toHaveLength(8)
    w.unmount()
  })
})

describe('模块 9 页面', () => {
  it('SmartTable 是远程模式(fetcher);工具栏「新增」按钮打开表单(jsdom 无布局 → 容器宽 0 = 窄档抽屉)', async () => {
    const w = await mountApp(9)
    await settle()
    const st = tableOf(w)
    expect(st.vm.rows).toHaveLength(100)
    const add = [...document.querySelectorAll('.smart-table-toolbar button')].find(
      (b) => b.textContent?.trim() === '新增',
    ) as HTMLElement
    expect(add).toBeTruthy()
    add.click()
    await settle()
    expect(document.querySelector('.n-drawer, .n-modal')).toBeTruthy()
    w.unmount()
  })
})
