'use strict';
'require view';
'require rpc';

var getStatus = rpc.declare({ object: 'map-easymesh', method: 'status' });
var getCaps = rpc.declare({ object: 'map-easymesh', method: 'capabilities' });
var setField = rpc.declare({ object: 'map-easymesh', method: 'set_field', params: ['field', 'value', 'reload'] });
var setBhType = rpc.declare({ object: 'map-easymesh', method: 'set_bh_type', params: ['type'] });
var bhStatus = rpc.declare({ object: 'map-easymesh', method: 'bh_status' });
var bhScan = rpc.declare({ object: 'map-easymesh', method: 'bh_scan', params: ['iface'] });
var bhConnect = rpc.declare({ object: 'map-easymesh', method: 'bh_connect', params: ['iface', 'ssid', 'auth', 'enc', 'key'] });
var reloadSvc = rpc.declare({ object: 'map-easymesh', method: 'reload' });
var getWappDiag = rpc.declare({ object: 'map-easymesh', method: 'wapp_diag' });
var enableWapp = rpc.declare({ object: 'map-easymesh', method: 'wapp_enable' });

var ROLE_OPTS = [
	['0', _('Agent（被管理节点）')],
	['1', _('Controller（控制器）')],
	['2', _('Controller + Agent（控制器兼节点）')]
];
var AUTH_OPTS = [
	['OPEN', 'OPEN'],
	['WPAPSK', 'WPAPSK'],
	['WPA2PSK', 'WPA2PSK'],
	['WPA3PSK', 'WPA3PSK'],
	['WPAPSKWPA2PSK', 'WPAPSK/WPA2PSK'],
	['WPA2PSKWPA3PSK', 'WPA2PSK/WPA3PSK']
];
var MODE_OPTS = [['0', '0'], ['1', '1'], ['2', '2']];
var SWITCH_FIELDS = [
	{ id: 'steer', label: '频段引导 (Steering)' },
	{ id: 'central_steer', label: '集中式引导' },
	{ id: 'ap_steer_rssi', label: 'AP 引导 RSSI 阈值', type: 'int', min: -100, max: 0 },
	{ id: 'ch_plan', label: '信道规划' },
	{ id: 'quick_ch', label: '快速信道切换' },
	{ id: 'netopt', label: '网络优化' },
	{ id: 'auto_bh', label: '自动回程切换' },
	{ id: 'non_map_ap', label: '非 MAP AP 兼容' },
	{ id: 'dhcp_ctl', label: 'DHCP 控制' },
	{ id: 'mode', label: '运行模式', opts: MODE_OPTS }
];
var ETH_FIELDS = [
	{ id: 'br_inf', label: '桥接接口 (br_inf)' },
	{ id: 'al_inf', label: 'AL 接口 (al_inf)' },
	{ id: 'eth_dev_name', label: '以太网设备名 (高级)' },
	{ id: 'ob_wan_only', label: '仅 WAN 口以太网上线', type: 'switch' },
	{ id: 'lan_if', label: 'LAN 接口' },
	{ id: 'wan_if', label: 'WAN 接口' }
];

function section(title) {
	var el = E('div', { 'class': 'cbi-section' }, [E('h3', {}, [title])]);
	for (var i = 1; i < arguments.length; i++) el.appendChild(arguments[i]);
	return el;
}

function fieldRow(label) {
	var fields = Array.prototype.slice.call(arguments, 1);
	var children = [];
	fields.forEach(function(f, i) {
		if (i) children.push(' ');
		children.push(f);
	});
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title', style: 'min-width:150px' }, [label]),
		E('div', { 'class': 'cbi-value-field' }, children)
	]);
}

function textInput(value, width, ph) {
	var attrs = { 'class': 'cbi-input-text', style: 'width:' + (width || 160) + 'px' };
	if (value != null && value !== '') attrs.value = String(value);
	if (ph) attrs.placeholder = ph;
	return E('input', attrs);
}

function sel(options, cur) {
	var s = E('select', { 'class': 'cbi-input-select', style: 'min-width:110px' });
	options.forEach(function(o) {
		var opt = E('option', { value: String(o[0]) }, [String(o[1] != null ? o[1] : o[0])]);
		if (String(cur) == String(o[0])) opt.selected = true;
		s.appendChild(opt);
	});
	return s;
}

