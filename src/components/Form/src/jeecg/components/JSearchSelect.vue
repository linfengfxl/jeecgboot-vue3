<template>
  <!--异步字典下拉搜素-->
  <a-select
    v-if="async"
    v-bind="attrs"
    v-model:value="selectedAsyncValue"
    showSearch
    labelInValue
    allowClear
    :getPopupContainer="getParentContainer"
    :placeholder="placeholder"
    :filterOption="false"
    :notFoundContent="loading ? undefined : null"
    @search="loadData"
    @change="handleAsyncChange"
  >
    <template #notFoundContent>
      <a-spin size="small" />
    </template>
    <a-select-option v-for="d in options" :key="d.value" :value="d.value">{{ d.text }}</a-select-option>
  </a-select>
  <!--字典下拉搜素-->
  <a-select
    v-else
    v-model:value="selectedValue"
    v-bind="attrs"
    showSearch
    :getPopupContainer="getParentContainer"
    :placeholder="placeholder"
    :filterOption="filterOption"
    :notFoundContent="loading ? undefined : null"
    @change="handleChange"
  >
    <template #notFoundContent>
      <a-spin v-if="loading" size="small" />
    </template>
    <a-select-option v-for="d in options" :key="d.value" :value="d.value">{{ d.text }}</a-select-option>
  </a-select>
</template>

