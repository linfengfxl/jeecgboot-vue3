import type { JVxeColumn, JVxeDataProps, JVxeTableProps } from '../types';
import { computed, nextTick } from 'vue';
import { isArray, isEmpty, isPromise } from '/@/utils/is';
import { cloneDeep } from 'lodash-es';
import { JVxeTypePrefix, JVxeTypes } from '../types/JVxeTypes';
import { initDictOptions } from '/@/utils/dict';
import { pushIfNotExist } from '/@/utils/common/compUtils';
import { getEnhanced } from '../utils/enhancedUtils';
import { isRegistered } from '../utils/registerUtils';
import { JVxeComponent } from '../types/JVxeComponent';
import { useValidateRules } from './useValidateRules';
import { JVxeTableMethods } from '../types';

// handle 方法参数
export interface HandleArgs {
  props: JVxeTableProps;
  slots: any;
  data: JVxeDataProps;
  methods: JVxeTableMethods;
  col?: JVxeColumn;
  columns: JVxeColumn[];
  renderOptions?: any;
  enhanced?: JVxeComponent.Enhanced;
}

export function useColumns(props: JVxeTableProps, data: JVxeDataProps, methods: JVxeTableMethods, slots) {
  data.vxeColumns = computed(() => {
    let columns: JVxeColumn[] = [];
    if (isArray(props.columns)) {
      // handle 方法参数
      const args: HandleArgs = { props, slots, data, methods, columns };
      let seqColumn, selectionColumn, expandColumn, dragSortColumn;
      props.columns.forEach((column: JVxeColumn) => {
        // 排除未授权的列 1 = 显示/隐藏； 2 = 禁用
        let auth = methods.getColAuth(column.key);
        if (auth?.type == '1' && !auth.isAuth) {
          return;
        } else if (auth?.type == '2' && !auth.isAuth) {
          column.disabled = true;
        }
        // type 不填，默认为 normal
        if (column.type == null || isEmpty(column.type)) {
          column.type = JVxeTypes.normal;
        }
        let col: JVxeColumn = cloneDeep(column);
        // 处理隐藏列
        if (col.type === JVxeTypes.hidden) {
          return handleInnerColumn(args, col, handleHiddenColumn);
        }
        // 组件未注册，自动设置为 normal
        if (!isRegistered(col.type)) {
          col.type = JVxeTypes.normal;
        }
        args.enhanced = getEnhanced(col.type);
        args.col = col;
        args.renderOptions = {
          bordered: props.bordered,
          disabled: props.disabled,
          scrolling: data.scrolling,
          isDisabledRow: methods.isDisabledRow,
          listeners: {
            trigger: (name, event) => methods.trigger(name, event),
            valueChange: (event) => methods.trigger('valueChange', event),
            /** 重新排序行 */
            rowResort: (event) => {
              methods.doSort(event.oldIndex, event.newIndex);
              methods.trigger('dragged', event);
            },
            /** 在当前行下面插入一行 */
            rowInsertDown: (rowIndex) => methods.insertRows({}, rowIndex + 1),
          },
        };
        if (col.type === JVxeTypes.rowNumber) {
          seqColumn = col;
          columns.push(col);
        } else if (col.type === JVxeTypes.rowRadio || col.type === JVxeTypes.rowCheckbox) {
          selectionColumn = col;
          columns.push(col);
        } else if (col.type === JVxeTypes.rowExpand) {
          expandColumn = col;
          columns.push(col);
        } else if (col.type === JVxeTypes.rowDragSort) {
          dragSortColumn = col;
          columns.push(col);
        } else {
          col.params = column;
          handlerCol(args);
        }
      });
      handleInnerColumn(args, seqColumn, handleSeqColumn);
      handleInnerColumn(args, selectionColumn, handleSelectionColumn);
      handleInnerColumn(args, expandColumn, handleExpandColumn);
      handleInnerColumn(args, dragSortColumn, handleDragSortColumn, true);
    }
    return columns;
  });
}

/** 处理内置列 */
function handleInnerColumn(args: HandleArgs, col: JVxeColumn, handler: (args: HandleArgs) => void, assign?: boolean) {
  let renderOptions = col?.editRender || col?.cellRender;
  return handler({
    ...args,
    col: col,
    renderOptions: assign ? Object.assign({}, args.renderOptions, renderOptions) : renderOptions,
  });
}

/**
 * 处理隐藏列
 */
function handleHiddenColumn({ col, columns }: HandleArgs) {
  delete col!.type;
  col!.visible = false;
  columns.push(col!);
}

/**
 * 处理行号列
 */
function handleSeqColumn({ props, col, columns }: HandleArgs) {
  // 判断是否开启了行号列
  if (props.rowNumber) {
    let column = {
      type: 'seq',
      title: '#',
      width: 60,
      fixed: 'left',
      align: 'center',
    };
    if (col) {
      Object.assign(col, column);
    } else {
      columns.unshift(column as any);
    }
  }
}

/**
 * 处理可选择列
 */
function handleSelectionColumn({ props, data, col, columns }: HandleArgs) {
  // 判断是否开启了可选择行
  if (props.rowSelection) {
    let width = 40;
    if (data.statistics.has && !props.rowExpand && !props.dragSort) {
      width = 60;
    }
    let column = {
      type: props.rowSelectionType,
      width: width,
      fixed: 'left',
      align: 'center',
    };
    if (col) {
      Object.assign(col, column);
    } else {
      columns.unshift(column as any);
    }
  }
}

