// @vitest-environment jsdom
// 外壳:四个全局开关(明暗 / 语言 / 页面底色 / 密度)对模块生效,空状态图标是线性托盘,侧栏占位 / 参数 / 档位。
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { SmartTable } from '../../src/index'
import { translate, registerDict, useT } from '../../playground/prototype/i18n'
import { createShell } from '../../playground/prototype/shell'
import ProtoPlaceholder from '../../playground/prototype/modules/ProtoPlaceholder.vue'
import { tierOf } from '../../playground/prototype/modules/shared/useTier'
import { mountApp, useAppStubs } from './_mount'

useAppStubs()

const tableOf = (w: any) => w.findComponent(SmartTable as any) as any
const heads = (w: any): string[] => w.findAll('thead th').map((th: any) => th.text())
const clickShell = async (w: any, field: string, v: string) => {
  await w.find(`#modPanel [data-shell="${field}"] button[data-v="${v}"]`).trigger('click')
  await flushPromises()
}

describe('外壳参数(createShell)', () => {
  it('缺省 zh / gray / compact;URL 参数覆盖;非法值回缺省', () => {
    const d = createShell('?theme=light')
    expect({ lang: d.lang, bg: d.bg, density: d.density, theme: d.theme }).toEqual({
      lang: 'zh',
      bg: 'gray',
      density: 'compact',
      theme: 'light',
    })
    const s = createShell('?lang=en&bg=white&density=comfortable&theme=dark')
    expect({ lang: s.lang, bg: s.bg, density: s.density, theme: s.theme }).toEqual({
      lang: 'en',
      bg: 'white',
      density: 'comfortable',
      theme: 'dark',
    })
    expect(createShell('?lang=fr&bg=red&density=x').lang).toBe('zh')
    expect(s.tableProps).toEqual({ defaultDensity: 'comfortable', resizable: true })
    s.density = 'compact' // 写穿到 ref;tableProps 随之变
    expect(s.tableProps.defaultDensity).toBe('compact')
  })
})

describe('语言开关', () => {
  it('?lang=en:侧栏 / 面包屑 / 标题 / 列标题 / 工具栏 / 分页前缀都是英文;切回中文还原(同一个表,不重挂)', async () => {
    const w = await mountApp(2, { lang: 'en' })
    expect(w.find('.side h1').text()).toBe('SmartTable Design Spec')
    expect(w.findAll('#modList .nav-h').map((h) => h.text())).toEqual([
      'Query',
      'Columns',
      'Rows',
      'Data',
      'Layout',
    ])
    expect(w.findAll('#modList .nm').map((n) => n.text())).toEqual([
      'Search form',
      'Query builder',
      'Header filters',
      'Multi-column sorting',
      'Column groups & pinning',
      'Dicts, tags and formats',
      'Column settings',
      'Row reordering',
      'Master-detail',
      'Loading & errors',
      'CRUD dialogs',
      'Editable grid',
      'Stacked layout',
    ])
    expect(w.find('.crumb').text().replace(/\s+/g, ' ')).toBe(
      'SmartTable Design Spec / Query / Query builder',
    )
    expect(w.find('.stage-head h2').text()).toBe('Query builder')
    expect(document.documentElement.lang).toBe('en')
    expect(w.find('.smart-table-title').exists()).toBe(false) // 单表模块工具栏不再画表名(设计 §2.14:页顶已有页面标题)
    expect(heads(w)).toEqual(
      expect.arrayContaining([
        'No.',
        'Material Code',
        'Material Name',
        'Owner',
        'Document Status',
        'Department',
        'Amount',
        'Document Date',
        'Actions',
      ]),
    )
    expect(w.findAll('.smart-table-cond__main button').map((b) => b.text())).toEqual(
      expect.arrayContaining(['Search', 'Reset']),
    )
    expect(w.find('.n-pagination').element.parentElement!.textContent).toContain('Total 2000')
    expect(w.find('button[aria-label="Maximize"]').exists()).toBe(true)

    const inst = tableOf(w).vm.$.uid
    await clickShell(w, 'lang', 'zh')
    expect(tableOf(w).vm.$.uid).toBe(inst) // 切语言不重挂表格
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(w.find('.side h1').text()).toBe('SmartTable 设计方案')
    expect(w.find('.smart-table-title').exists()).toBe(false)
    expect(heads(w)).toEqual(
      expect.arrayContaining([
        '序号',
        '物料编码',
        '物料名称',
        '负责人',
        '单据状态',
        '部门',
        '金额',
        '单据日期',
        '操作',
      ]),
    )
    expect(w.find('button[aria-label="放大"]').exists()).toBe(true)
    await clickShell(w, 'lang', 'en')
    expect(heads(w)).toContain('Material Code')
    w.unmount()
  })

  it('i18n:词典命中 / 句式 / 子串替换 / 模块词条注册 / 不含汉字原样返回', () => {
    expect(translate('物料编码')).toBe('Material Code')
    expect(translate('共 2,000 条')).toBe('Total 2,000')
    expect(translate('请输入物料编码')).toBe('Please enter Material Code')
    expect(translate('搜索 物料名称')).toBe('Search Material Name')
    expect(translate('  新增 ')).toBe('  Add ')
    expect(translate('M1000-A')).toBe('M1000-A')
    expect(translate('尚未注册的词')).toBe('尚未注册的词')
    registerDict([['尚未注册的词', 'Not registered yet']], [[/拖了 (\d+) 行/g, 'Dragged $1 rows']])
    expect(translate('尚未注册的词')).toBe('Not registered yet')
    expect(translate('拖了 3 行')).toBe('Dragged 3 rows')
    const t = useT as any // 签名存在即可(setup 外调用需要 inject,这里只确认导出)
    expect(typeof t).toBe('function')
  })
})

