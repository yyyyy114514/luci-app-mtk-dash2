include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-mtk-dash2
PKG_VERSION:=0.4.1
PKG_RELEASE:=1

LUCI_TITLE:=MTK Dash2 Wi-Fi and MAP management
LUCI_DEPENDS:=+luci-base +luci-lib-jsonc +luci-lib-nixio +libubus-lua +lua +rpcd +iwinfo
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# rpcd only scans /usr/libexec/rpcd at startup; without a restart the exec
# plugin objects are not registered and every RPC returns
# "-32000: Object not found" (frontend stuck on "正在载入视图…").
define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -z "$${IPKG_INSTROOT}" ] && {
	rm -rf /tmp/luci-modulecache /tmp/luci-indexcache /tmp/luci-menu
	/etc/init.d/rpcd restart 2>/dev/null || killall rpcd 2>/dev/null || true
}
exit 0
endef

IP ?= 192.168.1.1
SSH_USER ?= root
SSH_HOST := $(SSH_USER)@$(IP)
SSH ?= ssh
SCP ?= scp
SSH_OPTS ?= -o ConnectTimeout=10
SCP_OPTS ?= $(SSH_OPTS)
LOCAL_VERSION := $(if $(PKG_RELEASE),$(PKG_VERSION)-$(PKG_RELEASE),$(PKG_VERSION))
REMOTE_STAMP := /usr/share/$(PKG_NAME)/VERSION
REMOTE_MENU := /usr/share/luci/menu.d/luci-app-mtk-dash2.json
REMOTE_RPCD := /usr/libexec/rpcd/mtk-dash2
REMOTE_RPCD_ADV := /usr/libexec/rpcd/mtk-dash2-advanced
REMOTE_RPCD_MAP := /usr/libexec/rpcd/map-easymesh
REMOTE_LUA_JSON := /usr/lib/lua/mtk_dash2_json.lua
REMOTE_ACL := /usr/share/rpcd/acl.d/luci-app-mtk-dash2.json
REMOTE_ACL_MAP := /usr/share/rpcd/acl.d/luci-app-mtk-dash2-map.json
REMOTE_VIEW := /www/luci-static/resources/view/mtk-dash2

.PHONY: standalone-help standalone-ssh-test standalone-install standalone-upgrade standalone-uninstall standalone-reload standalone-diagnose standalone-version

standalone-help:
	@printf '%s\n' '独立部署目标：' '  make standalone-install IP=192.168.1.1' '  make standalone-upgrade IP=192.168.1.1 [FORCE=1]' '  make standalone-uninstall IP=192.168.1.1' '  make standalone-version'

standalone-version:
	@printf '%s\n' '$(PKG_NAME) $(LOCAL_VERSION)'

standalone-ssh-test:
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) true

standalone-install: standalone-ssh-test
	@echo '部署 $(PKG_NAME) $(LOCAL_VERSION) 到 $(SSH_HOST)'
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) 'mkdir -p /usr/libexec/rpcd /usr/share/rpcd/acl.d /usr/share/luci/menu.d $(REMOTE_VIEW) /usr/share/$(PKG_NAME) /usr/lib/lua'
	@$(SCP) $(SCP_OPTS) root/usr/share/luci/menu.d/luci-app-mtk-dash2.json $(SSH_HOST):$(REMOTE_MENU)
	@$(SCP) $(SCP_OPTS) root/usr/libexec/rpcd/mtk-dash2 $(SSH_HOST):$(REMOTE_RPCD)
	@$(SCP) $(SCP_OPTS) root/usr/libexec/rpcd/mtk-dash2-advanced $(SSH_HOST):$(REMOTE_RPCD_ADV)
	@$(SCP) $(SCP_OPTS) root/usr/libexec/rpcd/map-easymesh $(SSH_HOST):$(REMOTE_RPCD_MAP)
	@$(SCP) $(SCP_OPTS) root/usr/lib/lua/mtk_dash2_json.lua $(SSH_HOST):$(REMOTE_LUA_JSON)
	@$(SCP) $(SCP_OPTS) root/usr/share/rpcd/acl.d/luci-app-mtk-dash2.json $(SSH_HOST):$(REMOTE_ACL)
	@$(SCP) $(SCP_OPTS) root/usr/share/rpcd/acl.d/luci-app-mtk-dash2-map.json $(SSH_HOST):$(REMOTE_ACL_MAP)
	@$(SCP) $(SCP_OPTS) -r htdocs/luci-static/resources/view/mtk-dash2/. $(SSH_HOST):$(REMOTE_VIEW)/
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) 'chmod 0755 $(REMOTE_RPCD) $(REMOTE_RPCD_ADV) $(REMOTE_RPCD_MAP); printf "%s\\n" "$(LOCAL_VERSION)" > $(REMOTE_STAMP); rm -rf /tmp/luci-modulecache* /tmp/luci-indexcache* /tmp/luci-menu* 2>/dev/null || true; /etc/init.d/rpcd restart; sleep 1; if ubus list | grep -qx mtk-dash2; then echo "RPC 注册 OK：mtk-dash2 已注册"; else echo "RPC 注册失败：mtk-dash2 未出现在 ubus，请运行 make standalone-diagnose IP=$(IP)"; fi'
	@echo '部署完成；LuCI 缓存已清理，rpcd 已重载并验证。'

