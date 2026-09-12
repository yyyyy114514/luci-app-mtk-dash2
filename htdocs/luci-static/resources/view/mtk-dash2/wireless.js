'use strict';
'require view';
'require rpc';

var getConfig = rpc.declare({ object: 'mtk-dash2', method: 'get_wireless_config' });
var getStatus = rpc.declare({ object: 'mtk-dash2', method: 'status' });
var getCaps = rpc.declare({ object: 'mtk-dash2', method: 'capabilities' });
var updateDevice = rpc.declare({ object: 'mtk-dash2', method: 'update_device', params: ['device', 'values', 'apply'] });
var updateVif = rpc.declare({ object: 'mtk-dash2', method: 'update_vif', params: ['iface', 'values', 'apply'] });
var addVif = rpc.declare({ object: 'mtk-dash2', method: 'add_vif', params: ['device', 'mode', 'ssid', 'encryption', 'key', 'network', 'bssid', 'apply'] });
var deleteVif = rpc.declare({ object: 'mtk-dash2', method: 'delete_vif', params: ['iface', 'apply'] });
var setRadio = rpc.declare({ object: 'mtk-dash2', method: 'set_radio', params: ['device', 'enabled', 'apply'] });
var scan = rpc.declare({ object: 'mtk-dash2', method: 'scan', params: ['iface'] });
var applyAll = rpc.declare({ object: 'mtk-dash2', method: 'apply_wireless' });

var ENCS = ['none', 'psk2+ccmp', 'psk2+tkip+ccmp', 'psk-mixed', 'sae', 'sae-mixed', 'owe', 'psk2', 'psk', 'psk-mixed+ccmp'];
var HTMODES = ['HT20', 'HT40', 'VHT20', 'VHT40', 'VHT80', 'VHT160', 'HE20', 'HE40', 'HE80', 'HE160'];
var COUNTRY_LIST = ['DB', 'AE', 'AL', 'AR', 'AT', 'AM', 'AU', 'AZ', 'BE', 'BH', 'BY', 'BO', 'BR', 'BN', 'BG', 'BZ', 'CA', 'CH', 'CL', 'CN', 'CO', 'CR', 'CY', 'CZ', 'DE', 'DK', 'DO', 'DZ', 'EC', 'EG', 'EE', 'ES', 'FI', 'FR', 'GE', 'GB', 'GR', 'GT', 'HN', 'HK', 'HU', 'HR', 'IS', 'IN', 'ID', 'IR', 'IE', 'IL', 'IT', 'JP', 'JO', 'KP', 'KR', 'KW', 'KZ', 'LB', 'LI', 'LT', 'LU', 'LV', 'MA', 'MC', 'MO', 'MK', 'MX', 'MY', 'NL', 'NO', 'NZ', 'OM', 'PA', 'PE', 'PH', 'PL', 'PK', 'PT', 'PR', 'QA', 'RO', 'RU', 'SA', 'SG', 'SK', 'SI', 'SV', 'SE', 'SY', 'TH', 'TN', 'TR', 'TT', 'TW', 'UA', 'US', 'UY', 'UZ', 'VE', 'VN', 'YE', 'ZA', 'ZW'];

function select(options, current) {
	var s = E('select', { 'class': 'cbi-input-select' });
	options.forEach(function(o) {
		var v = String(o);
		var opt = E('option', { value: v }, [v]);
		if (v === String(current == null ? '' : current)) opt.selected = true;
		s.appendChild(opt);
	});
	return s;
}
/* keep the live value even when it is not in the preset list, so saving
 * unrelated fields can never silently overwrite encryption/htmode/etc. */
function selectLive(options, current) {
	var v = String(current == null ? '' : current);
	var s = select(options, v);
	if (v !== '' && options.indexOf(v) < 0) {
		var opt = E('option', { value: v }, [v + _('（当前）')]);
		opt.selected = true;
		s.appendChild(opt);
	}
	return s;
}
function thRow(cells) {
	return E('tr', {}, cells.map(function(h) { return E('th', {}, [h]); }));
}
function textInput(value, extra) {
	var attrs = { 'class': 'cbi-input-text' };
	if (value != null) attrs.value = String(value);
	Object.keys(extra || {}).forEach(function(k) { attrs[k] = extra[k]; });
	return E('input', attrs);
}
function outBox() { return E('pre', {}, []); }
function setOut(out, r) { out.textContent = JSON.stringify(r || {}, null, 2); }

