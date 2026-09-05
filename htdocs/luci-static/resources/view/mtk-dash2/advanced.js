'use strict';
'require view';
'require rpc';

var get = rpc.declare({ object: 'mtk-dash2', method: 'capabilities' });

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
	load: get,
	render: function(c) {
		c = c || {};
		var root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('高级参数')]));
		root.appendChild(E('p', {}, [_('仅展示当前设备配置中通过只读探测确认的参数。')]));
		var fields = (c.advanced_fields || []).filter(function(f) { return f.verified === true; });
		if (fields.length) {
			var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('分类'), _('参数'), _('类型'), _('范围/默认'), _('来源'), _('应用需求')])]);
			fields.forEach(function(f) {
				var range = f.values ? f.values.join(', ') : (f.min != null ? f.min + ' - ' + f.max : (f.default == null ? '-' : String(f.default)));
				t.appendChild(E('tr', {}, [E('td', {}, [f.category]), E('td', {}, [f.label + ' (' + f.id + ')']), E('td', {}, [f.type]), E('td', {}, [range]), E('td', {}, [f.source]), E('td', {}, [f.reload])]));
			});
			root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('已探测到配置项')]), t]));
		} else {
			root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('已探测到配置项')]), E('p', {}, [_('当前设备配置中没有探测到可展示的 MTK 专用参数。')])]));
		}
		var probes = probeSection(c.map && c.map.probes);
		if (probes) root.appendChild(probes);
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('工具与限制')]), E('pre', {}, [JSON.stringify({ tools: c.tools, limits: c.limits, version: c.version }, null, 2)])]));
		return root;
	}
});
