'use strict';
'require view';
'require rpc';

var getStatus = rpc.declare({ object: 'map-easymesh', method: 'status' });
var getCaps = rpc.declare({ object: 'map-easymesh', method: 'capabilities' });
var setField = rpc.declare({ object: 'map-easymesh', method: 'set_field', params: ['field', 'value', 'reload'] });
var reloadSvc = rpc.declare({ object: 'map-easymesh', method: 'reload' });

/* field metadata: enum options and input kinds (mirrors backend FIELDS) */
var FIELD_META = {
	role: { kind: 'select', label: _('设备角色 (DeviceRole)'), options: [
		{ value: 'agent', label: _('Agent (0)') },
		{ value: 'controller', label: _('Controller (1)') },
		{ value: 'both', label: _('Controller+Agent (2)') }
	], hint: _('切换后需重启 MAP 服务生效') },
	backhaul: { kind: 'select', label: _('回程类型 (bh_type)'), options: [
		{ value: 'eth', label: _('以太网优先 (eth)') },
		{ value: 'wifi', label: _('无线回程 (wifi)') }
	] },
	steer: { kind: 'select', label: _('频段引导 (SteerEnable)'), options: boolOpts() },
	auto_bh: { kind: 'select', label: _('自动回程切换 (AutoBHSwitching)'), options: boolOpts() },
	ch_plan: { kind: 'select', label: _('信道规划 (ChPlanningEnable)'), options: boolOpts() },
	central_steer: { kind: 'select', label: _('集中式引导 (CentralizedSteering)'), options: boolOpts() },
	dhcp_ctl: { kind: 'select', label: _('DHCP 控制 (DhcpCtl)'), options: boolOpts() },
	non_map_ap: { kind: 'select', label: _('非 MAP AP 兼容 (NonMAPAPEnable)'), options: boolOpts() },
	quick_ch: { kind: 'select', label: _('快速信道切换 (MAP_QuickChChange)'), options: boolOpts() },
	netopt: { kind: 'select', label: _('网络优化 (NetworkOptimizationEnabled)'), options: boolOpts() },
	ap_steer_rssi: { kind: 'number', label: _('AP 引导 RSSI 阈值 (dBm)'), min: -100, max: 0 },
	force_roam_rssi: { kind: 'number', label: _('强制漫游 RSSI 阈值 (dBm)'), min: -100, max: 0 },
	scan_th_2g: { kind: 'number', label: _('2G 扫描阈值 (dBm)'), min: -100, max: 0 },
	scan_th_5g: { kind: 'number', label: _('5G 扫描阈值 (dBm)'), min: -100, max: 0 },
	scan_th_6g: { kind: 'number', label: _('6G 扫描阈值 (dBm)'), min: -100, max: 0 },
	metric_intv: { kind: 'number', label: _('度量上报间隔 (s)'), min: 1, max: 3600 },
	bh_steer_timeout: { kind: 'number', label: _('回程引导超时 (s)'), min: 1, max: 3600 },
	pref_ch_2g: { kind: 'number', label: _('首选信道 2G'), min: 1, max: 14 },
	pref_ch_5g: { kind: 'number', label: _('首选信道 5G'), min: 36, max: 177 },
	pref_ch_5gh: { kind: 'number', label: _('首选信道 5G-高'), min: 100, max: 177 }
};

function boolOpts() {
	return [ { value: '1', label: _('启用') }, { value: '0', label: _('停用') } ];
}

var GROUPS = [
	{ title: _('角色与回程'), fields: ['role', 'backhaul', 'auto_bh'] },
	{ title: _('漫游与引导'), fields: ['steer', 'ap_steer_rssi', 'force_roam_rssi', 'central_steer', 'scan_th_2g', 'scan_th_5g', 'scan_th_6g'] },
	{ title: _('信道规划'), fields: ['ch_plan', 'pref_ch_2g', 'pref_ch_5g', 'pref_ch_5gh', 'quick_ch'] },
	{ title: _('其他'), fields: ['dhcp_ctl', 'non_map_ap', 'netopt', 'metric_intv', 'bh_steer_timeout'] }
];

function table(headers, rows) {
	var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, headers.map(function(h) { return E('th', {}, [h]); }))]);
	rows.forEach(function(r) { t.appendChild(E('tr', {}, r.map(function(c) { return E('td', {}, [c == null || c === '' ? '-' : String(c)]); }))); });
	return t;
}

function section(title) {
	var el = E('div', { 'class': 'cbi-section' }, [E('h3', {}, [title])]);
	for (var i = 1; i < arguments.length; i++) el.appendChild(arguments[i]);
	return el;
}

function msg(el, cls, text) {
	el.innerHTML = '';
	el.appendChild(E('p', { 'class': 'alert-message ' + cls }, [text]));
}

