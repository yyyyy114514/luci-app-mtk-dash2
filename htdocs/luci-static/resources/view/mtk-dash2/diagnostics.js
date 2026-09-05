'use strict';
'require view';
'require rpc';

var getDiag = rpc.declare({ object: 'mtk-dash2-advanced', method: 'diagnostics' });
var getCaps = rpc.declare({ object: 'mtk-dash2-advanced', method: 'capabilities' });
var getStatus = rpc.declare({ object: 'mtk-dash2', method: 'status' });
var getTemp = rpc.declare({ object: 'mtk-dash2-advanced', method: 'temperature', params: ['iface'] });
var getChan = rpc.declare({ object: 'mtk-dash2-advanced', method: 'channel', params: ['iface'] });
var getPower = rpc.declare({ object: 'mtk-dash2-advanced', method: 'power', params: ['iface'] });
var readReg = rpc.declare({ object: 'mtk-dash2-advanced', method: 'read_register', params: ['iface'] });
var doScan = rpc.declare({ object: 'mtk-dash2', method: 'scan', params: ['iface'] });

function download(name, data) {
	var a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
	a.download = name;
	a.click();
}
function tbl(headers) {
	var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, headers.map(function(h) { return E('th', {}, [h]); }))]);
	return t;
}
function section(title, body) { return E('div', { 'class': 'cbi-section' }, [E('h3', {}, [title])].concat(Array.isArray(body) ? body : [body])); }
function preBox() { return E('pre', { 'style': 'max-height:360px;overflow:auto' }, []); }

return view.extend({
	load: function() {
		return Promise.all([getDiag(), getCaps(), getStatus()]).catch(function(e) {
			return [{ ok: false, error: String(e) }, { ok: false }, { ok: false }];
		});
	},
	render: function(data) {
		var d = data[0] || {}, c = data[1] || {}, s = data[2] || {};
		var probes = c.probes || {}, iface = probes.iface;
		var root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('诊断工具')]));
		root.appendChild(E('p', {}, [_('只读诊断与运行数据；输出已自动过滤密码、密钥等敏感字段。')]));

		var rtf = E('table', { 'class': 'cbi-section-table' });
		var rtfHead = false;
		function addRuntime(label, r) {
			if (!r || !r.ok) return;
			if (!rtfHead) { rtfHead = true; rtf.appendChild(E('tr', {}, [_('指标'), _('接口'), _('值'), _('工具')].map(function(h) { return E('th', {}, [h]); }))); }
			rtf.appendChild(E('tr', {}, [E('td', {}, [label]), E('td', {}, [String(r.iface || '-')]),
				E('td', {}, [r.value != null ? String(r.value) + (r.unit || '') : (r.channel != null ? String(r.channel) : (r.tx_power != null ? String(r.tx_power) + ' dBm' : '-'))]),
				E('td', {}, [String(r.tool || r.command || '-')])]));
		}
		var rtBtns = E('div', {}, []);
		if (iface) {
			if (probes.temperature && probes.temperature.status === 'available') rtBtns.appendChild(E('button', { 'class': 'cbi-button', 'click': function() { getTemp(iface).then(function(r) { addRuntime(_('温度'), r); }); } }, [_('读取温度')]));
			rtBtns.appendChild(E('button', { 'class': 'cbi-button', 'click': function() { getChan(iface).then(function(r) { addRuntime(_('信道'), r); }); } }, [_('读取信道')]));
			rtBtns.appendChild(E('button', { 'class': 'cbi-button', 'click': function() { getPower(iface).then(function(r) { addRuntime(_('功率'), r); }); } }, [_('读取功率')]));
			rtBtns.appendChild(E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { if (confirm(_('扫描会短暂占用射频，继续？'))) doScan(iface).then(function(r) { scanOut.textContent = JSON.stringify(r, null, 2); }); } }, [_('扫描')]));
		} else {
			rtBtns.appendChild(E('p', { 'class': 'alert-message warning' }, [_('未探测到 mtwifi 接口（ra*/apcli*），运行时读取不可用。')]));
		}
		root.appendChild(section(_('运行数据读取'), [rtBtns, rtf]));
		var scanOut = preBox();
		root.appendChild(section(_('扫描结果'), [scanOut]));

		var stt = tbl([_('接口'), _('MAC'), _('信号'), _('TX'), _('RX'), _('空闲')]);
		var count = 0;
		Object.keys(s.stations || {}).forEach(function(k) {
			(s.stations[k] || []).forEach(function(x) {
				count++;
				stt.appendChild(E('tr', {}, [k, x.mac, x.signal, x.tx_rate, x.rx_rate, x.inactive].map(function(v) { return E('td', {}, [v == null ? '-' : String(v)]); })));
			});
		});
		root.appendChild(section(_('客户端站点表（共 ') + String(count) + _(' 个）'), count ? stt : E('p', {}, [_('当前无已连接客户端。')])));

		var regOut = preBox();
		var regBtn = E('div', {}, []);
		if (iface && probes.register && probes.register.status === 'available') {
			regBtn.appendChild(E('button', { 'class': 'cbi-button', 'click': function() { readReg(iface).then(function(r) { regOut.textContent = r.output || r.error || JSON.stringify(r); }); } }, [_('只读查看 iwpriv 统计')]));
			root.appendChild(section(_('寄存器 / 驱动统计（只读）'), [regBtn, regOut]));
		}

		var steps = tbl([_('步骤'), _('命令'), _('退出码'), _('结果'), _('输出')]);
		(d.steps || []).forEach(function(x) {
			steps.appendChild(E('tr', {}, [
				E('td', {}, [String(x.name || '-')]),
				E('td', {}, [x.command ? E('code', {}, [String(x.command)]) : '-']),
				E('td', {}, [String(x.exit_code == null ? '-' : x.exit_code)]),
				E('td', {}, [x.ok ? _('成功') : _('失败')]),
				E('td', {}, [E('pre', { 'style': 'max-height:200px;overflow:auto' }, [String(x.output || x.error || x.files ? x.output || x.error || JSON.stringify(x.files || {}) : '-')])])
			]));
		});
		root.appendChild(section(_('诊断链路'), [steps, E('div', {}, [
			E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { getDiag().then(function(nd) { download('mtk-dash2-diagnostics.json', nd); }); } }, [_('下载脱敏诊断包')]),
			' ',
			E('button', { 'class': 'cbi-button', 'click': function() { location.reload(); } }, [_('重新收集')])
		])]));

		var probeRows = tbl([_('探针'), _('状态'), _('依据')]);
		Object.keys(probes).forEach(function(k) {
			var p = probes[k];
			if (k === 'iface' || !p || typeof p !== 'object') return;
			probeRows.appendChild(E('tr', {}, [E('td', {}, [E('code', {}, [k])]), E('td', {}, [p.status === 'available' ? _('可用') : _('不可用')]), E('td', {}, [String(p.reason || p.command || '-')])]));
		});
		root.appendChild(section(_('能力探测结果'), [probeRows]));
		return root;
	},
	handleSaveApply: null
});