function tbl(headers, rows) {
	var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, headers.map(function(h) { return E('th', {}, [h]); }))]);
	rows.forEach(function(r) { t.appendChild(E('tr', {}, r.map(function(c) { return E('td', {}, [c == null || c === '' ? '-' : String(c)]); }))); });
	return t;
}

function msg(el, cls, text) {
	el.innerHTML = '';
	el.appendChild(E('p', { 'class': 'alert-message ' + cls }, [text]));
}

function appendLine(pre, text) {
	var p = E('pre', { 'style': 'white-space:pre-wrap;word-break:break-all;margin:2px 0' }, [text]);
	pre.appendChild(p);
	pre.scrollTop = pre.scrollHeight;
}

return view.extend({
	load: function() {
		return Promise.all([
			getStatus(),
			getCaps(),
			bhStatus(),
			getWappDiag().catch(function() { return { unavailable: true }; })
		]);
	},

	render: function(data) {
		var st = data[0] || {}, caps = data[1] || {}, bh = data[2] || {}, wd = data[3] || {};
		var fields = st.fields || {};
		var svcs = caps.services || {};
		var root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('EasyMesh 设置向导')]));
		root.appendChild(E('p', {}, [_('分步完成 EasyMesh 组网：环境检查 → 角色 → 回程（有线/无线） → 关键参数 → 应用。所有写入均有二次确认，失败自动回滚。')]));

		var steps = [];
		var nav = E('div', { 'class': 'cbi-page-actions', 'style': 'margin-top:16px' }, []);
		var cur = 0;
		function showStep(i) {
			if (i < 0 || i >= steps.length) return;
			cur = i;
			steps.forEach(function(s, k) { s.el.style.display = (k === i) ? '' : 'none'; });
			var backBtn = nav.querySelector('.wz-back');
			var nextBtn = nav.querySelector('.wz-next');
			var applyBtn = nav.querySelector('.wz-apply');
			if (backBtn) backBtn.style.display = i === 0 ? 'none' : '';
			if (applyBtn) applyBtn.style.display = i === steps.length - 1 ? '' : 'none';
			if (nextBtn) nextBtn.style.display = i === steps.length - 1 ? 'none' : '';
		}
		function makeNav(step) {
			var bar = E('div', { 'class': 'cbi-value-field' }, []);
			if (step > 0) bar.appendChild(E('button', { 'class': 'cbi-button wz-back', 'click': function(ev) { ev.preventDefault(); showStep(step - 1); } }, [_('上一步')]));
			bar.appendChild(E('button', { 'class': 'cbi-button cbi-button-action wz-next', 'click': function(ev) { ev.preventDefault(); showStep(step + 1); } }, [_('下一步')]));
			return bar;
		}

		/* ---------- Step 1: 环境检查 ---------- */
		(function() {
			var rows = [
				[_('wappctrl 命令'), caps.wappctrl ? _('可用') : _('不可用（缺少 MAP 组件）')],
				[_('无线接口'), caps.iface ? String(caps.iface) : _('未探测到')],
				[_('MAP 配置文件'), caps.config_present ? _('存在 (mapd_cfg/1905d.cfg)') : _('缺失')],
				[_('/etc/map 可写'), caps.writable ? _('是') : _('否')],
				[_('当前角色'), st.role || _('未知')],
				[_('MAP 版本'), st.map_ver || '-'],
				[_('Controller ALID'), (st.fields && st.fields.ctrl_alid && st.fields.ctrl_alid.value) || '-'],
				[_('Agent ALID'), (st.fields && st.fields.agent_alid && st.fields.agent_alid.value) || '-'],
				[_('拓扑节点'), st.nodes ? String((st.nodes || []).length) : '-'],
				[_('回程链路'), st.backhaul_links ? String((st.backhaul_links || []).length) : '-']
			];
			var wappReasons = [];
			var wappOut = E('pre', { 'style': 'white-space:pre-wrap;word-break:break-all;max-height:220px;overflow:auto' }, []);
			var wappReady = wd && !wd.unavailable && wd.ok;
			if (wappReady) {
				rows.push([_('wapp 二进制'), wd.wapp_bin || _('缺失')]);
				rows.push([_('wapp 进程'), wd.wapp_running ? _('运行中') : _('未运行')]);
				rows.push([_('wapp 控制套接字'), wd.wapp_ctrl_socket ? _('存在') : _('不存在')]);
				rows.push([_('wapp 开关 (wapp=1)'), wd.switch_on ? _('已开启') : _('未开启')]);
				rows.push([_('ra0 启动判定'), wd.ra0 ? _('满足') : _('不满足')]);
				rows.push([_('rax0 启动判定'), wd.rax0 ? _('满足') : _('不满足')]);
				(wd.devices || []).forEach(function(d) {
					rows.push([_('无线设备 %s').format(d.section), 'wapp=' + d.wapp + ', bandsteering=' + d.bandsteering + ', ieee80211r=' + d.ieee80211r + ', disabled=' + d.disabled]);
				});
				(wd.reasons || []).forEach(function(r) { wappReasons.push(_('wapp 启动条件：%s').format(r)); });
				if (!wd.can_start) wappReasons.push(_('wapp 启动前置条件未满足，可使用下方按钮自动设置并启动。'));
			} else if (wd && wd.unavailable) {
				wappReasons.push(_('当前后端不支持 wapp 诊断，请升级插件后端。'));
			}
			Object.keys(svcs).forEach(function(s) {
				var v = svcs[s] || {};
				var txt = v.status === 'running' ? _('运行中') : (v.status === 'stopped' ? _('已停止') : (v.status === 'disabled' ? _('未启用') : (v.status === 'config' ? _('配置就绪') : _('缺失'))));
				rows.push([_('服务 %s').format(s), txt]);
			});
			var warns = [];
			if (!caps.wappctrl) warns.push(_('wappctrl 不可用：无线回程与 DPP 入网不可用，建议安装 mtwifi-wapp。'));
			if (!caps.iface) warns.push(_('未探测到无线接口：无线回程不可用。'));
			if (!caps.config_present) warns.push(_('MAP 配置文件缺失：向导无法写入，请先确认固件已安装 MAP 组件。'));
			if (!caps.writable) warns.push(_('/etc/map 不可写：所有写入将被拒绝。'));

			var panel = E('div', { 'class': 'cbi-section' });
			panel.appendChild(E('h3', {}, [_('① 环境检查')]));
			panel.appendChild(tbl([_('检查项'), _('结果')], rows));
			warns.forEach(function(w) { panel.appendChild(E('p', { 'class': 'alert-message warning' }, [w])); });
			wappReasons.forEach(function(w) { panel.appendChild(E('p', { 'class': 'alert-message warning' }, [w])); });
			if (wappReady) {
				var enableBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
					ev.preventDefault();
					if (!window.confirm(_('确认启用 wapp 并启动服务？将设置 wapp=1，必要时开启 bandsteering，并执行 startwapp.sh。'))) return;
					wappOut.innerHTML = '';
					enableBtn.disabled = true;
					enableWapp().then(function(r) {
						(r.results || []).forEach(function(item) {
							appendLine(wappOut, (item.ok ? '[OK] ' : '[FAIL] ') + item.command + (item.output ? ' :: ' + item.output : ''));
						});
						(r.warnings || []).forEach(function(w) { appendLine(wappOut, _('警告：%s').format(w)); });
						if (r.error) appendLine(wappOut, _('错误：%s').format(r.error));
						if (r.note) appendLine(wappOut, r.note);
						if (r.diag) appendLine(wappOut, _('wapp 进程：%s；控制套接字：%s').format(r.diag.wapp_running ? _('运行中') : _('未运行'), r.diag.wapp_ctrl_socket ? _('存在') : _('不存在')));
						if (r.ok) appendLine(wappOut, _('wapp 启用流程已完成。'));
						enableBtn.disabled = false;
					}).catch(function(e) {
						appendLine(wappOut, _('调用失败：%s').format(String(e)));
						enableBtn.disabled = false;
					});
				} }, [_('一键启用 wapp')]);
				panel.appendChild(fieldRow(_('wapp 服务'), enableBtn));
				panel.appendChild(wappOut);
			}
			panel.appendChild(makeNav(0));
			steps.push({ el: panel });
			root.appendChild(panel);
		})();

		/* ---------- Step 2: 角色 ---------- */
		var roleSel;
		(function() {
			roleSel = sel(ROLE_OPTS, fields.role ? fields.role.value : '1');
			var panel = E('div', { 'class': 'cbi-section' });
			panel.appendChild(E('h3', {}, [_('② 选择设备角色')]));
			panel.appendChild(E('p', { 'class': 'alert-message notice' }, [
				_('Controller 负责整网管理与漫游决策；Agent 是被管理的接入节点；Controller + Agent 既管理整网又提供接入。')
			]));
			panel.appendChild(fieldRow(_('设备角色'), roleSel));
			panel.appendChild(makeNav(1));
			steps.push({ el: panel });
			root.appendChild(panel);
		})();

		/* ---------- Step 3: 回程类型 ---------- */
		var bhTypeRadio, ethInputs = {}, wifiIface, wifiRows, wifiSel, connSsid, connAuth, connEnc, connKey, bhOut, scanOut;
		(function() {
			var panel = E('div', { 'class': 'cbi-section' });
			panel.appendChild(E('h3', {}, [_('③ 选择回程类型')]));
			panel.appendChild(E('p', {}, [_('有线回程：以太网直接互联，稳定性最好；无线回程：通过 WiFi 与对端控制器互联，免布线。')]));

			bhTypeRadio = E('input', { 'type': 'radio', 'name': 'bhtype', 'id': 'bh-eth', 'checked': 'checked' });
			var ethLabel = E('label', { 'for': 'bh-eth' }, [_('有线（以太网优先）')]);
			var wifiRadio = E('input', { 'type': 'radio', 'name': 'bhtype', 'id': 'bh-wifi' });
			var wifiLabel = E('label', { 'for': 'bh-wifi' }, [_('无线（WiFi 回程）')]);
			panel.appendChild(fieldRow(_('回程方式'), bhTypeRadio, ethLabel, ' ', wifiRadio, wifiLabel));

			var ethPanel = E('div', { 'id': 'eth-panel' });
			ETH_FIELDS.forEach(function(f) {
				var v = fields[f.id] ? fields[f.id].value : '';
				var input;
				if (f.type === 'switch') input = sel([['1', _('启用')], ['0', _('禁用')]], v == null || v === '' ? '0' : v);
				else input = textInput(v, 190);
				ethInputs[f.id] = input;
				ethPanel.appendChild(fieldRow(f.label, input));
			});
			panel.appendChild(ethPanel);

			var wifiPanel = E('div', { 'id': 'wifi-panel', 'style': 'display:none' });
			var backhauls = bh.backhauls || [];
			var opts = backhauls.map(function(b) { return [b.ifname, b.ifname + (b.state === 'up' ? ' (' + (b.ssid || '') + ')' : '')]; });
			if (!opts.length) opts.push([caps.iface || '', caps.iface || _('默认接口')]);
			wifiIface = sel(opts, opts[0][0]);
			bhOut = E('pre', { 'style': 'max-height:160px;overflow:auto' }, []);
			scanOut = E('div', {});
			connSsid = textInput('', 170);
			connAuth = sel(AUTH_OPTS, 'WPA2PSK');
			connEnc = textInput('AES', 70);
			connKey = E('input', { 'class': 'cbi-input-text', 'type': 'password', 'style': 'width:150px', 'maxlength': 63 });
			var scanBtn = E('button', { 'class': 'cbi-button', 'click': function(ev) {
				ev.preventDefault();
				if (!window.confirm(_('确认扫描 %s 周边无线网络？扫描会短暂占用射频。').format(String(wifiIface.value)))) return;
				scanOut.innerHTML = '';
				bhScan(String(wifiIface.value)).then(function(r) {
					if (!r || !r.ok) { msg(scanOut, 'error', r && r.error ? String(r.error) : _('扫描失败')); return; }
					wifiRows = r.results || [];
					if (!wifiRows.length) { msg(scanOut, 'warning', _('未扫描到可用网络，请稍后重试或检查接口。')); return; }
					var t = E('table', { 'class': 'cbi-section-table' }, [
						E('tr', {}, [E('th', {}, [_('信道')]), E('th', {}, [_('SSID')]), E('th', {}, [_('BSSID')]), E('th', {}, [_('安全')]), E('th', {}, [_('信号')]), E('th', {}, [_('模式')]), E('th', {}, [_('WPS')])])
					]);
					wifiRows.forEach(function(n) {
						var tr = E('tr', {}, [n.channel, n.ssid, n.bssid, n.security, n.rssi, n.mode, n.wps].map(function(c) { return E('td', {}, [c == null || c === '' ? '-' : String(c)]); }));
						tr.style.cursor = 'pointer';
						tr.addEventListener('click', function() {
							if (!n.ssid) return;
							if (!window.confirm(_('选中网络：%s，确认使用该 SSID 作为回程目标？').format(String(n.ssid)))) return;
							connSsid.value = String(n.ssid);
						});
						t.appendChild(tr);
					});
					scanOut.appendChild(t);
				}).catch(function(e) { msg(scanOut, 'error', _('RPC 失败: ') + String(e)); });
			} }, [_('扫描')]);
			wifiPanel.appendChild(fieldRow(_('回程接口'), wifiIface, scanBtn));
			wifiPanel.appendChild(section(_('扫描结果（点击选择）'), scanOut));
			var connBtn = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
				ev.preventDefault();
				var auth = String(connAuth.value);
				var key = String(connKey.value);
				if (!String(connSsid.value).trim()) { window.alert(_('请输入回程 SSID。')); return; }
				if (auth !== 'OPEN' && (!key || key.length < 8)) { window.alert(_('加密模式需要 8-63 位回程密钥。')); return; }
				if (!window.confirm(_('确认将 %s 连接到 %s（认证 %s）？将写入回程配置并应用。').format(String(wifiIface.value), String(connSsid.value).trim(), auth))) return;
				bhConnect(String(wifiIface.value), String(connSsid.value).trim(), auth, String(connEnc.value).trim() || 'AES', key)
					.then(function(r) {
						bhOut.innerHTML = '';
						appendLine(bhOut, JSON.stringify(r, null, 2));
					}).catch(function(e) { msg(bhOut, 'error', _('RPC 失败: ') + String(e)); });
			} }, [_('连接')]);
			wifiPanel.appendChild(fieldRow(_('SSID'), connSsid));
			wifiPanel.appendChild(fieldRow(_('认证方式'), connAuth));
			wifiPanel.appendChild(fieldRow(_('加密类型'), connEnc, _('密钥'), connKey, connBtn));
			wifiPanel.appendChild(fieldRow(_('连接结果'), bhOut));
			panel.appendChild(wifiPanel);

			function syncBhPanels() {
				var wifi = String(document.querySelector('input[name=bhtype]:checked').id) === 'bh-wifi';
				ethPanel.style.display = wifi ? 'none' : '';
				wifiPanel.style.display = wifi ? '' : 'none';
			}
			bhTypeRadio.addEventListener('change', syncBhPanels);
			wifiRadio.addEventListener('change', syncBhPanels);
			panel.appendChild(makeNav(2));
			steps.push({ el: panel });
			root.appendChild(panel);
		})();

		/* ---------- Step 4: 关键参数 ---------- */
		var paramInputs = {};
		(function() {
			var panel = E('div', { 'class': 'cbi-section' });
			panel.appendChild(E('h3', {}, [_('④ 关键参数')]));
			panel.appendChild(E('p', {}, [_('以下为 EasyMesh 常用参数，均已预填当前值。更完整的参数请到「MAP EasyMesh」页按 12 个分组配置。')]));
			SWITCH_FIELDS.forEach(function(f) {
				var v = fields[f.id] ? fields[f.id].value : '';
				var input;
				if (f.opts) input = sel(f.opts, v == null || v === '' ? '0' : v);
				else if (f.type === 'int') input = textInput(v == null || v === '' ? '' : String(v), 120, String(f.min) + ' ~ ' + String(f.max));
				else input = sel([['1', _('启用')], ['0', _('禁用')]], v == null || v === '' ? '0' : v);
				paramInputs[f.id] = input;
				panel.appendChild(fieldRow(f.label, input));
			});
			panel.appendChild(makeNav(3));
			steps.push({ el: panel });
			root.appendChild(panel);
		})();

		/* ---------- Step 5: 汇总应用 ---------- */
		(function() {
			var panel = E('div', { 'class': 'cbi-section' });
			panel.appendChild(E('h3', {}, [_('⑤ 汇总与应用')]));
			var sumOut = E('pre', { 'style': 'max-height:420px;overflow:auto' }, []);
			function summaryRows() {
				var rows = [[_('设备角色'), String(roleSel.value) + ' (' + ROLE_OPTS.filter(function(o) { return String(o[0]) == String(roleSel.value); })[0][1] + ')']];
				var bhWifi = String(document.querySelector('input[name=bhtype]:checked').id) === 'bh-wifi';
				rows.push([_('回程方式'), bhWifi ? _('无线（WiFi 回程）') : _('有线（以太网优先）')]);
				SWITCH_FIELDS.forEach(function(f) {
					var input = paramInputs[f.id];
					var v = String(input.value || '');
					var label = v === '1' ? _('启用') : (v === '0' ? _('禁用') : v);
					rows.push([f.label, label]);
				});
				if (!bhWifi) {
					ETH_FIELDS.forEach(function(f) {
						var input = ethInputs[f.id];
						var v = String(input.value || '');
						rows.push([f.label, v === '' ? _('（不修改）') : v]);
					});
				} else {
					rows.push([_('无线回程目标'), String(connSsid.value || '') || _('（未连接）')]);
				}
				return rows;
			}
			function refreshSummary() {
				var t = tbl([_('配置项'), _('应用值')], summaryRows());
				sumOut.innerHTML = '';
				sumOut.appendChild(t);
			}
			panel.appendChild(section(_('将要应用的内容'), sumOut,
				E('button', { 'class': 'cbi-button', 'click': function(ev) { ev.preventDefault(); refreshSummary(); } }, [_('刷新预览')])
			));
			var runOut = E('pre', { 'style': 'max-height:360px;overflow:auto' }, []);
			function appendRes(r) {
				if (!r || !r.ok) appendLine(runOut, '✗ ' + (r && r.error ? String(r.error) : JSON.stringify(r)));
				else appendLine(runOut, '✓ ' + JSON.stringify(r));
			}
			function apply() {
				if (!caps.writable || !caps.config_present) { window.alert(_('环境不满足（配置缺失或不可写），无法应用。请回到第①步检查。')); return; }
				if (!window.confirm(_('确认应用以上全部 EasyMesh 配置？无线可能短暂中断，失败自动回滚。'))) return;
				runOut.innerHTML = '';
				var tasks = [];
				tasks.push(function() { return setField('role', String(roleSel.value), false); });
				SWITCH_FIELDS.forEach(function(f) {
					var v = String(paramInputs[f.id].value || '');
					if (f.type === 'int') v = String(Number(v) || 0);
					tasks.push(function() { return setField(f.id, v, false); });
				});
				var bhWifi = String(document.querySelector('input[name=bhtype]:checked').id) === 'bh-wifi';
				if (!bhWifi) {
					tasks.push(function() { return setBhType('eth'); });
					ETH_FIELDS.forEach(function(f) {
						var v = String(ethInputs[f.id].value || '').trim();
						if (v === '') return;
						tasks.push(function() { return setField(f.id, v, false); });
					});
				} else {
					tasks.push(function() { return setBhType('wifi'); });
				}
				tasks.push(function() { return reloadSvc(); });
				tasks.push(function() {
					return getStatus().then(function(s) {
						return { ok: true, verify_role: s && s.role, verify_nodes: s ? String((s.nodes || []).length) : '-', note: 'reload 后状态复核' };
					});
				});
				var i = 0;
				(function next() {
					if (i >= tasks.length) return;
					var t = tasks[i++];
					t().then(function(r) {
						appendRes(r || { ok: false, error: '空响应' });
						next();
					}).catch(function(e) { appendLine(runOut, '✗ RPC 失败: ' + String(e)); next(); });
				})();
			}
			panel.appendChild(section(_('执行日志'),
				E('div', { 'class': 'cbi-value-field' }, [
					E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) { ev.preventDefault(); apply(); } }, [_('应用全部配置')])
				]),
				runOut
			));
			panel.appendChild(makeNav(4));
			steps.push({ el: panel });
			root.appendChild(panel);
		})();

		nav.appendChild(E('span', {}, [_('步骤 ') + String(cur + 1) + '/' + String(steps.length)]));
		root.appendChild(nav);
		showStep(0);
		return root;
	},

	handleSaveApply: null
});