return view.extend({
	load: function() {
		return Promise.all([getStatus(), getCaps()]);
	},

	fieldControl: function(id, state, writable, msgEl) {
		var meta = FIELD_META[id];
		if (!meta || !state || !state.present) return null;
		var input;
		if (meta.kind == 'select') {
			input = E('select', { 'class': 'cbi-input-select', style: 'min-width:220px' });
			meta.options.forEach(function(o) {
				var opt = E('option', { 'value': o.value }, [o.label]);
				if (String(state.value) == o.value || (id == 'role' && state.value != null && o.value == { '0': 'agent', '1': 'controller', '2': 'both' }[String(state.value)]))
					opt.selected = true;
				input.appendChild(opt);
			});
		} else {
			input = E('input', { 'class': 'cbi-input-text', type: 'number', style: 'width:160px',
				min: meta.min, max: meta.max, value: state.value != null ? String(state.value) : '' });
		}
		if (!writable) input.disabled = true;
		var btn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			if (!window.confirm(_('确认修改 %s ？写入校验失败或服务重载失败将自动回滚。').format(meta.label)))
				return;
			msg(msgEl, 'notice', _('正在写入...'));
			setField(id, String(input.value), true).then(function(r) {
				if (r && r.ok) {
					var extra = r.reloaded ? _('，服务已重载') : '';
					msg(msgEl, 'success', _('已写入 %s=%s（原值 %s）%s').format(r.key, r.value, r.old, extra));
				} else {
					msg(msgEl, 'error', (r && r.error) || _('操作失败'));
				}
			}).catch(function(e) { msg(msgEl, 'error', String(e)); });
		}}, [_('应用')]);
		if (!writable) btn.disabled = true;
		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [meta.label]),
			E('div', { 'class': 'cbi-value-field' }, [input, ' ', btn])
		]);
	},

	render: function(data) {
		var state = data[0] || {}, caps = data[1] || {};
		var writable = caps.writable == true;
		var wfields = caps.writable_fields || {};
		var root = E('div', { 'class': 'cbi-map' }, [ E('h2', {}, [ _('MAP EasyMesh（联发科 MAP）') ]) ]);

		if (!caps.config_present) {
			root.appendChild(E('p', { 'class': 'alert-message warning' }, [
				_('未检测到 /etc/map 配置（mapd_cfg / 1905d.cfg）。请确认固件已安装 mtwifi-cfg 与 MAP 组件。')
			]));
			return root;
		}

		/* overview */
		var svcRows = Object.keys(state.services || {}).map(function(k) {
			var s = state.services[k];
			return [k, s.status == 'running' ? _('运行中') : (s.status == 'missing' ? _('未安装') : _('未运行'))];
		});
		root.appendChild(section(_('运行状态'), table([_('服务'), _('状态')], svcRows)));

		root.appendChild(section(_('节点信息'), table(
			[_('角色 (DeviceRole)'), _('MAP Root (1905d)'), _('MAP Agent (1905d)'), _('回程类型')],
			[[
				String(state.role) + ' (' + String(state.role_raw) + ')',
				state.map_root == '1' ? _('是') : _('否'),
				state.map_agent == '1' ? _('是') : _('否'),
				(state.fields && state.fields.backhaul && state.fields.backhaul.value) || '-'
			]]
		)));

		/* reload button */
		var reloadMsg = E('div');
		var reloadBtn = E('button', { 'class': 'cbi-button cbi-button-apply', 'click': function(ev) {
			ev.preventDefault();
			if (!window.confirm(_('确认重启 MAP 服务（mapd/wapp/bs20）？组网会短暂中断。'))) return;
			msg(reloadMsg, 'notice', _('正在重启服务...'));
			reloadSvc().then(function(r) {
				if (r && r.ok) msg(reloadMsg, 'success', _('MAP 服务已重启'));
				else msg(reloadMsg, 'error', (r && r.error) || _('部分服务重启失败，详见诊断页'));
			}).catch(function(e) { msg(reloadMsg, 'error', String(e)); });
		}}, [_('重启 MAP 服务')]);
		root.appendChild(section(_('服务操作'),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-field' }, [reloadBtn])
			]),
			reloadMsg
		));

		/* topology */
		var topoMsg = E('div');
		var nodes = state.nodes || [];
		var nodeRows = nodes.map(function(n) { return [n.mac, n.role || '-', n.raw || '']; });
		root.appendChild(section(_('拓扑节点 (wappctrl get map_devices)'), nodes.length
			? table([_('MAC'), _('角色'), _('原始信息')], nodeRows)
			: E('p', { 'class': 'alert-message notice' }, [ state.topology_available ? _('当前未查询到节点。') : _('wappctrl 查询不可用（未安装或无接口）。') ])));
		var links = state.backhaul_links || [];
		if (links.length) {
			root.appendChild(section(_('回程链路 (bh_link_list)'), table([_('链路')], links.map(function(l) { return [l]; }))));
		}

		/* editable fields */
		var fields = state.fields || {};
		var self = this;
		GROUPS.forEach(function(g) {
			var box = E('div');
			var count = 0;
			g.fields.forEach(function(id) {
				var st = fields[id];
				if (!st) return;
				var m = E('div');
				var ctl = self.fieldControl(id, st, writable && wfields[id] == true, m);
				if (ctl) { box.appendChild(ctl); box.appendChild(m); count++; }
			});
			if (count > 0) root.appendChild(section(g.title, box));
		});

		/* full config view */
		var cfgRows = [];
		(state.config || []).forEach(function(f) {
			if (!f.present) return;
			(f.fields || []).forEach(function(kv) { cfgRows.push([f.name, kv.key, kv.value]); });
		});
		if (cfgRows.length) {
			root.appendChild(section(_('配置文件内容（脱敏）'), table([_('文件'), _('键'), _('值')], cfgRows)));
		}

		root.appendChild(E('p', { 'class': 'alert-message notice' }, [
			_('写入仅限白名单键与白名单值，写入前创建快照，校验或服务重载失败自动回滚；拓扑查询只读使用 wappctrl。')
		]));
		return root;
	}
});