return view.extend({
	load: function() { return Promise.all([getConfig(), getStatus(), getCaps()]); },
	render: function(data) {
		var conf = data[0] || {}, st = data[1] || {}, caps = data[2] || {}, tools = caps.tools || {};
		var devices = conf.devices || [], ifaces = conf.ifaces || [];
		var canW = !!(tools.uci && tools.wifi);
		var root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('无线配置')]));
		root.appendChild(E('p', {}, [_('已接入 netifd/mtwifi-cfg 的真实配置路径；写入后提交、应用并复核，失败自动回滚。')]));

		var out1 = outBox();
		var dt = E('table', { 'class': 'cbi-section-table' }, [thRow([_('设备'), _('信道'), _('频宽'), _('发射功率(%)'), _('国家'), _('状态'), _('操作')])]);
		devices.forEach(function(d) {
			var dis = String(d.disabled) === '1' || d.disabled === true;
			var chan = textInput(d.channel == null ? 'auto' : d.channel, { maxlength: 16 });
			var htm = selectLive(HTMODES, d.htmode || '');
			var pwr = textInput(d.txpower == null ? '' : d.txpower, { maxlength: 3 });
			var cty = selectLive(COUNTRY_LIST, d.country || '');
			var actions = E('td', {}, []);
			if (canW) {
				actions.appendChild(E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() {
					var values = { channel: chan.value || 'auto', htmode: htm.value };
					if (pwr.value !== '') values.txpower = pwr.value;
					if (cty.value !== '') values.country = cty.value;
					if (!window.confirm(_('确认应用 ') + d.name + _(' 的频道/频宽/功率/国家？无线可能短暂中断。'))) return;
					updateDevice(d.name, values, true).then(function(r) { setOut(out1, r); }).catch(function(e) { setOut(out1, { error: String(e) }); });
				}}, [_('应用设备配置')]));
				actions.appendChild(E('button', { 'class': 'cbi-button', 'click': function() {
					if (dis && !window.confirm(_('确认启用设备 ') + d.name + _('？'))) return;
					if (!dis && !window.confirm(_('确认停用设备 ') + d.name + _('？该射频所有接口将下线。'))) return;
					setRadio(d.name, !dis, true).then(function() { location.reload(); });
				} }, [dis ? _('启用') : _('停用')]));
			}
			dt.appendChild(E('tr', {}, [E('td', {}, [d.name]), E('td', {}, [chan]), E('td', {}, [htm]), E('td', {}, [pwr]), E('td', {}, [cty]), E('td', {}, [dis ? _('停用') : _('运行')]), actions]));
		});
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('无线设备')]), dt, out1]));

		var out2 = outBox();
		var it = E('table', { 'class': 'cbi-section-table' }, [thRow([_('接口'), _('模式'), _('SSID'), _('加密'), _('密钥'), _('网络'), _('隐藏'), _('11k'), _('11r'), _('MAC 过滤'), _('操作')])]);
		ifaces.forEach(function(f) {
			var enc = f.encryption || 'none';
			var ssid = textInput(f.ssid, { maxlength: 32 });
			var sel = selectLive(ENCS, enc);
			var key = textInput('', { type: 'password', maxlength: 63, placeholder: f.key_set ? '••••••••（已设置）' : '' });
			var net = textInput(f.network, { maxlength: 64 });
			var hid = E('input', { type: 'checkbox' });
			if (String(f.hidden) === '1' || f.hidden === true || f.hidden === 1) hid.checked = true;
			var k11 = E('input', { type: 'checkbox' });
			if (String(f.ieee80211k) === '1' || f.ieee80211k === true) k11.checked = true;
			var r11 = E('input', { type: 'checkbox' });
			if (String(f.ieee80211r) === '1' || f.ieee80211r === true) r11.checked = true;
			var mf = selectLive(['disable', 'allow', 'deny'], f.macfilter || 'disable');
			var acts = E('td', {}, []);
			if (canW) {
				acts.appendChild(E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() {
					if (enc === 'none' && sel.value !== 'none' && !key.value) {
						window.alert(_('切换到加密模式时必须填写密钥（8-63 位）。'));
						return;
					}
					var values = { ssid: ssid.value, encryption: sel.value, network: net.value, hidden: hid.checked ? '1' : '0', macfilter: mf.value, ieee80211k: k11.checked ? '1' : '0', ieee80211r: r11.checked ? '1' : '0' };
					if (key.value) { values.key = key.value; }
					if (!window.confirm(_('确认应用接口配置 ') + String(f.name) + _('？该接口的无线连接可能短暂中断。'))) return;
					updateVif(f.name, values, true).then(function(r) { setOut(out2, r); }).catch(function(e) { setOut(out2, { error: String(e) }); });
				}}, [_('应用')]));
				acts.appendChild(E('button', { 'class': 'cbi-button cbi-button-remove', 'click': function() {
					if (!window.confirm(_('确认删除 SSID 接口 ') + String(f.name) + _('？该接口将停止广播。'))) return;
					deleteVif(f.name, true).then(function(r) { setOut(out2, r); }).catch(function(e) { setOut(out2, { error: String(e) }); });
				}}, [_('删除')]));
			}
			it.appendChild(E('tr', {}, [E('td', {}, [String(f.name)]), E('td', {}, [f.mode === 'sta' ? 'STA' : 'AP']), E('td', {}, [ssid]), E('td', {}, [sel]), E('td', {}, [key]), E('td', {}, [net]), E('td', {}, [hid]), E('td', {}, [k11]), E('td', {}, [r11]), E('td', {}, [mf]), acts]));
		});
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('无线接口 / MBSSID')]), it, out2]));

		if (canW && devices.length) {
			var out3 = outBox();
			var dsel = select(devices.map(function(d) { return d.name; }), devices[0].name);
			var msel = select(['ap', 'sta'], 'ap');
			var ssidIn = textInput('', { maxlength: 32, placeholder: '新 SSID', style: 'width:130px' });
			var encSel = select(ENCS, 'psk2+ccmp');
			var keyIn = textInput('', { type: 'password', maxlength: 63, placeholder: '密钥 8-63 位', style: 'width:130px' });
			var netIn = textInput('lan', { maxlength: 64, style: 'width:110px' });
			var bssidIn = textInput('', { maxlength: 17, placeholder: _('可选，STA 锁定上游 BSSID'), style: 'width:170px' });
			[dsel, msel, encSel].forEach(function(s) { s.style.minWidth = '96px'; });
			root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('添加接口 (AP/MBSSID 或 STA/APCLI)')]), E('div', { 'class': 'cbi-value' }, [_('设备：'), dsel, '　', _('模式：'), msel, '　', _('SSID：'), ssidIn, '　', _('加密：'), encSel, '　', _('密钥：'), keyIn, '　', _('网络：'), netIn, '　', _('BSSID：'), bssidIn]),
				E('p', { 'class': 'alert-message notice' }, [_('每个射频仅支持 1 个 STA/APCLI 接口；AP 上限 16。')]),
				E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() {
					if (encSel.value !== 'none' && !keyIn.value) {
						window.alert(_('加密模式下必须填写密钥（8-63 位）。'));
						return;
					}
					if (!window.confirm(_('确认添加新接口？创建后会自动应用。'))) return;
					addVif(dsel.value, msel.value, ssidIn.value, encSel.value, keyIn.value, netIn.value, bssidIn.value, true).then(function(r) { setOut(out3, r); }).catch(function(e) { setOut(out3, { error: String(e) }); });
				}}, [_('添加')]), out3]));
		}

		var stt = E('table', { 'class': 'cbi-section-table' }, [thRow([_('接口'), _('MAC'), _('信号(dBm)'), _('TX Mbps'), _('RX Mbps'), _('空闲时间(s)')])]);
		var staRows = 0;
		(st.radios || []).forEach(function(r) {
			(r.ifaces || []).forEach(function(fi) {
				var list = (fi.ifname && st.stations && st.stations[fi.ifname]) || [];
				list.forEach(function(c) {
					staRows++;
					stt.appendChild(E('tr', {}, [E('td', {}, [String(fi.ifname)]), E('td', {}, [c.mac]), E('td', {}, [c.signal]), E('td', {}, [c.tx_rate]), E('td', {}, [c.rx_rate]), E('td', {}, [c.inactive])]));
				});
			});
		});
		(staRows === 0) && stt.appendChild(E('tr', {}, [E('td', { colspan: 6 }, [_('当前无在线客户端')])]));
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('客户端站点表，共 ') + String(staRows) + _(' 个')]), stt]));

		var out4 = outBox();
		var bts = E('div', {}, []);
		var apIface = ifaces.filter(function(f) { return f.mode === 'ap'; })[0];
		if (tools.iwinfo && apIface) bts.appendChild(E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { scan(apIface.ifname || apIface.name).then(function(r) { setOut(out4, r); }).catch(function(e) { setOut(out4, { error: String(e) }); }); } }, [_('扫描邻居网络')]));
		if (tools.wifi) bts.appendChild(E('button', { 'class': 'cbi-button cbi-button-apply', 'click': function() { if (window.confirm(_('重新应用全部无线配置，可能短暂中断连接，是否继续？'))) applyAll().then(function(r) { setOut(out4, r); }).catch(function(e) { setOut(out4, { error: String(e) }); }); } }, [_('应用全部无线配置')]));
		root.appendChild(E('div', { 'class': 'cbi-section' }, [E('h3', {}, [_('扫描与全局应用')]), bts, out4]));
		return root;
	},
	handleSaveApply: null
});