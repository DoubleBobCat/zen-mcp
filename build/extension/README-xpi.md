# zen-mcp XPI 安装说明

`zen-mcp-<version>.xpi` 是 Zen Browser 扩展包。

## Zen Browser 安装

1. 打开 Zen Browser 的扩展管理页面：`about:addons`。
2. 使用齿轮菜单选择“从文件安装附加组件”，选择本目录中的 `.xpi` 文件。
3. 如果 Zen Browser 拒绝加载本地或未签名 XPI，打开 `about:config`，将以下配置设为 `true`：

   ```text
   extensions.experiments.enabled = true
   ```

4. 对于开发版、未签名或临时 XPI，如果仍被签名校验阻止，可能还需要将以下配置设为 `false`：

   ```text
   xpinstall.signatures.required = false
   ```

   该设置只适用于允许未签名扩展的开发环境。修改后重启 Zen Browser，再重复安装步骤。

5. 打开扩展设置，确认 bridge URL 为：

   ```text
   ws://localhost:9222?type=extension
   ```

## 连接 bridge

启动 bridge 后打开 `http://localhost:9222/`。如果扩展无法连接，请检查：

- bridge service 正在运行：`systemctl --user status zen-mcp-bridge.service`
- bridge URL 使用 `ws://localhost:9222?type=extension`
- `extensions.experiments.enabled` 已开启

安全提示：`xpinstall.signatures.required=false` 会降低扩展签名校验强度，只应在本地开发或测试配置中使用。
