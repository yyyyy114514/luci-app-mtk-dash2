include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-mtk-dash2
PKG_VERSION:=0.2.0
PKG_RELEASE:=

LUCI_TITLE:=MTK Dash2 Wi-Fi and MAP management
LUCI_DEPENDS:=+luci-base +luci-lib-jsonc +luci-lib-nixio +libubus-lua +lua +rpcd +iwinfo
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

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
REMOTE_ACL := /usr/share/rpcd/acl.d/luci-app-mtk-dash2.json
REMOTE_ACL_MAP := /usr/share/rpcd/acl.d/luci-app-mtk-dash2-map.json
REMOTE_VIEW := /www/luci-static/resources/view/mtk-dash2

.PHONY: standalone-help standalone-ssh-test standalone-install standalone-upgrade standalone-uninstall standalone-version

standalone-help:
	@printf '%s\n' '独立部署目标：' '  make standalone-install IP=192.168.1.1' '  make standalone-upgrade IP=192.168.1.1 [FORCE=1]' '  make standalone-uninstall IP=192.168.1.1' '  make standalone-version'

standalone-version:
	@printf '%s\n' '$(PKG_NAME) $(LOCAL_VERSION)'

standalone-ssh-test:
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) true

standalone-install: standalone-ssh-test
	@echo '部署 $(PKG_NAME) $(LOCAL_VERSION) 到 $(SSH_HOST)'
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) 'mkdir -p /usr/libexec/rpcd /usr/share/rpcd/acl.d /usr/share/luci/menu.d $(REMOTE_VIEW) /usr/share/$(PKG_NAME)'
	@$(SCP) $(SCP_OPTS) root/usr/share/luci/menu.d/luci-app-mtk-dash2.json $(SSH_HOST):$(REMOTE_MENU)
	@$(SCP) $(SCP_OPTS) root/usr/libexec/rpcd/mtk-dash2 $(SSH_HOST):$(REMOTE_RPCD)
	@$(SCP) $(SCP_OPTS) root/usr/libexec/rpcd/mtk-dash2-advanced $(SSH_HOST):$(REMOTE_RPCD_ADV)
	@$(SCP) $(SCP_OPTS) root/usr/libexec/rpcd/map-easymesh $(SSH_HOST):$(REMOTE_RPCD_MAP)
	@$(SCP) $(SCP_OPTS) root/usr/share/rpcd/acl.d/luci-app-mtk-dash2.json $(SSH_HOST):$(REMOTE_ACL)
	@$(SCP) $(SCP_OPTS) root/usr/share/rpcd/acl.d/luci-app-mtk-dash2-map.json $(SSH_HOST):$(REMOTE_ACL_MAP)
	@$(SCP) $(SCP_OPTS) -r htdocs/luci-static/resources/view/mtk-dash2/. $(SSH_HOST):$(REMOTE_VIEW)/
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) 'chmod 0755 $(REMOTE_RPCD) $(REMOTE_RPCD_ADV) $(REMOTE_RPCD_MAP); printf "%s\\n" "$(LOCAL_VERSION)" > $(REMOTE_STAMP); rm -rf /tmp/luci-modulecache* /tmp/luci-indexcache* /tmp/luci-menu* 2>/dev/null || true; /etc/init.d/rpcd restart >/dev/null 2>&1 || killall rpcd 2>/dev/null || true'
	@echo '部署完成；LuCI 缓存已清理，rpcd 已重载。'

standalone-upgrade: standalone-ssh-test
	@set -e; local='$(LOCAL_VERSION)'; remote="$$($(SSH) $(SSH_OPTS) $(SSH_HOST) 'cat $(REMOTE_STAMP) 2>/dev/null || true' 2>/dev/null || true)"; \
	if [ -z "$$remote" ]; then echo '远程未安装，执行独立安装'; $(MAKE) --no-print-directory standalone-install; \
	elif [ "$$remote" = "$$local" ] && [ -z "$(FORCE)" ]; then echo "远程已是版本 $$local，跳过升级"; \
	elif [ -n "$$remote" ] && [ "$$remote" != "$$local" ] && [ "$$(printf '%s\\n%s\\n' "$$remote" "$$local" | sort -V | tail -n1)" = "$$remote" ] && [ -z "$(FORCE)" ]; then echo "远程版本 $$remote 高于本地 $$local，跳过升级；使用 FORCE=1 才覆盖"; exit 1; \
	else $(MAKE) --no-print-directory standalone-install; fi

standalone-uninstall: standalone-ssh-test
	@$(SSH) $(SSH_OPTS) $(SSH_HOST) 'rm -f $(REMOTE_MENU) $(REMOTE_RPCD) $(REMOTE_RPCD_ADV) $(REMOTE_RPCD_MAP) $(REMOTE_ACL) $(REMOTE_ACL_MAP); rm -rf $(REMOTE_VIEW) /usr/share/$(PKG_NAME) /tmp/luci-modulecache* /tmp/luci-indexcache* /tmp/luci-menu* 2>/dev/null || true; /etc/init.d/rpcd restart >/dev/null 2>&1 || killall rpcd 2>/dev/null || true'
	@echo '已卸载 $(PKG_NAME)，LuCI 缓存已清理，rpcd 已重载。'

# call BuildPackage - OpenWrt build system