standalone-upgrade: standalone-ssh-test
	@set -e; local='$(LOCAL_VERSION)'; remote="$$($(SSH) $(SSH_OPTS) $(SSH_HOST) 'cat $(REMOTE_STAMP) 2>/dev/null || true' 2>/dev/null || true)"; \
	if [ -z "$$remote" ]; then echo '远程未安装，执行独立安装'; $(MAKE) --no-print-directory standalone-install; \
	elif [ "$$remote" = "$$local" ] && [ -z "$(FORCE)" ]; then echo "远程已是版本 $$local，跳过升级"; \
	elif [ -n "$$remote" ] && [ "$$remote" != "$$local" ] && [ "$$(printf '%s\\n%s\\n' "$$remote" "$$local" | sort -V | tail -n1)" = "$$remote" ] && [ -z "$(FORCE)" ]; then echo "远程版本 $$remote 高于本地 $$local，跳过升级；使用 FORCE=1 才覆盖"; exit 1; \
	else $(MAKE) --no-print-directory standalone-install; fi

standalone-uninstall: standalone-ssh-test
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) 'rm -f $(REMOTE_MENU) $(REMOTE_RPCD) $(REMOTE_RPCD_ADV) $(REMOTE_RPCD_MAP) $(REMOTE_ACL) $(REMOTE_ACL_MAP) $(REMOTE_LUA_JSON); rm -rf $(REMOTE_VIEW) /usr/share/$(PKG_NAME) /tmp/luci-modulecache* /tmp/luci-indexcache* /tmp/luci-menu* 2>/dev/null || true; /etc/init.d/rpcd restart >/dev/null 2>&1 || killall rpcd 2>/dev/null || true'
	@echo '已卸载 $(PKG_NAME)，LuCI 缓存已清理，rpcd 已重载。'

standalone-reload: standalone-ssh-test
	@echo '重新加载 rpcd 并清理 LuCI 缓存（用于修复 RPC Object not found / 页面加载卡住）'
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) 'rm -rf /tmp/luci-modulecache* /tmp/luci-indexcache* /tmp/luci-menu* 2>/dev/null || true; /etc/init.d/rpcd restart; sleep 1; echo "--- ubus 中的 mtk/map 对象 ---"; ubus list 2>&1 | grep -E "mtk|map" || echo "(mtk-dash2 未注册，请运行 make standalone-diagnose IP=$(IP))"; echo "--- ACL 文件 ---"; ls -l /usr/share/rpcd/acl.d/ 2>/dev/null | grep -E "mtk|map" || echo "(未找到 mtk ACL)"'
	@echo '重载完成；请强制刷新浏览器（Ctrl+Shift+R）后再访问 LuCI。'

standalone-diagnose: standalone-ssh-test
	@echo '== 一键诊断 $(PKG_NAME) =='
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) 'echo "[1] 固件信息"; grep -E "DISTRIB_(ID|RELEASE|DESCRIPTION)" /etc/openwrt_release 2>/dev/null; echo; echo "[2] rpcd 进程"; pgrep -af rpcd || echo "rpcd 未运行"; echo; echo "[3] 插件文件"; ls -la /usr/libexec/rpcd/ 2>/dev/null | grep -E "mtk|map" || echo "未找到插件文件"; ls -la /usr/lib/lua/mtk_dash2_json.lua 2>/dev/null || echo "未找到内置 JSON 兜底模块"; echo; echo "[4] ubus 对象"; ubus list 2>&1 | grep -E "mtk|map" || echo "(mtk-dash2 未注册 -> Object not found 的根源)"; echo; echo "[5] 手动执行 list（注册用）"; timeout 5 /usr/libexec/rpcd/mtk-dash2 list 2>&1 | head -c 200; echo; echo "[6] 手动执行 call status"; timeout 5 sh -c '"'"'echo "{}" | /usr/libexec/rpcd/mtk-dash2 call status'"'"' 2>&1 | head -c 400; echo; echo "[7] Lua 依赖与 JSON 模块"; lua -e "local j=require(\"luci.jsonc\"); print(\"luci.jsonc\", type(j.encode), type(j.decode))" 2>&1 | head -3; lua -e "local j=require(\"mtk_dash2_json\"); print(\"mtk_dash2_json\", type(j.encode), type(j.decode))" 2>&1 | head -3; lua -e "require(\"nixio.fs\"); print(\"nixio.fs OK\")" 2>&1 | head -3; echo; echo "[8] ACL"; ls -l /usr/share/rpcd/acl.d/ 2>/dev/null | grep -E "mtk|map" || echo "未找到 ACL"; echo; echo "[9] /tmp 空间与 LuCI 缓存"; df -h /tmp | tail -1; ls -d /tmp/luci-* 2>/dev/null || echo "(缓存不存在，LuCI 将重建)"; echo; echo "[10] 相关日志"; logread 2>/dev/null | grep -iE "rpcd|mtk-dash|map-easymesh" | tail -15'
	@echo '== 诊断完成。将以上输出贴回给我即可定位问题。=='

# call BuildPackage - OpenWrt build system

