'use strict';
'require view';
'require rpc';

var get = rpc.declare({ object: 'mtk-dash2', method: 'topology' });
var caps = rpc.declare({ object: 'mtk-dash2', method: 'capabilities' });
var apply = rpc.declare({ object: 'mtk-dash2', method: 'apply_map', params: ['restart'] });

function table(headers, rows) {
	var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, headers.map(function(x) { return E('th', {}, [x]); }))]);
	rows.forEach(function(r) { t.appendChild(E('tr', {}, r.map(function(x) { return E('td', {}, [x == null ? '-' : x]); }))); });
	return t;
}
function probeSection(probes) {
	var rows = [];
	Object.keys(probes || {}).forEach(function(k) {
		var p = probes[k];
		if (!p || (p.status !== 'available' && p.status !== 'running')) return;
		rows.push([E('code', {}, [k]), p.command ? E('code', {}, [String(p.command)]) : '-', E('pre', {}, [String(p.output || '')])]);
	});
	return rows.length ? E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('已成功探测的 MAP/运行时能力')]), table([_('探针'), _('命令'), _('真实输出')], rows)]) : null;
}

return view.extend({
	load: function() { return Promise.all([get(), caps()]); },
	render: function(data) {
		var d = data[0] || {}, c = data[1] || {}, root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('MAP 组网')]));
		root.appendChild(E('p', {}, [d.hint || _('仅显示实际探测到的 MAP 状态。')]));
		var components = [];
		Object.keys(d.components || {}).forEach(function(k) { if (d.components[k]) components.push([k, _('已探测到')]); });
		var services = [];
		Object.keys(d.services || {}).forEach(function(k) { if (d.services[k]) services.push([k, _('已安装')]); });
		if (components.length) root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('组件')]), table([_('组件'), _('状态')], components)]));
		if (services.length) root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('服务')]), table([_('服务'), _('状态')], services)]));
		var ps = probeSection(d.probes);
		if (ps) root.appendChild(ps);
		var configs = [];
		(d.config || []).forEach(function(x) { if (!x.present) return; (x.fields || []).forEach(function(f) { configs.push([x.path + ': ' + f.key, f.value]); }); });
		if (configs.length) root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('MAP 配置')]), table([_('字段'), _('值')], configs)]));
		var hasService = !!(c.map && c.map.has_managed_service);
		if (hasService) {
			var b = E('button', { 'class': 'cbi-button cbi-button-apply', 'click': function() { if (confirm(_('重启 MAP 服务会中断组网，是否继续？'))) apply(true).then(function(x) { root.appendChild(E('pre', {}, [JSON.stringify(x, null, 2)])); }); } }, [_('应用 MAP（重启服务）')]);
			root.appendChild(E('div', { 'class': 'cbi-section' }, [b]));
		}
		return root;
	}
});
