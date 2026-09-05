module("luci.controller.mtk_dash2", package.seeall)

function index()
	entry({"admin", "network", "mtk-dash2"}, firstchild(), _("MTK Dash2"), 48).dependent = false
	entry({"admin", "network", "mtk-dash2", "overview"}, view("mtk-dash2/overview"), _("Overview"), 10)
	entry({"admin", "network", "mtk-dash2", "wireless"}, view("mtk-dash2/wireless"), _("Wireless"), 20)
	entry({"admin", "network", "mtk-dash2", "map"}, view("mtk-dash2/map"), _("MAP EasyMesh"), 30)
	entry({"admin", "network", "mtk-dash2", "advanced"}, view("mtk-dash2/advanced"), _("Advanced"), 40)
	entry({"admin", "network", "mtk-dash2", "diagnostics"}, view("mtk-dash2/diagnostics"), _("Diagnostics"), 50)
	entry({"admin", "network", "mtk-dash2", "backup"}, view("mtk-dash2/backup"), _("Backup & Restore"), 60)
	entry({"admin", "network", "mtk-dash2", "about"}, view("mtk-dash2/about"), _("About"), 70)
end