<script lang="ts">
  import { useDebounceFn } from '@vueuse/core';
  import { defineComponent, PropType, ref, reactive, watchEffect, computed, unref, watch, onMounted } from 'vue';
  import { propTypes } from '/@/utils/propTypes';
  import { useAttrs } from '/@/hooks/core/useAttrs';
  import { initDictOptions } from '/@/utils/dict/index';
  import { defHttp } from '/@/utils/http/axios';

  export default defineComponent({
    name: 'JSearchSelect',
    inheritAttrs: false,
    props: {
      value: propTypes.oneOfType([propTypes.string, propTypes.number]),
      dict: propTypes.string,
      dictOptions: {
        type: Array,
        default: () => [],
      },
      async: propTypes.bool.def(false),
      placeholder: propTypes.string,
      popContainer: propTypes.string,
      pageSize: propTypes.number.def(10),
      getPopupContainer: {
        type: Function,
        default: (node) => node.parentNode,
      },
    },
    emits: ['change', 'update:value'],
    setup(props, { emit, refs }) {
      const options = ref<any[]>([]);
      const loading = ref(false);
      const attrs = useAttrs();
      const selectedValue = ref([]);
      const selectedAsyncValue = ref([]);
      const lastLoad = ref(0);
      // 是否根据value加载text
      const loadSelectText = ref(true);
      /**
       * 监听字典code
       */
      watchEffect(() => {
        props.dict && initDictData();
      });
      /**
       * 监听value
       */
      watch(
        () => props.value,
        (val) => {
          if (val || val === 0) {
            initSelectValue();
          } else {
            selectedValue.value = [];
            selectedAsyncValue.value = [];
          }
        },
        { immediate: true }
      );
      /**
       * 监听dictOptions
       */
      watch(
        () => props.dictOptions,
        (val) => {
          if (val && val.length > 0) {
            options.value = [...val];
          }
        },
        { immediate: true }
      );
      /**
       * 异步查询数据
       */
      async function loadData(value) {
        lastLoad.value += 1;
        const currentLoad = unref(lastLoad);
        options.value = [];
        loading.value = true;
        // 字典code格式：table,text,code
        defHttp.get({ url: `/sys/dict/loadDict/${props.dict}`, params: { keyword: value, pageSize: props.pageSize } }).then((res) => {
          loading.value = false;
          if (res && res.length > 0) {
            if (currentLoad != unref(lastLoad)) {
              return;
            }
            options.value = res;
          }
        });
      }
      /**
       * 初始化value
       */
      function initSelectValue() {
        //update-begin-author:taoyan date:2022-4-24 for: 下拉搜索组件每次选中值会触发value的监听事件，触发此方法，但是实际不需要
        if (loadSelectText.value === false) {
          loadSelectText.value = true;
          return;
        }
        //update-end-author:taoyan date:2022-4-24 for: 下拉搜索组件每次选中值会触发value的监听事件，触发此方法，但是实际不需要
        let { async, value, dict } = props;
        if (async) {
          if (!selectedAsyncValue || !selectedAsyncValue.key || selectedAsyncValue.key !== value) {
            defHttp.get({ url: `/sys/dict/loadDictItem/${dict}`, params: { key: value } }).then((res) => {
              if (res && res.length > 0) {
                let obj = {
                  key: value,
                  label: res,
                };
                selectedAsyncValue.value = { ...obj };
              }
            });
          }
        } else {
          selectedValue.value = value.toString();
        }
      }

      /**
       * 初始化字典下拉数据
       */
      async function initDictData() {
        let { dict, async, dictOptions, pageSize } = props;
        if (!async) {
          //如果字典项集合有数据
          if (dictOptions && dictOptions.length > 0) {
            options.value = dictOptions;
          } else {
            //根据字典Code, 初始化字典数组
            let dictStr = '';
            if (dict) {
              let arr = dict.split(',');
              if (arr[0].indexOf('where') > 0) {
                let tbInfo = arr[0].split('where');
                dictStr = tbInfo[0].trim() + ',' + arr[1] + ',' + arr[2] + ',' + encodeURIComponent(tbInfo[1]);
              } else {
                dictStr = dict;
              }
              //根据字典Code, 初始化字典数组
              const dictData = await initDictOptions(dictStr);
              options.value = dictData;
            }
          }
        } else {
          if (!dict) {
            console.error('搜索组件未配置字典项');
          } else {
            //异步一开始也加载一点数据
            loading.value = true;
            defHttp.get({ url: `/sys/dict/loadDict/${dict}`, params: { pageSize: pageSize, keyword: '' } }).then((res) => {
              loading.value = false;
              if (res && res.length > 0) {
                options.value = res;
              }
            });
          }
        }
      }
      /**
       * 同步改变事件
       * */
      function handleChange(value) {
        selectedValue.value = value;
        callback();
      }
      /**
       * 异步改变事件
       * */
      function handleAsyncChange(selectedObj) {
        if (selectedObj) {
          selectedAsyncValue.value = selectedObj;
          selectedValue.value = selectedObj.key;
        } else {
          selectedAsyncValue.value = null;
          selectedValue.value = null;
          options.value = null;
          loadData('');
        }
        callback();
      }
      /**
       *回调方法
       * */
      function callback() {
        loadSelectText.value = false;
        emit('change', unref(selectedValue));
        emit('update:value', unref(selectedValue));
      }
      /**
       * 过滤选中option
       */
      function filterOption(input, option) {
        return option?.children[0]?.children.toLowerCase().indexOf(input.toLowerCase()) >= 0;
      }

      function getParentContainer(node) {
        // update-begin-author:taoyan date:20220407 for: getPopupContainer一直有值 导致popContainer的逻辑永远走不进去，把它挪到前面判断
        if (props.popContainer) {
          return document.querySelector(props.popContainer);
        } else {
          if (typeof props.getPopupContainer === 'function') {
            return props.getPopupContainer(node);
          } else {
            return node.parentNode;
          }
        }
        // update-end-author:taoyan date:20220407 for: getPopupContainer一直有值 导致popContainer的逻辑永远走不进去，把它挪到前面判断
      }
      return {
        attrs,
        options,
        loading,
        selectedValue,
        selectedAsyncValue,
        loadData: useDebounceFn(loadData, 800),
        getParentContainer,
        filterOption,
        handleChange,
        handleAsyncChange,
      };
    },
  });
</script>

<style scoped></style>
