'use strict';
'require view';
'require rpc';

var getCapabilities = rpc.declare({ object: 'mtk-dash2', method: 'capabilities' });

function row(label, value) {
	return E('tr', {}, [ E('th', {}, [ label ]), E('td', {}, [ value == null ? '-' : String(value) ]) ]);
}

return view.extend({
	load: getCapabilities,

	render: function(caps) {
		caps = caps || {};
		var hardware = caps.hardware || {};
		var tools = caps.tools || {};
		var root = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, [ _('关于 MTK Dash2') ]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('版本信息') ]),
				E('table', { 'class': 'cbi-section-table' }, [
					row(_('插件版本'), caps.version || '-'),
					row(_('硬件平台'), hardware.chipset || '-'),
					row(_('后端'), caps.backend || '-'),
					row(_('MBSSID 上限'), caps.limits && caps.limits.ap_max || '-'),
					row(_('APCLI 上限'), caps.limits && caps.limits.apcli_max || '-')
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('运行环境') ]),
				E('table', { 'class': 'cbi-section-table' }, [
					row(_('mtwifi 驱动'), hardware.mtwifi ? _('可用') : _('不可用')),
					row(_('UCI'), tools.uci ? _('可用') : _('不可用')),
					row(_('mtwifi-cfg'), tools.mtwifi_cfg ? _('可用') : _('不可用')),
					row(_('iwinfo'), tools.iwinfo ? _('可用') : _('不可用')),
					row(_('WAPP/MAP'), caps.map && caps.map.has_managed_service ? _('已检测') : _('不可用'))
				])
			])
		]);
		return root;
	}
});
