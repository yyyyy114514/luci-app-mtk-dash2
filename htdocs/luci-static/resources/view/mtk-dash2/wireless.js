'use strict';
'require view';
'require rpc';

var get = rpc.declare({ object: 'mtk-dash2', method: 'status' });
var caps = rpc.declare({ object: 'mtk-dash2', method: 'capabilities' });
var set = rpc.declare({ object: 'mtk-dash2', method: 'set_radio', params: ['device', 'enabled', 'apply'] });
var scan = rpc.declare({ object: 'mtk-dash2', method: 'scan', params: ['iface'] });
var apply = rpc.declare({ object: 'mtk-dash2', method: 'apply_wireless' });

function cells(a) { return a.map(function(v) { return E('td', {}, [v == null ? '-' : v]); }); }

return view.extend({
	load: function() { return Promise.all([get(), caps()]); },
	render: function(data) {
		var s = data[0] || {}, c = data[1] || {}, tools = c.tools || {};
		var canToggle = !!(tools.uci && tools.wifi), canScan = !!tools.iwinfo, canApply = !!tools.wifi;
		var root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('无线配置与运行状态')]));
		root.appendChild(E('p', {}, [_('基础配置继续使用系统 wireless UCI；本页仅显示当前设备具备的操作。')]));
		var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('设备'), _('模式'), _('信道'), _('频宽'), _('状态'), _('操作')])]);
		(s.radios || []).forEach(function(r) {
			var action = '-';
			if (canToggle) action = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { set(r.id, r.disabled, true).then(function() { location.reload(); }); } }, [r.disabled ? _('启用') : _('停用')]);
			t.appendChild(E('tr', {}, cells([r.id, r.hwmode, r.channel, r.htmode, r.disabled ? _('停用') : _('运行'), action])));
		});
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('无线设备')]), t]));
		var f = [];
		(s.radios || []).forEach(function(r) { (r.ifaces || []).forEach(function(i) { f.push(i); }); });
		var it = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('接口'), _('SSID'), _('模式'), _('网络'), _('加密'), _('客户端')])]);
		f.forEach(function(i) { it.appendChild(E('tr', {}, cells([i.ifname, i.ssid, i.mode, i.network, i.encryption, (s.stations && s.stations[i.ifname] || []).length]))); });
		var out = E('pre', {}, [_('等待操作')]);
		var buttons = [];
		if (canScan && f.length) buttons.push(E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { scan(f[0].ifname).then(function(d) { out.textContent = JSON.stringify(d, null, 2); }); } }, [_('扫描邻居网络')]));
		if (canApply) buttons.push(E('button', { 'class': 'cbi-button cbi-button-apply', 'click': function() { if (confirm(_('应用无线配置会短暂中断无线连接，是否继续？'))) apply().then(function(d) { out.textContent = JSON.stringify(d, null, 2); }); } }, [_('应用无线配置')]));
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('接口与扫描')]), it].concat(buttons).concat([out])));
		return root;
	},
	handleSaveApply: null
});
