<template>
  <div v-bind="boxBindProps">
    <!-- 全屏按钮 -->
    <a-icon v-if="fullScreen" class="full-screen-icon" :type="fullScreenIcon" @click="onToggleFullScreen" />
    <textarea ref="textarea" v-bind="getBindValue"></textarea>
  </div>
</template>

<script lang="ts">
  import { defineComponent, onMounted, reactive, ref, watch, unref, computed } from 'vue';
  import { propTypes } from '/@/utils/propTypes';
  import { useRuleFormItem } from '/@/hooks/component/useFormItem';
  // 引入全局实例
  import _CodeMirror, { EditorFromTextArea } from 'codemirror';
  // 核心样式
  import 'codemirror/lib/codemirror.css';
  // 引入主题后还需要在 options 中指定主题才会生效
  import 'codemirror/theme/cobalt.css';
  // 需要引入具体的语法高亮库才会有对应的语法高亮效果
  import 'codemirror/mode/javascript/javascript.js';
  import 'codemirror/mode/css/css.js';
  import 'codemirror/mode/xml/xml.js';
  import 'codemirror/mode/clike/clike.js';
  import 'codemirror/mode/markdown/markdown.js';
  import 'codemirror/mode/python/python.js';
  import 'codemirror/mode/r/r.js';
  import 'codemirror/mode/shell/shell.js';
  import 'codemirror/mode/sql/sql.js';
  import 'codemirror/mode/swift/swift.js';
  import 'codemirror/mode/vue/vue.js';
  // 折叠资源引入:开始
  import 'codemirror/addon/fold/foldgutter.css';
  import 'codemirror/addon/fold/foldcode.js';
  import 'codemirror/addon/fold/brace-fold.js';
  import 'codemirror/addon/fold/comment-fold.js';
  import 'codemirror/addon/fold/indent-fold.js';
  import 'codemirror/addon/fold/foldgutter.js';
  // 折叠资源引入:结束
  //光标行背景高亮，配置里面也需要styleActiveLine设置为true
  import 'codemirror/addon/selection/active-line.js';
  // 支持代码自动补全
  import 'codemirror/addon/hint/show-hint.css';
  import 'codemirror/addon/hint/show-hint.js';
  import 'codemirror/addon/hint/anyword-hint.js';
  import { useAttrs } from '/@/hooks/core/useAttrs';
  import { useDesign } from '/@/hooks/web/useDesign';
  import { isJsonObjectString } from '/@/utils/is.ts';

  export default defineComponent({
    name: 'JCodeEditor',
    // 不将 attrs 的属性绑定到 html 标签上
    inheritAttrs: false,
    components: {},
    props: {
      value: propTypes.string.def(''),
      height: propTypes.string.def('auto'),
      disabled: propTypes.bool.def(false),
      // 是否显示全屏按钮
      fullScreen: propTypes.bool.def(false),
      // 全屏以后的z-index
      zIndex: propTypes.any.def(999),
    },
    emits: ['change', 'update:value'],
    setup(props, { emit }) {
      const { prefixCls } = useDesign('code-editer');
      const CodeMirror = window.CodeMirror || _CodeMirror;
      const emitData = ref<object>();
      //表单值
      const [state] = useRuleFormItem(props, 'value', 'change', emitData);
      const textarea = ref<HTMLTextAreaElement>();
      let coder: Nullable<EditorFromTextArea> = null;
      const attrs = useAttrs();
      const height = ref(props.height);
      const options = reactive({
        // 缩进格式
        tabSize: 2,
        // 主题，对应主题库 JS 需要提前引入
        theme: 'cobalt',
        smartIndent: true, // 是否智能缩进
        // 显示行号
        lineNumbers: true,
        line: true,
        // 启用代码折叠相关功能:开始
        foldGutter: true,
        lineWrapping: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter', 'CodeMirror-lint-markers'],
        // 启用代码折叠相关功能:结束
        // 光标行高亮
        styleActiveLine: true,
        //代码格式化
        extraKeys: {
          Tab: function autoFormat(editor) {
            //var totalLines = editor.lineCount();
            //editor.autoFormatRange({line:0, ch:0}, {line:totalLines});
            setValue(innerValue, false);
          },
        },
      });
      let innerValue = '';
      // 全屏状态
      const isFullScreen = ref(false);
      const fullScreenIcon = computed(() => (isFullScreen.value ? 'fullscreen-exit' : 'fullscreen'));
      // 外部盒子参数
      const boxBindProps = computed(() => {
        let _props = {
          class: [
            prefixCls,
            'full-screen-parent',
            'auto-height',
            {
              'full-screen': isFullScreen.value,
            },
          ],
          style: {},
        };
        if (isFullScreen.value) {
          _props.style['z-index'] = props.zIndex;
        }
        return _props;
      });
      /**
       * 监听组件值
       */
      watch(
        () => props.value,
        () => {
          if (innerValue != props.value) {
            setValue(props.value, false);
          }
        }
      );
      onMounted(() => {
        initialize();
      });

      /**
       * 组件赋值
       * @param value
       * @param trigger 是否触发 change 事件
       */
      function setValue(value: string, trigger = true) {
        if (value && isJsonObjectString(value)) {
          value = JSON.stringify(JSON.parse(value), null, 2);
        }
        coder?.setValue(value ?? '');
        innerValue = value;
        trigger && emitChange(innerValue);
      }

      //编辑器值修改事件
      function onChange(obj) {
        let value = obj.getValue();
        innerValue = value || '';
        if (props.value != innerValue) {
          emitChange(innerValue);
        }
      }

      function emitChange(value) {
        emit('change', value);
        emit('update:value', value);
      }

      //组件初始化
      function initialize() {
        coder = CodeMirror.fromTextArea(textarea.value!, options);
        //绑定值修改事件
        coder.on('change', onChange);
        // 初始化成功时赋值一次
        setValue(innerValue, false);
      }

      // 切换全屏状态
      function onToggleFullScreen() {
        isFullScreen.value = !isFullScreen.value;
      }

      const getBindValue = Object.assign({}, unref(props), unref(attrs));
      return {
        state,
        textarea,
        boxBindProps,
        getBindValue,
        setValue,
        isFullScreen,
        fullScreenIcon,
        onToggleFullScreen,
      };
    },
  });
</script>

<style lang="less">
  //noinspection LessUnresolvedVariable
  @prefix-cls: ~'@{namespace}-code-editer';
  .@{prefix-cls} {
    &.auto-height {
      .CodeMirror {
        height: v-bind(height) !important;
        min-height: 100px;
      }
    }

    /* 全屏样式 */

    &.full-screen-parent {
      position: relative;

      .full-screen-icon {
        opacity: 0;
        color: black;
        width: 20px;
        height: 20px;
        line-height: 24px;
        background-color: white;
        position: absolute;
        top: 2px;
        right: 2px;
        z-index: 9;
        cursor: pointer;
        transition: opacity 0.3s;
        padding: 2px 0 0 1.5px;
      }

      &:hover {
        .full-screen-icon {
          opacity: 1;

          &:hover {
            background-color: rgba(255, 255, 255, 0.88);
          }
        }
      }

      &.full-screen {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        padding: 8px;
        background-color: #f5f5f5;

        .full-screen-icon {
          top: 12px;
          right: 12px;
        }

        .full-screen-child,
        .CodeMirror {
          height: 100%;
          max-height: 100%;
          min-height: 100%;
        }
      }

      .full-screen-child {
        height: 100%;
      }
    }
  }
</style>
