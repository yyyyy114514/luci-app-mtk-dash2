'use strict';
'require view';
'require rpc';

var getStatus = rpc.declare({ object: 'map-easymesh', method: 'status' });
var getCaps = rpc.declare({ object: 'map-easymesh', method: 'capabilities' });
var setField = rpc.declare({ object: 'map-easymesh', method: 'set_field', params: ['field', 'value', 'reload'] });
var reloadSvc = rpc.declare({ object: 'map-easymesh', method: 'reload' });
var bhStatus = rpc.declare({ object: 'map-easymesh', method: 'bh_status' });
var bhScan = rpc.declare({ object: 'map-easymesh', method: 'bh_scan', params: ['iface'] });
var bhConnect = rpc.declare({ object: 'map-easymesh', method: 'bh_connect', params: ['iface', 'ssid', 'auth', 'enc', 'key'] });
var bhDisconn = rpc.declare({ object: 'map-easymesh', method: 'bh_disconnect', params: ['iface'] });
var pbcTrig = rpc.declare({ object: 'map-easymesh', method: 'pbc_trigger', params: ['iface'] });
var setBhType = rpc.declare({ object: 'map-easymesh', method: 'set_bh_type', params: ['type'] });
var wappVer = rpc.declare({ object: 'map-easymesh', method: 'wapp_version', params: ['iface'] });
var wappRld = rpc.declare({ object: 'map-easymesh', method: 'wapp_reload', params: ['iface'] });
var steerSta = rpc.declare({ object: 'map-easymesh', method: 'steer_sta', params: ['iface', 'mac'] });
var doReset = rpc.declare({ object: 'map-easymesh', method: 'reset', params: ['scope'] });

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

	fieldControl: function(id, st, writable, msgEl, meta) {
		if (!meta || !st || !st.present) return null;
		var input;
		if (meta.type === 'enum') {
			input = E('select', { 'class': 'cbi-input-select', style: 'min-width:220px' });
			(meta.options || []).forEach(function(o) {
				var opt = E('option', { 'value': o.value }, [o.label]);
				if (String(st.value) == o.value) opt.selected = true;
				input.appendChild(opt);
			});
		} else if (meta.secret) {
			input = E('input', { 'class': 'cbi-input-text', type: 'password', style: 'width:220px', maxlength: 63,
				placeholder: st.set ? _('已设置，留空不修改') : _('未设置') });
		} else if (meta.type === 'int') {
			input = E('input', { 'class': 'cbi-input-text', type: 'number', style: 'width:160px',
				min: meta.min, max: meta.max, value: st.value != null ? String(st.value) : '' });
		} else {
			input = E('input', { 'class': 'cbi-input-text', style: 'width:220px', maxlength: meta.len || 64,
				value: st.value != null ? String(st.value) : '' });
		}
		if (!writable) input.disabled = true;
		var btn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			if (meta.secret && !input.value) {
				window.alert(_('请输入新密钥；留空表示不修改。'));
				return;
			}
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
		}}, [meta.secret ? _('保存') : _('应用')]);
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

		/* device info: iface + wapp control */
		var devIface = caps.iface;
		var devMsg = E('div');
		var verBox = E('div');
		var verBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			if (!devIface) return;
			msg(devMsg, 'notice', _('正在读取 wapp 版本...'));
			wappVer(devIface).then(function(r) {
				if (!r || !r.ok) { msg(devMsg, 'error', (r && r.error) || _('操作失败')); return; }
				verBox.innerHTML = '';
				verBox.appendChild(table([_('项目'), _('版本')], [
					[_('wapp'), r.version || '-'],
					[_('hs'), r.hs_version || '-'],
					[_('drv'), r.drv_version || '-']
				]));
				msg(devMsg, 'success', _('版本信息已刷新'));
			}).catch(function(e) { msg(devMsg, 'error', String(e)); });
		}}, [_('读取 wapp 版本')]);
		var rldBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			if (!devIface) return;
			if (!window.confirm(_('确认重载 wapp 配置（%s）？无线连接会短暂中断。').format(devIface))) return;
			msg(devMsg, 'notice', _('正在重载 wapp ...'));
			wappRld(devIface).then(function(r) {
				if (r && r.ok) msg(devMsg, 'success', _('wapp 已重载'));
				else msg(devMsg, 'error', (r && r.error) || _('操作失败'));
			}).catch(function(e) { msg(devMsg, 'error', String(e)); });
		}}, [_('wapp reload')]);
		var pbcBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			if (!devIface) return;
			if (!window.confirm(_('确认在 %s 上触发 WPS PBC？请在两分钟内按下对端设备按钮。').format(devIface))) return;
			msg(devMsg, 'notice', _('正在触发 WPS PBC ...'));
			pbcTrig(devIface).then(function(r) {
				if (r && r.ok) msg(devMsg, 'success', _('WPS PBC 已触发'));
				else msg(devMsg, 'error', (r && r.error) || _('操作失败'));
			}).catch(function(e) { msg(devMsg, 'error', String(e)); });
		}}, [_('WPS PBC 触发')]);
		if (!devIface) { verBtn.disabled = true; rldBtn.disabled = true; pbcBtn.disabled = true; }
		root.appendChild(section(_('设备信息'),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('无线接口')]),
				E('div', { 'class': 'cbi-value-field' }, [ devIface ? E('code', {}, [devIface]) : E('span', { 'class': 'alert-message warning' }, [_('未探测到无线接口')]) ])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('wapp 控制')]),
				E('div', { 'class': 'cbi-value-field' }, [verBtn, ' ', rldBtn, ' ', pbcBtn])
			]),
			verBox,
			devMsg
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

		/* editable fields: groups + metadata come from the backend so the
		 * whitelist and the page can never drift apart */
		var fields = state.fields || {};
		var metaList = caps.fields_meta || [];
		var groups = caps.groups || [];
		var self = this;
		groups.forEach(function(gname) {
			var box = E('div');
			var count = 0;
			metaList.forEach(function(meta) {
				if (meta.group !== gname) return;
				var st = fields[meta.id];
				if (!st) return;
				var m = E('div');
				var ctl = self.fieldControl(meta.id, st, writable && wfields[meta.id] == true, m, meta);
				if (ctl) { box.appendChild(ctl); box.appendChild(m); count++; }
			});
			if (count > 0) root.appendChild(section(gname, box));
		});

		/* backhaul ops */
		var bhMsg = E('div');
		var bhStateBox = E('div');
		var scanBox = E('div');
		var bhIface = E('select', { 'class': 'cbi-input-select' });
		function addIfaceOpt(name) {
			if (!name) return;
			for (var i = 0; i < bhIface.options.length; i++)
				if (bhIface.options[i].value === name) return;
			bhIface.appendChild(E('option', { 'value': name }, [name]));
		}
		bhStatus().then(function(r) {
			if (!r || !r.ok) { msg(bhMsg, 'notice', _('未探测到回程接口（apcli*）。')); return; }
			var first = null;
			(r.backhauls || []).forEach(function(b) { addIfaceOpt(b.ifname); if (!first) first = b.ifname; });
			if (first) bhIface.value = first;
		}).catch(function() {});

		function doBhStatus() {
			msg(bhMsg, 'notice', _('正在读取回程状态...'));
			bhStatus().then(function(r) {
				if (!r || !r.ok) { msg(bhMsg, 'error', (r && r.error) || _('操作失败')); return; }
				var rows = (r.backhauls || []).map(function(b) {
					return [b.ifname, b.state === 'up' ? _('已连接') : _('未连接'), b.ssid || '-', b.bssid || '-', b.rssi != null ? String(b.rssi) : '-'];
				});
				bhStateBox.innerHTML = '';
				bhStateBox.appendChild(table([_('接口'), _('状态'), _('SSID'), _('BSSID'), _('RSSI')], rows));
				msg(bhMsg, 'success', _('回程状态已刷新'));
			}).catch(function(e) { msg(bhMsg, 'error', String(e)); });
		}

		function fillConnect(row) {
			connSsid.value = row.ssid || '';
			msg(bhMsg, 'notice', _('已填入 %s，请确认认证方式后点击"连接所选网络"。').format(row.ssid || row.bssid || '-'));
		}

		function doScan() {
			var iface = bhIface.value;
			if (!iface) { window.alert(_('请先选择回程接口。')); return; }
			msg(bhMsg, 'notice', _('正在扫描 %s 可用网络（约 4 秒）...').format(iface));
			scanBox.innerHTML = '';
			bhScan(iface).then(function(r) {
				if (!r || !r.ok) { msg(bhMsg, 'error', (r && r.error) || _('操作失败')); return; }
				if (!r.results || !r.results.length) { msg(bhMsg, 'notice', _('未扫描到可用网络。')); return; }
				msg(bhMsg, 'success', _('扫描完成，共 %d 个网络。').format(r.results.length));
				var t = E('table', { 'class': 'cbi-section-table' });
				t.appendChild(E('tr', {}, [_('信道'), _('SSID'), _('BSSID'), _('安全'), _('信号'), _('模式'), _('扩展信道'), _('WPS'), _('操作')].map(function(h) { return E('th', {}, [h]); })));
				r.results.forEach(function(b) {
					var btn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': (function(row) { return function(ev) { ev.preventDefault(); fillConnect(row); }; })(b) }, [_('连接')]);
					t.appendChild(E('tr', {}, [
						E('td', {}, [b.channel == null || b.channel === '' ? '-' : String(b.channel)]),
						E('td', {}, [b.ssid == null || b.ssid === '' ? '-' : String(b.ssid)]),
						E('td', {}, [b.bssid == null || b.bssid === '' ? '-' : String(b.bssid)]),
						E('td', {}, [b.security == null || b.security === '' ? '-' : String(b.security)]),
						E('td', {}, [b.rssi == null || b.rssi === '' ? '-' : String(b.rssi)]),
						E('td', {}, [b.mode == null || b.mode === '' ? '-' : String(b.mode)]),
						E('td', {}, [b.extch == null || b.extch === '' ? '-' : String(b.extch)]),
						E('td', {}, [b.wps == null || b.wps === '' ? '-' : String(b.wps)]),
						E('td', {}, [btn])
					]));
				});
				scanBox.appendChild(t);
			}).catch(function(e) { msg(bhMsg, 'error', String(e)); });
		}

		var connSsid = E('input', { 'class': 'cbi-input-text', style: 'width:220px', placeholder: _('点击扫描结果中的"连接"自动填入') });
		var connAuth = E('select', { 'class': 'cbi-input-select' });
		['OPEN', 'WPA2PSK', 'WPA3PSK', 'WPA2PSKWPA3PSK'].forEach(function(a) { connAuth.appendChild(E('option', { 'value': a }, [a])); });
		var connEnc = E('input', { 'class': 'cbi-input-text', style: 'width:100px', value: 'AES' });
		var connKey = E('input', { 'class': 'cbi-input-text', type: 'password', style: 'width:200px', placeholder: _('可留空表示不修改') });
		var connectBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			var iface = bhIface.value;
			var ssid = connSsid.value.trim();
			if (!iface) { window.alert(_('请先选择回程接口。')); return; }
			if (!ssid) { window.alert(_('请先填写 SSID（可点击扫描结果中的"连接"自动填入）。')); return; }
			var auth = connAuth.value;
			var enc = auth === 'OPEN' ? '' : (connEnc.value.trim() || 'AES');
			var key = auth === 'OPEN' ? '' : connKey.value;
			if (auth !== 'OPEN' && !key) { window.alert(_('请输入 WPA 密钥。')); return; }
			if (!window.confirm(_('确认将 %s 连接到 %s（认证 %s）？').format(iface, ssid, auth))) return;
			msg(bhMsg, 'notice', _('正在连接 %s ...').format(ssid));
			bhConnect(iface, ssid, auth, enc, key).then(function(r) {
				if (r && r.ok) msg(bhMsg, 'success', _('已发起连接：%s（认证 %s，已持久化）。').format(r.ssid || ssid, r.auth || auth));
				else msg(bhMsg, 'error', (r && r.error) || _('操作失败'));
			}).catch(function(e) { msg(bhMsg, 'error', String(e)); });
		}}, [_('连接所选网络')]);

		var stBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) { ev.preventDefault(); doBhStatus(); } }, [_('回程状态')]);
		var scanBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) { ev.preventDefault(); doScan(); } }, [_('扫描可用网络')]);
		var disconnBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			var iface = bhIface.value;
			if (!iface) { window.alert(_('请先选择回程接口。')); return; }
			if (!window.confirm(_('确认断开回程 %s？').format(iface))) return;
			msg(bhMsg, 'notice', _('正在断开 %s ...').format(iface));
			bhDisconn(iface).then(function(r) {
				if (r && r.ok) msg(bhMsg, 'success', _('已断开回程 %s。').format(iface));
				else msg(bhMsg, 'error', (r && r.error) || _('操作失败'));
			}).catch(function(e) { msg(bhMsg, 'error', String(e)); });
		}}, [_('断开回程')]);

		var bhTypeSel = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'eth' }, [_('以太网优先')]),
			E('option', { 'value': 'wifi' }, [_('无线回程')])
		]);
		var curBh = state.fields && state.fields.backhaul && state.fields.backhaul.value;
		if (curBh) bhTypeSel.value = String(curBh);
		var bhTypeBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			var type = bhTypeSel.value;
			if (!window.confirm(_('确认将回程类型切换为%s？组网可能短暂中断。').format(type === 'eth' ? _('以太网优先') : _('无线回程')))) return;
			msg(bhMsg, 'notice', _('正在切换回程类型...'));
			setBhType(type).then(function(r) {
				if (r && r.ok) {
					msg(bhMsg, 'success', _('回程类型已切换，页面即将刷新。'));
					setTimeout(function() { window.location.reload(); }, 1200);
				} else {
					msg(bhMsg, 'error', (r && r.error) || _('操作失败'));
				}
			}).catch(function(e) { msg(bhMsg, 'error', String(e)); });
		}}, [_('应用回程类型')]);

		root.appendChild(section(_('回程操作'),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('回程接口')]),
				E('div', { 'class': 'cbi-value-field' }, [bhIface, ' ', stBtn, ' ', scanBtn])
			]),
			bhStateBox,
			scanBox,
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('连接网络')]),
				E('div', { 'class': 'cbi-value-field' }, [connSsid])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('认证与密钥')]),
				E('div', { 'class': 'cbi-value-field' }, [connAuth, ' ', E('label', {}, [_('加密：')]), connEnc, ' ', E('label', {}, [_('密钥：')]), connKey, ' ', connectBtn])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('断开回程')]),
				E('div', { 'class': 'cbi-value-field' }, [disconnBtn])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('回程类型')]),
				E('div', { 'class': 'cbi-value-field' }, [bhTypeSel, ' ', bhTypeBtn])
			]),
			bhMsg
		));

		/* ops: steer_sta + group reset */
		var opMsg = E('div');
		var steerIface = E('select', { 'class': 'cbi-input-select' });
		steerIface.appendChild(E('option', { 'value': '' }, [_('自动（首个无线接口）')]));
		if (devIface) steerIface.appendChild(E('option', { 'value': devIface }, [devIface]));
		var steerMac = E('input', { 'class': 'cbi-input-text', style: 'width:220px', placeholder: 'AA:BB:CC:DD:EE:FF' });
		var steerBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			var mac = steerMac.value.trim();
			if (!mac) { window.alert(_('请输入 STA MAC 地址。')); return; }
			if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac)) { window.alert(_('MAC 地址格式应为 AA:BB:CC:DD:EE:FF。')); return; }
			if (!window.confirm(_('确认引导 STA %s 在接口 %s 上漫游？').format(mac, steerIface.value))) return;
			msg(opMsg, 'notice', _('正在发送 steer_sta 指令...'));
			steerSta(steerIface.value, mac).then(function(r) {
				if (r && r.ok) msg(opMsg, 'success', _('steer_sta 指令已发送。'));
				else msg(opMsg, 'error', (r && r.error) || _('操作失败'));
			}).catch(function(e) { msg(opMsg, 'error', String(e)); });
		}}, [_('发送引导')]);

		var resetSel = E('select', { 'class': 'cbi-input-select' });
		['角色与回程', '回程配置 (BhProfile)', '回程优先级', '漫游与引导', '信道规划', '网络优化', '设备信息', '其他 MAP 参数', '1905d 链路配置', '运行模式', '流量分离 (Traffic Separation)', 'Hotspot 2.0 (Passpoint)', 'all'].forEach(function(s) {
			resetSel.appendChild(E('option', { 'value': s }, [s === 'all' ? _('全部重置 (all)') : _(s)]));
		});
		var resetBtn = E('button', { 'class': 'cbi-button cbi-button-negative', 'click': function(ev) {
			ev.preventDefault();
			var scope = resetSel.value;
			if (!window.confirm(_('确认将「%s」恢复为默认值？所有相关配置将被覆盖并重载 MAP 服务，此操作不可撤销。').format(scope === 'all' ? _('全部配置') : scope))) return;
			msg(opMsg, 'notice', _('正在执行重置...'));
			doReset(scope).then(function(r) {
				if (r && r.ok) {
					msg(opMsg, 'success', _('重置完成，页面即将刷新。'));
					setTimeout(function() { window.location.reload(); }, 1200);
				} else {
					msg(opMsg, 'error', ((r && r.error) || _('重置失败')) + (r && r.rollback ? _('（已回滚）') : ''));
				}
			}).catch(function(e) { msg(opMsg, 'error', String(e)); });
		}}, [_('执行重置')]);

		root.appendChild(section(_('操作'),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('引导 STA 漫游 (steer_sta)')]),
				E('div', { 'class': 'cbi-value-field' }, [steerIface, ' ', steerMac, ' ', steerBtn])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', style: 'min-width:260px' }, [_('分组重置')]),
				E('div', { 'class': 'cbi-value-field' }, [resetSel, ' ', resetBtn])
			]),
			opMsg
		));

		doBhStatus();

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
