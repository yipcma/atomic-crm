/**
 * Simplified Chinese (mainland) translations for the CRM-specific strings.
 *
 * Terminology follows what mainland CRM products actually ship, rather than a
 * literal rendering of the English:
 *  - deal      -> 商机   (the standard term for a sales opportunity; 交易 would
 *                        read as a completed transaction)
 *  - pipeline  -> 销售漏斗
 *  - sales_id  -> 负责人 (who owns the record, which is how "account manager"
 *                        is actually labelled in Chinese CRM UIs)
 *  - note      -> 备注
 *  - hot       -> 重点   (重点联系人 = the contacts worth prioritising)
 *
 * Chinese has no grammatical plural, so both branches of a `||||` plural carry
 * the same text and the count placeholder does the work. Punctuation is
 * full-width, and measure words are matched to the noun (位 people, 家 companies,
 * 条 records, 个 generic).
 *
 * Key set is kept identical to englishCrmMessages -- i18nParity.node.test.ts
 * fails the build otherwise.
 */
export const chineseCrmMessages = {
  resources: {
    companies: {
      name: "公司 |||| 公司",
      forcedCaseName: "公司",
      fields: {
        name: "公司名称",
        website: "官网",
        linkedin_url: "领英主页",
        phone_number: "电话",
        created_at: "创建时间",
        nb_contacts: "联系人数量",
        revenue: "营业额",
        sector: "所属行业",
        size: "公司规模",
        tax_identifier: "纳税人识别号",
        address: "地址",
        city: "城市",
        zipcode: "邮政编码",
        state_abbr: "省/州",
        country: "国家/地区",
        description: "简介",
        context_links: "相关链接",
        sales_id: "负责人",
      },
      empty: {
        description: "您还没有添加任何公司。",
        title: "暂无公司",
      },
      field_categories: {
        contact: "联系方式",
        additional_info: "补充信息",
        address: "地址",
        context: "背景资料",
      },
      action: {
        create: "新建公司",
        edit: "编辑公司",
        new: "新建公司",
        show: "查看公司",
      },
      added_on: "添加于 %{date}",
      followed_by: "由 %{name} 跟进",
      followed_by_you: "由您跟进",
      no_contacts: "暂无联系人",
      nb_contacts: "%{smart_count} 位联系人 |||| %{smart_count} 位联系人",
      nb_deals: "%{smart_count} 个商机 |||| %{smart_count} 个商机",
      sizes: {
        one_employee: "1 人",
        two_to_nine_employees: "2-9 人",
        ten_to_forty_nine_employees: "10-49 人",
        fifty_to_two_hundred_forty_nine_employees: "50-249 人",
        two_hundred_fifty_or_more_employees: "250 人以上",
      },
      autocomplete: {
        create_error: "创建公司时出错",
        create_item: "新建“%{item}”",
        create_label: "输入名称以新建公司",
      },
      filters: {
        only_mine: "仅看我负责的公司",
      },
    },
    contacts: {
      name: "联系人 |||| 联系人",
      forcedCaseName: "联系人",
      field_categories: {
        background_info: "背景信息",
        identity: "基本信息",
        misc: "其他",
        personal_info: "个人信息",
        position: "职位信息",
      },
      fields: {
        first_name: "名",
        last_name: "姓",
        last_seen: "最近联系",
        title: "职位",
        company_id: "所属公司",
        email_jsonb: "邮箱地址",
        email: "邮箱",
        phone_jsonb: "电话号码",
        phone_number: "电话",
        linkedin_url: "领英主页",
        background: "背景信息（简介、结识经过等）",
        has_newsletter: "已订阅邮件",
        sales_id: "负责人",
      },
      action: {
        add: "添加联系人",
        add_first: "添加第一位联系人",
        create: "新建联系人",
        edit: "编辑联系人",
        export_vcard: "导出为 vCard",
        new: "新建联系人",
        show: "查看联系人",
      },
      background: {
        last_activity_on: "最近活动于 %{date}",
        added_on: "添加于 %{date}",
        followed_by: "由 %{name} 跟进",
        followed_by_you: "由您跟进",
        status_none: "无",
      },
      position_at: "%{title}，任职于",
      position_at_company: "%{company} %{title}",
      empty: {
        description: "您还没有添加任何联系人。",
        title: "暂无联系人",
      },
      import: {
        title: "导入联系人",
        button: "导入 CSV",
        complete:
          "联系人导入完成。成功导入 %{importCount} 位，失败 %{errorCount} 位",
        progress:
          "已导入 %{importCount} / %{rowCount} 位联系人，失败 %{errorCount} 位。",
        error: "文件导入失败，请确认上传的是有效的 CSV 文件。",
        imported: "已导入",
        remaining_time: "预计剩余时间：",
        running: "正在导入，请不要关闭此页面。",
        sample_download: "下载 CSV 示例",
        sample_hint: "这是一份可作为模板使用的 CSV 示例文件",
        stop: "停止导入",
        csv_file: "CSV 文件",
        contacts_label: "位联系人 |||| 位联系人",
      },
      inputs: {
        genders: {
          male: "他/他的",
          female: "她/她的",
          nonbinary: "TA/TA的",
        },
        personal_info_types: {
          work: "工作",
          home: "住宅",
          other: "其他",
        },
      },
      list: {
        error_loading: "加载联系人失败",
      },
      bulk_tag: {
        action: "打标签",
        back: "返回标签列表",
        create_description: "新建一个标签并添加到所选联系人。",
        description: "为所选联系人选择已有标签，或新建一个。",
        empty: "还没有标签。新建一个来为所选联系人打标签。",
        error: "为联系人添加标签失败",
        noop: "所选联系人已有该标签",
        success:
          "已为 %{smart_count} 位联系人添加标签 |||| 已为 %{smart_count} 位联系人添加标签",
        title: "为联系人添加标签",
      },
      merge: {
        action: "与其他联系人合并",
        confirm: "合并联系人",
        current_contact: "当前联系人（将被删除）",
        description: "将此联系人与另一位合并。",
        error: "合并联系人失败",
        merging: "正在合并…",
        no_additional_data: "没有需要合并的额外数据",
        select_target: "请选择要合并到的联系人",
        success: "联系人合并成功",
        target_contact: "目标联系人（将被保留）",
        title: "合并联系人",
        warning_description: "所有数据都将转移到第二位联系人。此操作不可撤销。",
        warning_title: "警告：该操作不可恢复",
        what_will_be_merged: "将合并以下内容：",
      },
      filters: {
        before_last_month: "上月之前",
        before_this_month: "本月之前",
        before_this_week: "本周之前",
        managed_by_me: "由我负责",
        search: "搜索姓名、公司…",
        this_week: "本周",
        today: "今天",
        tags: "标签",
        tasks: "任务",
      },
      hot: {
        empty_change_status:
          "为联系人添加备注并点击“显示选项”，即可修改其状态。",
        empty_hint: "状态为“重点”的联系人会显示在这里。",
        title: "重点联系人",
      },
    },
    deals: {
      name: "商机 |||| 商机",
      fields: {
        name: "商机名称",
        description: "商机描述",
        company_id: "所属公司",
        contact_ids: "相关联系人",
        category: "商机类型",
        amount: "预算金额",
        expected_closing_date: "预计成交日期",
        stage: "所处阶段",
      },
      action: {
        back_to_deal: "返回商机",
        create: "新建商机",
        new: "新建商机",
      },
      field_categories: {
        misc: "其他",
      },
      archived: {
        action: "归档",
        error: "操作失败：商机未归档",
        list_title: "已归档商机",
        success: "商机已归档",
        title: "已归档商机",
        view: "查看已归档商机",
      },
      inputs: {
        linked_to: "关联至",
      },
      unarchived: {
        action: "移回看板",
        error: "操作失败：商机未取消归档",
        success: "商机已取消归档",
      },
      updated: "商机已更新",
      empty: {
        before_create: "，然后再创建商机。",
        description: "您还没有创建任何商机。",
        title: "暂无商机",
      },
      invalid_date: "日期无效",
    },
    notes: {
      name: "备注 |||| 备注",
      forcedCaseName: "备注",
      fields: {
        status: "状态",
        date: "日期",
        attachments: "附件",
        contact_id: "联系人",
        deal_id: "商机",
      },
      action: {
        add: "添加备注",
        add_first: "添加第一条备注",
        delete: "删除备注",
        edit: "编辑备注",
        update: "更新备注",
        add_this: "添加此备注",
      },
      sheet: {
        create: "新建备注",
        create_for: "为 %{name} 新建备注",
        edit: "编辑备注",
        edit_for: "编辑 %{name} 的备注",
      },
      deleted: "备注已删除",
      empty: "暂无备注",
      author_added: "%{name} 添加了备注",
      you_added: "您添加了备注",
      me: "我",
      list: {
        error_loading: "加载备注失败",
      },
      note_for_contact: "关于 %{name} 的备注",
      stepper: {
        hint: "进入联系人页面并添加一条备注",
      },
      added: "备注已添加",
      inputs: {
        add_note: "写点什么…",
        options_hint: "（添加附件或修改详情）",
        show_options: "显示选项",
      },
      actions: {
        attach_document: "添加附件",
      },
      validation: {
        note_or_attachment_required: "请填写备注内容或添加附件",
      },
    },
    sales: {
      name: "用户 |||| 用户",
      fields: {
        first_name: "名",
        last_name: "姓",
        email: "邮箱",
        administrator: "管理员",
        disabled: "已停用",
      },
      create: {
        error: "创建用户时出错。",
        success: "用户已创建，稍后会收到设置密码的邮件。",
        title: "新建用户",
      },
      edit: {
        error: "操作失败，请重试。",
        record_not_found: "未找到该记录",
        success: "用户信息已更新",
        title: "编辑 %{name}",
      },
      action: {
        new: "新建用户",
      },
    },
    tasks: {
      name: "任务 |||| 任务",
      forcedCaseName: "任务",
      fields: {
        text: "任务内容",
        due_date: "截止日期",
        type: "任务类型",
        contact_id: "关联联系人",
        due_short: "截止",
      },
      action: {
        add: "添加任务",
        create: "新建任务",
        edit: "编辑任务",
      },
      actions: {
        postpone_next_week: "推迟到下周",
        postpone_tomorrow: "推迟到明天",
        title: "任务操作",
      },
      added: "任务已添加",
      deleted: "任务已删除",
      dialog: {
        create: "新建任务",
        create_for: "为 %{name} 新建任务",
      },
      sheet: {
        edit: "编辑任务",
        edit_for: "编辑 %{name} 的任务",
      },
      empty: "暂无任务",
      empty_list_hint: "为联系人添加的任务会显示在这里。",
      filters: {
        later: "以后",
        overdue: "已逾期",
        this_week: "本周",
        today: "今天",
        tomorrow: "明天",
        with_pending: "有待办任务",
      },
      regarding_contact: "（关于：%{name}）",
      updated: "任务已更新",
    },
    tags: {
      name: "标签 |||| 标签",
      action: {
        add: "添加标签",
        create: "新建标签",
      },
      dialog: {
        color: "颜色",
        create_title: "新建标签",
        edit_title: "编辑标签",
        name_label: "标签名称",
        name_placeholder: "请输入标签名称",
      },
    },
  },
  crm: {
    action: {
      reset_password: "重置密码",
    },
    superadmin: {
      organizations: "组织管理",
      organization: "组织",
      users: "用户数",
      active: "启用中",
      toggle_active: "启用或停用该组织",
      no_organizations: "暂无组织。",
      disable_title: "确定要停用该组织吗？",
      disable_confirm: "停用该组织",
    },
    share: {
      copy_link: "复制链接",
      copied: "链接已复制",
      copy_failed: "无法自动复制，请选中上方链接后手动复制。",
    },
    auth: {
      email: "邮箱",
      organization_name: "组织名称",
      verifying_email: "正在验证邮箱…",
      invalid_invite: "该链接无效或已过期。",
      verification_resent: "如果该账号需要验证，我们已重新发送验证链接。",
      resend_verification: "重新发送验证邮件",
      back_to_sign_in: "返回登录",
      forgot_password_sent: "如果该账号存在，我们已发送重置密码的邮件。",
      forgot_password_failed: "重置邮件发送失败，请重试。",
      forgot_password_rate_limited: "操作过于频繁，请稍等几分钟后再试。",
      first_name: "名",
      last_name: "姓",
      confirm_password: "确认密码",
      confirmation_required: "请点击我们刚刚发送到您邮箱的链接以激活账号。",
      recovery_email_sent: "如果您已注册，稍后会收到重置密码的邮件。",
      sign_in_failed: "登录失败。",
      sign_in_google_workspace: "使用 Google Workspace 登录",
      signup: {
        create_account: "创建账号",
        create_first_user: "创建第一个用户账号以完成初始化。",
        creating: "创建中…",
        initial_user_created: "初始用户创建成功",
      },
      welcome_title: "欢迎使用 Leaf CRM",
    },
    common: {
      activity: "动态",
      added: "添加了",
      details: "详情",
      last_activity_with_date: "最近活动 %{date}",
      load_more: "加载更多",
      misc: "其他",
      past: "已过期",
      read_more: "展开全文",
      retry: "重试",
      show_less: "收起",
      copied: "已复制！",
      copy: "复制",
      loading: "加载中…",
      me: "我",
      task_count: "%{smart_count} 个任务 |||| %{smart_count} 个任务",
    },
    changelog: {
      title: "更新日志",
    },
    activity: {
      added_company: "%{name} 添加了公司",
      you_added_company: "您添加了公司",
      added_contact: "%{name} 添加了",
      you_added_contact: "您添加了",
      added_note: "%{name} 添加了备注，关于",
      you_added_note: "您添加了备注，关于",
      added_note_about_deal: "%{name} 添加了备注，关于商机",
      you_added_note_about_deal: "您添加了备注，关于商机",
      added_deal: "%{name} 添加了商机",
      you_added_deal: "您添加了商机",
      at_company: "任职于",
      to: "至",
      load_more: "加载更多动态",
    },
    dashboard: {
      deals_chart: "预计商机收入",
      deals_pipeline: "销售漏斗",
      latest_activity: "最新动态",
      latest_activity_error: "加载最新动态失败",
      latest_notes: "我的最新备注",
      latest_notes_added_ago: "添加于 %{timeAgo}",
      mentions: "有人提到了您",
      stepper: {
        install: "安装 Leaf CRM",
        progress: "已完成 %{step}/3",
        whats_next: "接下来做什么？",
      },
      upcoming_tasks: "待办任务",
    },
    header: {
      import_data: "导入数据",
    },
    image_editor: {
      change: "更换",
      drop_hint: "将文件拖到此处上传，或点击选择文件。",
      editable_content: "可编辑内容",
      title: "上传并裁剪图片",
      update_image: "更新图片",
    },
    import: {
      action: {
        download_error_report: "下载错误报告",
        import: "导入",
        import_another: "导入其他文件",
      },
      error: {
        unable: "无法导入该文件。",
      },
      idle: {
        description_1: "支持导入用户、公司、联系人、备注和任务。",
        description_2: "数据需为 JSON 文件，格式参考以下示例：",
      },
      status: {
        all_success: "全部记录导入成功。",
        complete: "导入完成。",
        failed: "失败",
        imported: "已导入",
        in_progress: "正在导入，请不要离开此页面。",
        some_failed: "部分记录未能导入。",
        table_caption: "导入状态",
      },
      title: "导入数据",
    },
    settings: {
      about: "关于",
      companies: {
        sectors: "行业",
      },
      dark_mode_logo: "深色模式徽标",
      deals: {
        categories: "商机类型",
        currency: "货币",
        pipeline_help: "选择哪些商机阶段计入销售漏斗。",
        pipeline_statuses: "漏斗阶段",
        stages: "商机阶段",
      },
      light_mode_logo: "浅色模式徽标",
      notes: {
        statuses: "备注状态",
      },
      reset_defaults: "恢复默认设置",
      save_error: "配置保存失败",
      saved: "配置已保存",
      saving: "保存中…",
      tasks: {
        types: "任务类型",
      },
      preferences: "偏好设置",
      title: "设置",
      app_title: "应用名称",
      sections: {
        branding: "品牌设置",
      },
      validation: {
        duplicate: "%{display_name}存在重复：%{items}",
        in_use: "以下%{display_name}仍被商机使用，无法删除：%{items}",
        validating: "校验中…",
        entities: {
          categories: "商机类型",
          stages: "商机阶段",
        },
      },
    },
    theme: {
      dark: "深色",
      label: "主题",
      light: "浅色",
      system: "跟随系统",
    },
    language: "语言",
    navigation: {
      label: "CRM 导航",
    },
    profile: {
      inbound: {
        description:
          "您可以将邮件发送到系统的收件邮箱，例如把它加入%{field}。系统会自动处理这些邮件，并为对应的联系人添加备注。",
        title: "收件邮箱",
      },
      mcp: {
        title: "MCP 服务",
        description:
          "使用该地址，可通过 Model Context Protocol（MCP）将 AI 助手接入您的 CRM 数据。",
      },
      password: {
        change: "修改密码",
      },
      password_reset_sent: "重置密码的邮件已发送至您的邮箱",
      record_not_found: "未找到该记录",
      title: "个人资料",
      updated: "个人资料已更新",
      update_error: "操作失败，请重试",
    },
    validation: {
      invalid_url: "请输入有效的网址",
      invalid_linkedin_url: "网址必须来自 linkedin.com",
    },
  },
};
