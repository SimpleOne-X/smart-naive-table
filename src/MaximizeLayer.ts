import { defineComponent, h, Teleport, type PropType } from 'vue'

/**
 * 「放大层」(toolbar.maximize):**开了才包一层 div**。
 * - 没开(`enabled: false`):只渲染插槽内容(Fragment)—— 不传 `toolbar.maximize` 的用户,DOM 与没有这个能力时完全一致;
 * - 开了、没放大:包一层 div(样式里 `display: contents`,对布局透明),在根元素里原位;
 * - 放大中(`active`):这层 div 被 Teleport 到 body,自己 `position: fixed` 铺满视口(层级 / 底色由调用方的 style 给),盖住宿主的侧栏 / 顶栏。
 *   Teleport 只搬 DOM、不重新挂载,所以组件状态(输入框内容、勾选、过滤态)保留。
 * 这层 div 的所有属性(class / style / role / aria-* / 事件)都由调用方经 attrs 传入;`setEl` 把元素交回调用方当模板 ref 用。
 * 为什么 Teleport 的对象是这一层、而不是根元素本身:根元素要留在原位给宿主页面占位(同高,放大前后文档高度不变);
 * 也因此不能靠 `container-type` 判断档位(它得在被搬走的元素上)—— SmartTable 用 JS 量放大层的宽度判档。
 */
export default defineComponent({
  name: 'SmartTableLayer',
  inheritAttrs: false,
  props: {
    enabled: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    setEl: { type: Function as PropType<(el: HTMLElement | null) => void>, default: undefined },
  },
  setup(props, { slots, attrs }) {
    return () => {
      if (!props.enabled) return slots.default?.()
      return h(Teleport, { to: 'body', disabled: !props.active }, [
        h(
          'div',
          { ...attrs, ref: (el) => props.setEl?.(el as HTMLElement | null) },
          slots.default?.(),
        ),
      ])
    }
  },
})