describe('页面底色开关', () => {
  it('gray(缺省)= NLayout embedded 的 colorEmbedded;white = color(bodyColor);html[data-bg] 同步;切换不重挂', async () => {
    const w = await mountApp(2)
    const color = () =>
      (w.find('.viewport').element as HTMLElement).style
        .getPropertyValue('--n-color')
        .replace(/\s+/g, '')
    expect(document.documentElement.dataset.bg).toBe('gray')
    expect(color()).toBe('rgb(250,250,252)')
    const inst = tableOf(w).vm.$.uid
    await clickShell(w, 'bg', 'white')
    expect(document.documentElement.dataset.bg).toBe('white')
    expect(color()).toMatch(/^(#fff|#ffffff|rgb\(255,255,255\))$/i)
    expect(tableOf(w).vm.$.uid).toBe(inst)
    await clickShell(w, 'bg', 'gray')
    expect(color()).toBe('rgb(250,250,252)')
    w.unmount()

    const w2 = await mountApp(2, { bg: 'white' })
    expect(document.documentElement.dataset.bg).toBe('white')
    expect(
      (w2.find('.viewport').element as HTMLElement).style
        .getPropertyValue('--n-color')
        .replace(/\s+/g, ''),
    ).toMatch(/^(#fff|#ffffff|rgb\(255,255,255\))$/i)
    w2.unmount()
  })
})

describe('密度开关', () => {
  it('compact(缺省)→ comfortable:SmartTable 的 defaultDensity 随之变,同一个实例响应(不重挂);URL 参数也认', async () => {
    const w = await mountApp(2)
    expect(tableOf(w).props('defaultDensity')).toBe('compact')
    const inst = tableOf(w).vm.$.uid
    await clickShell(w, 'density', 'comfortable')
    expect(tableOf(w).props('defaultDensity')).toBe('comfortable')
    expect(tableOf(w).vm.$.uid).toBe(inst)
    await clickShell(w, 'density', 'compact')
    expect(tableOf(w).props('defaultDensity')).toBe('compact')
    w.unmount()
    const w2 = await mountApp(3, { density: 'comfortable' })
    expect(tableOf(w2).props('defaultDensity')).toBe('comfortable')
    w2.unmount()
  })
})

describe('明暗开关', () => {
  it('?theme=dark → html[data-theme=dark];点「浅色」切回', async () => {
    const w = await mountApp(2, { theme: 'dark' })
    expect(document.documentElement.dataset.theme).toBe('dark')
    await clickShell(w, 'theme', 'light')
    expect(document.documentElement.dataset.theme).toBe('light')
    w.unmount()
  })
})

describe('空状态图标 = 线性托盘(NConfigProvider component-options.Empty.renderIcon)', () => {
  it('条件搜索无结果 → .n-empty 里是自定义托盘 svg,不是官方实心托盘', async () => {
    const w = await mountApp(2)
    expect(w.find('.n-empty').exists()).toBe(false)
    await w
      .find('.smart-table-cond__main .smart-table-filter-value input')
      .setValue('ZZZZ-no-such-code')
    await w
      .findAll('.smart-table-cond__main button')
      .find((b) => b.text() === '搜索')!
      .trigger('click')
    await flushPromises()
    const empty = w.find('.n-empty')
    expect(empty.exists()).toBe(true)
    expect(empty.find('svg[data-proto-tray]').exists()).toBe(true)
    expect(empty.find('svg[data-proto-tray] path').attributes('d')).toMatch(/^M6 30V22\.1Q6 20\.5/)
    expect(empty.find('svg[data-proto-tray]').attributes('viewBox')).toBe('3 3 34 34')
    expect(empty.text()).toContain('无数据')
    w.unmount()
  })
})

describe('侧栏 / 占位 / 档位', () => {
  it('占位组件:一行「模块 N 未在对照页实现」(注册表在 ProtoM{N}.vue 不存在时挂它)', () => {
    const w = mount(ProtoPlaceholder, { props: { no: 7, name: '列设置' } })
    expect(w.text()).toBe('模块 7 未在对照页实现')
    expect(w.classes()).toContain('proto-host')
  })

  it('?m=5 / 9 / 13 都能进(侧栏 13 项,13 不高亮任何子页)', async () => {
    for (const m of [5, 9, 13]) {
      const w = await mountApp(m)
      expect(new URLSearchParams(location.search).get('m')).toBe(String(m))
      expect(w.find('#stage').exists()).toBe(true)
      expect(w.findAll('#modList .mod')).toHaveLength(13)
      if (m === 13) expect(w.findAll('#modList .mod.on')).toHaveLength(0)
      else expect(w.findAll('#modList .mod.on')).toHaveLength(1)
      w.unmount()
    }
  }, 30000)

  it('natural 模块(仅 10;12 已改成恒为一屏)给 #stage 加 data-nat,rowClick 模块(11)加 data-rowclick;其它都没有', async () => {
    const flags = async (m: number) => {
      const w = await mountApp(m)
      const st = w.find('#stage')
      const r = [
        st.attributes('data-nat') !== undefined,
        st.attributes('data-rowclick') !== undefined,
      ]
      w.unmount()
      return r
    }
    expect(await flags(10)).toEqual([true, false])
    expect(await flags(12)).toEqual([false, false])
    expect(await flags(11)).toEqual([false, true])
    expect(await flags(2)).toEqual([false, false])
  }, 30000)

  it('窄档分组条 + 子页签:i18n 没有分组条高亮;版本行 v3.0.0 · 2026-10-03 且没有「升级变更」', async () => {
    const w = await mountApp(7)
    expect(w.find('#verLine').text()).toBe('v3.0.0 · 2026-10-03')
    expect(w.text()).not.toContain('升级变更')
    expect(w.findAll('#grpBar .mod').map((b) => b.text())).toEqual([
      '查询',
      '列',
      '行',
      '数据',
      '布局',
    ])
    expect(w.findAll('#grpBar .mod').map((b) => b.classes('on'))).toEqual([
      false,
      true,
      false,
      false,
      false,
    ])
    expect(w.findAll('.subtabs .subtab').map((b) => b.text())).toEqual([
      '多级表头与固定列',
      '字典、标签与格式化',
      '列设置',
    ])
    w.unmount()
    const w13 = await mountApp(13)
    expect(w13.findAll('#grpBar .mod.on')).toHaveLength(0)
    expect(w13.findAll('.subtabs .subtab')).toHaveLength(0)
    expect(w13.find('.crumb').text().replace(/\s+/g, ' ')).toBe(
      'SmartTable 设计方案 / 多语言与页面底色',
    )
    w13.unmount()
  }, 30000)

  it('容器档位阈值(原型 T_NARROW 600 / T_WIDE 1280)', () => {
    expect([0, 599, 600, 1279, 1280, 1920].map(tierOf)).toEqual([
      'narrow',
      'narrow',
      'mid',
      'mid',
      'wide',
      'wide',
    ])
  })
})
