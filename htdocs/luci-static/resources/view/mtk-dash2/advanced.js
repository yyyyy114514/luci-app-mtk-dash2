'use strict';
'require view';
'require rpc';

var getCaps = rpc.declare({ object: 'mtk-dash2-advanced', method: 'capabilities' });
var getStatus = rpc.declare({ object: 'mtk-dash2', method: 'status' });
var apply = rpc.declare({ object: 'mtk-dash2-advanced', method: 'apply', params: ['device', 'iface', 'values', 'apply'] });
var readRegister = rpc.declare({ object: 'mtk-dash2-advanced', method: 'read_register', params: ['iface'] });

function inputFor(f) {
	if (f.type === 'enum' && Array.isArray(f.values))
		return E('select', { 'class': 'cbi-input-select', 'data-field': f.id }, f.values.map(function(v) { return E('option', { value: String(v) }, [String(v)]); }));
	if (f.type === 'boolean')
		return E('select', { 'class': 'cbi-input-select', 'data-field': f.id }, [E('option', { value: '1' }, [_('启用')]), E('option', { value: '0' }, [_('禁用')])]);
	var attrs = { 'class': 'cbi-input-text', 'data-field': f.id };
	if (f.min != null) attrs.placeholder = String(f.min) + ' ~ ' + String(f.max == null ? '' : f.max);
	return E('input', attrs);
}
function fieldTable(fields) {
	var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('分类'), _('参数'), _('取值'), _('应用方式')].map(function(h) { return E('th', {}, [h]); }))]);
	fields.forEach(function(f) {
		t.appendChild(E('tr', {}, [E('td', {}, [_(f.category || '-')]), E('td', {}, [_(f.label || f.id)]), E('td', {}, [inputFor(f)]), E('td', {}, [f.reload === 'reinstall' ? _('重装驱动') : _('reload')])]));
	});
	return t;
}
function collect(t, fields) {
	var values = {};
	t.querySelectorAll('[data-field]').forEach(function(el) {
		if (el.value == null || el.value === '') return;
		var f = fields.filter(function(x) { return x.id === el.getAttribute('data-field'); })[0];
		if (!f) return;
		if (f.type === 'integer') values[f.id] = Number(el.value);
		else values[f.id] = el.value;
	});
	return values;
}

return view.extend({
	load: function() { return Promise.all([getCaps(), getStatus()]); },
	render: function(data) {
		var c = data[0] || {}, s = data[1] || {}, tools = (c.tools || {});
		var probes = c.probes || {};
		var radios = s.radios || [];
		var root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('高级参数')]));
		root.appendChild(E('p', {}, [_('字段白名单来自 mtwifi 驱动 netifd 声明（mtwifi.sh config_add_*），仅显示可真实写入 UCI 并经 mtwifi-cfg 应用链路的参数；失败自动回滚。')]));

		if (!c.writable || !radios.length) {
			root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('参数应用')]), E('p', { 'class': 'alert-message warning' }, [!radios.length ? _('未探测到 mtwifi 无线设备。') : _('缺少 uci，无法写入配置。')])]));
		} else {
			var deviceSel = E('select', { 'class': 'cbi-input-select' });
			radios.forEach(function(r) { if (r.id) deviceSel.appendChild(E('option', { value: String(r.id) }, [String(r.id)])); });
			var ifaceSel = E('select', { 'class': 'cbi-input-select' });
			var ifaces = [];
			radios.forEach(function(r) { (r.ifaces || []).forEach(function(f) { if (f.ifname) { ifaces.push(f.ifname); ifaceSel.appendChild(E('option', { value: String(f.ifname) }, [String(f.ifname) + (f.ssid ? ' (' + f.ssid + ')' : '')])); } }); });

			var devFields = (c.fields || []).filter(function(f) { return f.target === 'device'; });
			var ifFields = (c.fields || []).filter(function(f) { return f.target === 'iface'; });
			var out = E('pre', { 'style': 'max-height:360px;overflow:auto' }, []);
			function doApply(target) {
				var t = target === 'device' ? devTable : ifTable;
				var fs = target === 'device' ? devFields : ifFields;
				var values = collect(t, fs);
				if (!Object.keys(values).length) { window.alert(_('请先填写要修改的参数。')); return; }
				var msg = target === 'device'
					? _('确认将所选设备级参数应用到 ') + deviceSel.value + _('？无线会重新加载，可能短暂中断。')
					: _('确认将所选接口级参数应用到 ') + ifaceSel.value + _('？该接口会重新加载。');
				if (!window.confirm(msg)) return;
				apply(deviceSel.value, target === 'iface' ? ifaceSel.value : null, values, true)
					.then(function(r) { out.textContent = JSON.stringify(r, null, 2); })
					.catch(function(e) { out.textContent = String(e); });
			}

			var devTable = fieldTable(devFields);
			root.appendChild(E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [_('设备级参数')]),
				E('p', {}, [_('设备：'), deviceSel]),
				devTable,
				E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { doApply('device'); } }, [_('应用设备参数')])
			]));

			var ifTable = null;
			if (ifaces.length) {
				ifTable = fieldTable(ifFields);
				root.appendChild(E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, [_('接口级参数')]),
					E('p', {}, [_('接口：'), ifaceSel]),
					ifTable,
					E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { doApply('iface'); } }, [_('应用接口参数')])
				]));
			}
			root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('操作输出')]), out]));
		}

		var probeRows = [];
		['register', 'spectrum', 'temperature'].forEach(function(k) {
			var p = probes[k];
			if (!p || p.status !== 'available') return;
			probeRows.push(E('tr', {}, [E('td', {}, [E('code', {}, [k])]), E('td', {}, [E('code', {}, [String(p.command || '-')])]), E('td', {}, [E('pre', { 'style': 'max-height:160px;overflow:auto' }, [String(p.output || '')])])]));
		});
		if (probeRows.length) {
			root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('已成功探测的运行时能力')]), E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('探针'), _('命令'), _('真实输出')])].concat(probeRows))]));
			var regOut = E('pre', { 'style': 'max-height:360px;overflow:auto' }, []);
			if (probes.register && probes.register.status === 'available' && probes.iface) {
				root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('驱动统计（只读）')]),
					E('button', { 'class': 'cbi-button', 'click': function() { readRegister(probes.iface).then(function(r) { regOut.textContent = r.output || r.error || JSON.stringify(r); }); } }, [_('读取 iwpriv 统计')]), regOut]));
			}
		}
		return root;
	},
	handleSaveApply: null
});