/**
 * 处理可展开行
 */
function handleExpandColumn({ props, data, col, columns }: HandleArgs) {
  // 是否可展开行
  if (props.rowExpand) {
    let width = 40;
    if (data.statistics.has && !props.dragSort) {
      width = 60;
    }
    let column = {
      type: 'expand',
      title: '',
      width: width,
      fixed: 'left',
      align: 'center',
      slots: { content: 'expandContent' },
    };
    if (col) {
      Object.assign(col, column);
    } else {
      columns.unshift(column as any);
    }
  }
}

/** 处理可排序列 */
function handleDragSortColumn({ props, data, col, columns, renderOptions }: HandleArgs) {
  // 是否可拖动排序
  if (props.dragSort) {
    let width = 40;
    if (data.statistics.has) {
      width = 60;
    }
    let column: any = {
      title: '',
      width: width,
      fixed: 'left',
      align: 'center',
    };
    let cellRender = {
      name: JVxeTypePrefix + JVxeTypes.rowDragSort,
      sortKey: props.sortKey,
    };
    if (renderOptions) {
      column.cellRender = Object.assign(renderOptions, cellRender);
    } else {
      column.cellRender = cellRender;
    }
    if (col) {
      Object.assign(col, column);
    } else {
      columns.unshift(column);
    }
  }
}

/** 处理自定义组件列 */
function handlerCol(args: HandleArgs) {
  const { props, col, columns, enhanced } = args;
  if (!col) return;
  let { type } = col;
  col.field = col.key;
  delete col.type;
  let renderName = 'cellRender';
  // 渲染选项
  let $renderOptions: any = { name: JVxeTypePrefix + type };
  if (enhanced?.switches.editRender) {
    if (!(enhanced.switches.visible || props.alwaysEdit)) {
      renderName = 'editRender';
    }
    // $renderOptions.type = (enhanced.switches.visible || props.alwaysEdit) ? 'visible' : 'default'
  }
  col[renderName] = $renderOptions;

  handleDict(args);
  handleRules(args);
  handleStatistics(args);
  handleSlots(args);
  handleLinkage(args);
  handleReloadEffect(args);

  if (col.editRender) {
    Object.assign(col.editRender, args.renderOptions);
  }
  if (col.cellRender) {
    Object.assign(col.cellRender, args.renderOptions);
  }

  columns.push(col);
}

/**
 * 处理字典
 */
async function handleDict({ col, methods }: HandleArgs) {
  if (col && col.params.dictCode) {
    /** 加载数据字典并合并到 options */
    try {
      // 查询字典
      if (!isPromise(col.params.optionsPromise)) {
        col.params.optionsPromise = new Promise(async (resolve) => {
          const dictOptions: any = await initDictOptions(col.params.dictCode);
          let options = col.params.options ?? [];
          dictOptions.forEach((dict) => {
            // 过滤重复数据
            if (options.findIndex((o) => o.value === dict.value) === -1) {
              options.push(dict);
            }
          });
          resolve(options);
        });
      }
      col.params.options = await col.params.optionsPromise;
      await nextTick();
      await methods.getXTable().updateData();
    } catch (e) {
      console.group(`[JVxeTable] 查询字典 "${col.params.dictCode}" 时发生异常！`);
      console.warn(e);
      console.groupEnd();
    }
  }
}

/**
 * 处理校验
 */
function handleRules(args: HandleArgs) {
  if (isArray(args.col?.validateRules)) {
    useValidateRules(args);
  }
}

/**
 * 处理统计列
 */
function handleStatistics({ col, data }: HandleArgs) {
  // sum = 求和、average = 平均值
  if (col && isArray(col.statistics)) {
    data.statistics.has = true;
    col.statistics.forEach((item) => {
      if (!isEmpty(item)) {
        let arr = data.statistics[(item as string).toLowerCase()];
        if (isArray(arr)) {
          pushIfNotExist(arr, col.key);
        }
      }
    });
  }
}

/**
 * 处理插槽
 */
function handleSlots({ slots, col, renderOptions }: HandleArgs) {
  // slot 组件特殊处理
  if (col && col.params.type === JVxeTypes.slot) {
    if (!isEmpty(col.slotName) && slots.hasOwnProperty(col.slotName)) {
      renderOptions.slot = slots[col.slotName];
    }
  }
}

/** 处理联动列 */
function handleLinkage({ data, col, renderOptions, methods }: HandleArgs) {
  // 处理联动列，联动列只能作用于 select 组件
  if (col && col.params.type === JVxeTypes.select && data.innerLinkageConfig != null) {
    // 判断当前列是否是联动列
    if (data.innerLinkageConfig.has(col.key)) {
      renderOptions.linkage = {
        config: data.innerLinkageConfig.get(col.key),
        getLinkageOptionsAsync: methods.getLinkageOptionsAsync,
        getLinkageOptionsSibling: methods.getLinkageOptionsSibling,
        handleLinkageSelectChange: methods.handleLinkageSelectChange,
      };
    }
  }
}

function handleReloadEffect({ props, data, renderOptions }: HandleArgs) {
  renderOptions.reloadEffect = {
    enabled: props.reloadEffect,
    getMap() {
      return data.reloadEffectRowKeysMap;
    },
    isEffect(rowId) {
      return data.reloadEffectRowKeysMap[rowId] === true;
    },
    removeEffect(rowId) {
      return (data.reloadEffectRowKeysMap[rowId] = false);
    },
  };
}
