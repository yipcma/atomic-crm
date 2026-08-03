import type { TranslationMessages } from "ra-core";

/**
 * Simplified Chinese (mainland) translations for the ra-core framework strings.
 *
 * Written in-repo rather than pulled from `ra-language-chinese`: this project
 * requires a human to vet any new dependency, and keeping the catalog here also
 * keeps the register consistent with the CRM strings next to it.
 *
 * Conventions followed throughout, per mainland software usage:
 *  - Full-width punctuation (，。：？！“”（）) and no space before it.
 *  - Mainland vocabulary: 登录 / 用户 / 设置 / 网络 / 邮箱 (not the Taiwanese
 *    登入 / 使用者 / 設定 / 網路).
 *  - Chinese has no grammatical plural, so both branches of a `||||` plural
 *    carry the same text; the count placeholder does the work.
 *  - Measure words matched to the noun: 条 for records, 位 for people,
 *    个 for generic items, 项 for entries.
 */
export const chineseCoreMessages: TranslationMessages = {
  ra: {
    action: {
      add_filter: "添加筛选",
      add: "添加",
      back: "返回",
      bulk_actions: "已选择 %{smart_count} 项 |||| 已选择 %{smart_count} 项",
      cancel: "取消",
      clear_array_input: "清空列表",
      clear_input_value: "清除内容",
      clone: "复制",
      confirm: "确定",
      create: "新建",
      create_item: "新建%{item}",
      delete: "删除",
      edit: "编辑",
      export: "导出",
      list: "列表",
      refresh: "刷新",
      remove_filter: "移除此筛选",
      remove_all_filters: "移除全部筛选",
      remove: "移除",
      reset: "重置",
      save: "保存",
      search: "搜索",
      search_columns: "搜索列",
      select_all: "全选",
      select_all_button: "全选",
      select_row: "选择此行",
      show: "查看",
      sort: "排序",
      undo: "撤销",
      unselect: "取消选择",
      expand: "展开",
      close: "关闭",
      open_menu: "打开菜单",
      close_menu: "关闭菜单",
      update: "更新",
      move_up: "上移",
      move_down: "下移",
      open: "打开",
      toggle_theme: "切换浅色/深色模式",
      select_columns: "列",
      update_application: "重新加载应用",
    },
    boolean: {
      true: "是",
      false: "否",
      null: " ",
    },
    page: {
      create: "新建%{name}",
      dashboard: "仪表盘",
      edit: "%{name} %{recordRepresentation}",
      error: "出错了",
      list: "%{name}",
      loading: "加载中",
      not_found: "未找到",
      show: "%{name} %{recordRepresentation}",
      empty: "暂无%{name}。",
      invite: "要现在添加一个吗？",
      access_denied: "无访问权限",
      authentication_error: "身份验证出错",
    },
    input: {
      file: {
        upload_several: "将文件拖到此处上传，或点击选择文件。",
        upload_single: "将文件拖到此处上传，或点击选择文件。",
      },
      image: {
        upload_several: "将图片拖到此处上传，或点击选择图片。",
        upload_single: "将图片拖到此处上传，或点击选择图片。",
      },
      references: {
        all_missing: "未能找到关联数据。",
        many_missing: "至少有一项关联数据已不可用。",
        single_missing: "关联数据已不可用。",
      },
      password: {
        toggle_visible: "隐藏密码",
        toggle_hidden: "显示密码",
      },
    },
    message: {
      about: "关于",
      access_denied: "您没有访问此页面的权限",
      are_you_sure: "确定要执行此操作吗？",
      authentication_error: "身份验证服务返回错误，无法校验您的登录信息。",
      auth_error: "校验身份令牌时出错。",
      bulk_delete_content:
        "确定要删除这 %{smart_count} 个%{name}吗？ |||| 确定要删除这 %{smart_count} 个%{name}吗？",
      bulk_delete_title:
        "删除 %{smart_count} 个%{name} |||| 删除 %{smart_count} 个%{name}",
      bulk_update_content:
        "确定要更新这 %{smart_count} 个%{name}吗？ |||| 确定要更新这 %{smart_count} 个%{name}吗？",
      bulk_update_title:
        "更新 %{smart_count} 个%{name} |||| 更新 %{smart_count} 个%{name}",
      clear_array_input: "确定要清空整个列表吗？",
      delete_content: "确定要删除此%{name}吗？",
      delete_title: "删除%{name} %{recordRepresentation}",
      details: "详情",
      error: "客户端发生错误，请求未能完成。",
      invalid_form: "表单填写有误，请检查后重试",
      loading: "请稍候",
      no: "否",
      not_found: "网址有误，或您访问的链接已失效。",
      select_all_limit_reached:
        "数据量过大，无法全部选中，仅选中了前 %{max} 项。",
      unsaved_changes: "部分修改尚未保存，确定要放弃吗？",
      yes: "是",
      placeholder_data_warning: "网络异常：数据刷新失败。",
    },
    navigation: {
      clear_filters: "清除筛选",
      no_filtered_results: "当前筛选条件下没有找到%{name}。",
      no_results: "未找到%{name}",
      no_more_results: "第 %{page} 页超出范围，请返回上一页。",
      page_out_of_boundaries: "第 %{page} 页超出范围",
      page_out_from_end: "已经是最后一页",
      page_out_from_begin: "已经是第一页",
      page_range_info: "第 %{offsetBegin}-%{offsetEnd} 条，共 %{total} 条",
      partial_page_range_info:
        "第 %{offsetBegin}-%{offsetEnd} 条，共超过 %{offsetEnd} 条",
      current_page: "第 %{page} 页",
      page: "跳转到第 %{page} 页",
      first: "跳转到首页",
      last: "跳转到末页",
      next: "下一页",
      previous: "上一页",
      page_rows_per_page: "每页显示：",
      skip_nav: "跳到主要内容",
    },
    sort: {
      sort_by: "按%{field_lower_first}%{order}排序",
      ASC: "升序",
      DESC: "降序",
    },
    auth: {
      auth_check_error: "请先登录",
      user_menu: "个人资料",
      username: "用户名",
      password: "密码",
      email: "邮箱",
      sign_in: "登录",
      sign_in_error: "登录失败，请重试",
      logout: "退出登录",
    },
    notification: {
      updated: "已更新 %{smart_count} 项 |||| 已更新 %{smart_count} 项",
      created: "创建成功",
      deleted: "已删除 %{smart_count} 项 |||| 已删除 %{smart_count} 项",
      bad_item: "数据有误",
      item_doesnt_exist: "该数据不存在",
      http_error: "与服务器通信出错",
      data_provider_error: "数据接口出错，详情请查看控制台。",
      i18n_error: "无法加载该语言的翻译文件",
      canceled: "操作已取消",
      logged_out: "登录已过期，请重新登录。",
      not_authorized: "您没有访问该资源的权限。",
      application_update_available: "有新版本可用。",
      offline: "网络不可用，数据获取失败。",
    },
    validation: {
      required: "必填",
      minLength: "至少需要 %{min} 个字符",
      maxLength: "最多 %{max} 个字符",
      minValue: "不得小于 %{min}",
      maxValue: "不得大于 %{max}",
      number: "请输入数字",
      email: "请输入有效的邮箱地址",
      oneOf: "只能是以下之一：%{options}",
      regex: "格式不正确，需匹配：%{pattern}",
      unique: "该值已存在，请勿重复",
    },
    saved_queries: {
      label: "已保存的查询",
      query_name: "查询名称",
      new_label: "保存当前查询…",
      new_dialog_title: "将当前查询另存为",
      remove_label: "删除已保存的查询",
      remove_label_with_name: "删除查询“%{name}”",
      remove_dialog_title: "删除已保存的查询？",
      remove_message: "确定要从已保存的查询列表中移除该项吗？",
      help: "筛选列表后保存查询，方便下次使用",
    },
    guesser: {
      empty: {
        title: "暂无数据",
        message: "请检查数据接口配置",
      },
    },
    configurable: {
      customize: "自定义",
      configureMode: "配置此页面",
      inspector: {
        title: "检查器",
        content: "将鼠标悬停在界面元素上即可进行配置",
        reset: "重置设置",
        hideAll: "全部隐藏",
        showAll: "全部显示",
      },
      Datagrid: {
        title: "数据表格",
        unlabeled: "未命名列 #%{column}",
      },
      SimpleForm: {
        title: "表单",
        unlabeled: "未命名字段 #%{input}",
      },
      SimpleList: {
        title: "列表",
        primaryText: "主要文本",
        secondaryText: "次要文本",
        tertiaryText: "第三行文本",
      },
    },
  },
};
