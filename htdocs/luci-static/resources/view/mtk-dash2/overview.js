'use strict';
'require view';
'require rpc';

var status = rpc.declare({ object: 'mtk-dash2', method: 'status' });
var caps = rpc.declare({ object: 'mtk-dash2', method: 'capabilities' });

function badge(ok) { return E('span', { 'class': ok ? 'label label-success' : 'label label-warning' }, [ok ? _('可用') : _('不可用')]); }
function row(values) { return E('tr', {}, values.map(function(v) { return E('td', {}, [v == null ? '-' : String(v)]); })); }
function probeSection(probes) {
	var rows = [];
	Object.keys(probes || {}).forEach(function(k) {
		var p = probes[k];
		if (!p || (p.status !== 'available' && p.status !== 'running')) return;
		rows.push(E('tr', {}, [E('td', {}, [E('code', {}, [k])]), E('td', {}, [p.command ? E('code', {}, [String(p.command)]) : '-']), E('td', {}, [E('pre', {}, [String(p.output || '')])])]));
	});
	if (!rows.length) return null;
	return E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('已成功探测的运行时能力')]), E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('探针'), _('命令'), _('真实输出')])].concat(rows))]);
}

return view.extend({
	load: function() { return Promise.all([status(), caps()]); },
	render: function(data) {
		var s = data[0] || {}, c = data[1] || {}, root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('MTK Dash2 总览')]));
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('运行与依赖')]), E('p', {}, [_('mtwifi：'), badge(!!(c.hardware && c.hardware.mtwifi)), _('　无线：'), badge(!!s.running), _('　MAP 配置：'), badge(!!(c.map && c.map.config))]), E('p', {}, [_('自动刷新：30 秒；配置页面不会自动覆盖编辑内容。')])]));
		var rt = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('设备'), _('模式'), _('信道'), _('频宽'), _('功率'), _('状态'), _('接口数')])]);
		(s.radios || []).forEach(function(r) { rt.appendChild(row([r.id, r.hwmode, r.channel, r.htmode, r.txpower, r.disabled ? _('停用') : _('运行'), (r.ifaces || []).length])); });
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('无线设备')]), rt]));
		var it = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('接口'), _('SSID'), _('模式'), _('网络'), _('加密'), _('客户端')])]);
		(s.radios || []).forEach(function(r) { (r.ifaces || []).forEach(function(f) { it.appendChild(row([f.ifname, f.ssid, f.mode, f.network, f.encryption, (s.stations && s.stations[f.ifname] || []).length])); }); });
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('接口与客户端')]), it, E('p', {}, [_('客户端总数：'), String(s.station_count || 0)])]));
		var probes = probeSection(c.map && c.map.probes);
		if (probes) root.appendChild(probes);
		window.setTimeout(function() { if (document.body.contains(root)) location.reload(); }, 30000);
		return root;
	},
	handleSaveApply: null
});
