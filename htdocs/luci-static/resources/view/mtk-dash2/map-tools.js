'use strict';
'require view';
'require rpc';

var getCaps = rpc.declare({ object: 'map-easymesh', method: 'capabilities' });

var dppQrCode = rpc.declare({ object: 'map-easymesh', method: 'dpp_qr_code', params: ['uri'] });
var dppBootstrapGen = rpc.declare({ object: 'map-easymesh', method: 'dpp_bootstrap_gen', params: ['chan', 'mac', 'info', 'curve', 'key'] });
var dppBootstrapInfo = rpc.declare({ object: 'map-easymesh', method: 'dpp_bootstrap_info', params: ['id'] });
var dppBootstrapUri = rpc.declare({ object: 'map-easymesh', method: 'dpp_bootstrap_get_uri', params: ['id'] });
var dppBootstrapRemove = rpc.declare({ object: 'map-easymesh', method: 'dpp_bootstrap_remove', params: ['id'] });
var dppStart = rpc.declare({ object: 'map-easymesh', method: 'dpp_start' });
var dppListen = rpc.declare({ object: 'map-easymesh', method: 'dpp_listen', params: ['freq'] });
var dppStopListen = rpc.declare({ object: 'map-easymesh', method: 'dpp_stop_listen' });
var dppCfgAdd = rpc.declare({ object: 'map-easymesh', method: 'dpp_configurator_add', params: ['curve', 'key'] });
var dppCfgRemove = rpc.declare({ object: 'map-easymesh', method: 'dpp_configurator_remove', params: ['id'] });
var dppCfgSign = rpc.declare({ object: 'map-easymesh', method: 'dpp_configurator_sign', params: ['id'] });
var dppCfgGetKey = rpc.declare({ object: 'map-easymesh', method: 'dpp_configurator_get_key', params: ['id'] });
var dppAuthInit = rpc.declare({ object: 'map-easymesh', method: 'dpp_auth_init', params: ['peer', 'own'] });
var dppCtrlStart = rpc.declare({ object: 'map-easymesh', method: 'dpp_controller_start' });
var dppCtrlStop = rpc.declare({ object: 'map-easymesh', method: 'dpp_controller_stop' });
var dppPkexAdd = rpc.declare({ object: 'map-easymesh', method: 'dpp_pkex_add', params: ['code'] });
var dppPkexRemove = rpc.declare({ object: 'map-easymesh', method: 'dpp_pkex_remove', params: ['id'] });
var dppChirpEn = rpc.declare({ object: 'map-easymesh', method: 'dpp_chirp_ch_en', params: ['enable', 'chan_list'] });
var dppChirpNotif = rpc.declare({ object: 'map-easymesh', method: 'dpp_chirp_notif' });
var dppOnboardType = rpc.declare({ object: 'map-easymesh', method: 'dpp_onboard_type', params: ['type'] });
var dppPresenceEn = rpc.declare({ object: 'map-easymesh', method: 'dpp_presence_enable' });
var dppReconfigEn = rpc.declare({ object: 'map-easymesh', method: 'dpp_reconfig_enable' });
var dppCceInd = rpc.declare({ object: 'map-easymesh', method: 'dpp_cce_indication_start' });
var dppDevSetCfg = rpc.declare({ object: 'map-easymesh', method: 'dpp_dev_set_cfg', params: ['path'] });
var dppSetBhWifi = rpc.declare({ object: 'map-easymesh', method: 'dpp_set_bh_wifi' });
var dppResetCfg = rpc.declare({ object: 'map-easymesh', method: 'dpp_reset_config' });
var dppResetUserCfg = rpc.declare({ object: 'map-easymesh', method: 'dpp_reset_mapd_user_config' });

var btmReq = rpc.declare({ object: 'map-easymesh', method: 'btm_req', params: ['mac', 'ess_imm', 'timer', 'url'] });
var wnmReq = rpc.declare({ object: 'map-easymesh', method: 'wnm_req', params: ['iface', 'mac', 'url'] });
var wnmReq2 = rpc.declare({ object: 'map-easymesh', method: 'wnm_req2', params: ['iface', 'mac', 'code', 'delay', 'url'] });
var qosMap = rpc.declare({ object: 'map-easymesh', method: 'qos_map', params: ['iface', 'mac', 'dscp_exception', 'dscp_range'] });
var proxyArpList = rpc.declare({ object: 'map-easymesh', method: 'proxy_arp_list', params: ['family'] });

function section(title) {
	var el = E('div', { 'class': 'cbi-section' }, [E('h3', {}, [title])]);
	for (var i = 1; i < arguments.length; i++) el.appendChild(arguments[i]);
	return el;
}

function textInput(placeholder, width) {
	return E('input', { 'class': 'cbi-input-text', placeholder: placeholder || '', style: 'width:' + (width || 200) + 'px' });
}

function sel(options) {
	var s = E('select', { 'class': 'cbi-input-select' });
	options.forEach(function(o) {
		var opt = E('option', { value: String(o[0]) }, [o[1] != null ? o[1] : String(o[0])]);
		if (o[2]) opt.selected = true;
		s.appendChild(opt);
	});
	return s;
}

function fieldRow(label) {
	var fields = Array.prototype.slice.call(arguments, 1);
	var children = [];
	fields.forEach(function(f, i) {
		if (i) children.push(' ');
		children.push(f);
	});
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title', style: 'min-width:200px' }, [label]),
		E('div', { 'class': 'cbi-value-field' }, children)
	]);
}

return view.extend({
	load: function() {
		return getCaps();
	},

	render: function(caps) {
		caps = caps || {};
		var root = E('div', { 'class': 'cbi-map' }, [E('h2', {}, [_('MAP 工具')])]);

		if (!caps.wappctrl) {
			root.appendChild(E('p', { 'class': 'alert-message warning' }, [
				_('wappctrl 不可用（未安装 MAP 组件），无法执行 DPP 入网 / BTM / WNM / QoS / 代理 ARP 操作。')
			]));
			return root;
		}
		if (!caps.iface) {
			root.appendChild(E('p', { 'class': 'alert-message warning' }, [
				_('未探测到无线接口（first_wifi_iface 无结果），无法执行 DPP 入网等操作。')
			]));
			return root;
		}

		var iface = String(caps.iface);
		var pre = E('pre', { 'style': 'max-height:420px;overflow:auto' }, []);

		function act(label, confirmText, call) {
			return E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
				ev.preventDefault();
				var ct = (typeof confirmText === 'function') ? confirmText() : confirmText;
				if (ct === null) return;
				if (ct && !window.confirm(ct)) return;
				pre.textContent = _('正在执行...');
				call().then(function(r) {
					pre.textContent = JSON.stringify(r, null, 2);
				}).catch(function(e) {
					pre.textContent = _('RPC 调用失败: ') + String(e);
				});
			}}, [label]);
		}

		function requireText(v, label) {
			if (!String(v).trim()) {
				window.alert(_('请输入 %s。').format(label));
				return false;
			}
			return true;
		}

		root.appendChild(section(_('输出区'),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-field' }, [
					E('button', { 'class': 'cbi-button', 'click': function(ev) { ev.preventDefault(); pre.textContent = ''; } }, [_('清空输出')])
				])
			]),
			pre
		));

		/* DPP 入网 */
		var dpp = section(_('DPP 入网'));
		dpp.appendChild(E('p', { 'class': 'alert-message notice' }, [
			_('DPP 操作使用无线接口 %s，结果统一输出到上方输出区。').format(iface)
		]));

		var uri = textInput('DPP:...', 380);
		var bsChan = textInput(_('chan'), 90), bsMac = textInput(_('mac'), 150),
			bsInfo = textInput(_('info'), 150), bsCurve = textInput(_('curve'), 120),
			bsKey = textInput(_('key'), 150);
		dpp.appendChild(E('h4', {}, [_('快速入网')]));
		dpp.appendChild(fieldRow(_('DPP URI'),
			uri,
			act(_('扫码入网'), function() {
				if (!requireText(uri.value, _('DPP URI'))) return null;
				return _('确认通过 DPP URI 快速入网？');
			}, function() {
				return dppQrCode(uri.value.trim());
			})
		));
		dpp.appendChild(fieldRow(_('生成 Bootstrap'), bsChan, bsMac, bsInfo, bsCurve, bsKey,
			act(_('生成二维码'), _('确认生成 DPP Bootstrap 二维码？'), function() {
				return dppBootstrapGen(bsChan.value.trim(), bsMac.value.trim(), bsInfo.value.trim(), bsCurve.value.trim(), bsKey.value.trim());
			})
		));

		var bId = textInput('id', 100);
		dpp.appendChild(E('h4', {}, [_('Bootstrap 管理')]));
		dpp.appendChild(fieldRow(_('Bootstrap ID'), bId,
			act(_('信息'), _('确认查询该 Bootstrap 信息？'), function() { return dppBootstrapInfo(bId.value.trim()); }),
			act(_('获取 URI'), _('确认获取该 Bootstrap URI？'), function() { return dppBootstrapUri(bId.value.trim()); }),
			act(_('删除'), _('确认删除该 Bootstrap？'), function() { return dppBootstrapRemove(bId.value.trim()); })
		));

		var freq = textInput('2412', 100);
		dpp.appendChild(E('h4', {}, [_('会话')]));
		dpp.appendChild(fieldRow(_('启动 / 监听 / 停止'),
			act(_('启动 DPP'), _('确认启动 DPP 会话？'), function() { return dppStart(); }),
			freq,
			act(_('监听'), function() {
				return _('确认在 %s MHz 开始 DPP 监听？').format(freq.value.trim() || '2412');
			}, function() {
				return dppListen(freq.value.trim());
			}),
			act(_('停止监听'), _('确认停止 DPP 监听？'), function() { return dppStopListen(); })
		));

		var cfgCurve = textInput(_('curve'), 120), cfgKey = textInput(_('key'), 160), cfgId = textInput('id', 100);
		dpp.appendChild(E('h4', {}, [_('Configurator')]));
		dpp.appendChild(fieldRow(_('新建'), cfgCurve, cfgKey,
			act(_('添加'), _('确认添加 DPP Configurator？'), function() { return dppCfgAdd(cfgCurve.value.trim(), cfgKey.value.trim()); })
		));
		dpp.appendChild(fieldRow(_('Configurator ID'), cfgId,
			act(_('签名'), _('确认对 Configurator 签名？'), function() { return dppCfgSign(cfgId.value.trim()); }),
			act(_('获取密钥'), _('确认获取 Configurator 私钥？'), function() { return dppCfgGetKey(cfgId.value.trim()); }),
			act(_('删除'), _('确认删除该 Configurator？'), function() { return dppCfgRemove(cfgId.value.trim()); })
		));

		var peer = textInput(_('peer'), 100), own = textInput(_('own'), 100);
		dpp.appendChild(E('h4', {}, [_('认证')]));
		dpp.appendChild(fieldRow(_('Auth Init'), peer, own,
			act(_('发起认证'), function() {
				return _('确认发起 DPP Auth Init（peer=%s, own=%s）？').format(peer.value.trim() || '-', own.value.trim() || '-');
			}, function() {
				return dppAuthInit(peer.value.trim(), own.value.trim());
			})
		));
		dpp.appendChild(fieldRow(_('Controller'),
			act(_('启动'), _('确认启动 DPP Controller？'), function() { return dppCtrlStart(); }),
			act(_('停止'), _('确认停止 DPP Controller？'), function() { return dppCtrlStop(); })
		));

		var pkexCode = textInput(_('code'), 200), pkexId = textInput('id', 100);
		dpp.appendChild(E('h4', {}, [_('PKEX')]));
		dpp.appendChild(fieldRow(_('PKEX Code'), pkexCode,
			act(_('添加'), function() {
				if (!requireText(pkexCode.value, _('PKEX Code'))) return null;
				return _('确认添加 PKEX Code？');
			}, function() { return dppPkexAdd(pkexCode.value.trim()); })
		));
		dpp.appendChild(fieldRow(_('PKEX ID'), pkexId,
			act(_('删除'), _('确认删除该 PKEX？'), function() { return dppPkexRemove(pkexId.value.trim()); })
		));

		var chirpEn = sel([['1', _('启用'), true], ['0', _('禁用')]]), chirpCh = textInput(_('chan_list'), 220);
		dpp.appendChild(E('h4', {}, [_('Chirp')]));
		dpp.appendChild(fieldRow(_('信道启用'), chirpEn, chirpCh,
			act(_('应用'), _('确认应用 Chirp 信道设置？'), function() {
				return dppChirpEn(chirpEn.value, chirpCh.value.trim());
			})
		));
		dpp.appendChild(fieldRow(_('通知'),
			act(_('Chirp 通知'), _('确认执行 Chirp 通知？'), function() { return dppChirpNotif(); })
		));

		var onboard = textInput(_('type'), 160), devPath = textInput(_('path'), 240);
		dpp.appendChild(E('h4', {}, [_('其他')]));
		dpp.appendChild(fieldRow(_('Onboard 类型'), onboard,
			act(_('应用'), function() {
				if (!requireText(onboard.value, _('Onboard 类型'))) return null;
				return _('确认设置 DPP Onboard 类型？');
			}, function() { return dppOnboardType(onboard.value.trim()); })
		));
		dpp.appendChild(fieldRow(_('会话'),
			act(_('Presence 启用'), _('确认启用 DPP Presence？'), function() { return dppPresenceEn(); }),
			act(_('Reconfig 启用'), _('确认启用 DPP Reconfig？'), function() { return dppReconfigEn(); }),
			act(_('CCE 指示'), _('确认启动 DPP CCE Indication？'), function() { return dppCceInd(); })
		));
		dpp.appendChild(fieldRow(_('设备配置'), devPath,
			act(_('设置'), function() {
				if (!requireText(devPath.value, _('配置路径'))) return null;
				return _('确认设置 DPP 设备配置？');
			}, function() { return dppDevSetCfg(devPath.value.trim()); })
		));
		dpp.appendChild(fieldRow(_('回程与重置'),
			act(_('设为 WiFi 回程'), _('确认将回程切换为 WiFi（DPP 完成后执行）？'), function() { return dppSetBhWifi(); }),
			act(_('重置 DPP 配置'), _('确认重置 DPP 配置？此操作不可撤销！'), function() { return dppResetCfg(); }),
			act(_('重置 MAPD 用户配置'), _('确认重置 MAPD 用户配置？此操作不可撤销！'), function() { return dppResetUserCfg(); })
		));
		root.appendChild(dpp);

		/* BTM 主动漫游 */
		var btmMac = textInput(_('mac'), 160), btmEss = sel([['0', '0', true], ['1', '1']]),
			btmTimer = textInput(_('timer'), 100), btmUrl = textInput(_('url'), 260);
		root.appendChild(section(_('BTM 主动漫游'),
			fieldRow(_('BTM 请求'), btmMac, btmEss, btmTimer, btmUrl,
				act(_('发送'), function() {
					if (!requireText(btmMac.value, _('MAC'))) return null;
					return _('确认向 %s 发送 BTM 请求？').format(btmMac.value.trim());
				}, function() {
					return btmReq(btmMac.value.trim(), btmEss.value, btmTimer.value.trim(), btmUrl.value.trim());
				})
			)
		));

		/* WNM */
		var wIface = textInput(iface, 110), wMac = textInput(_('mac'), 160), wUrl = textInput(_('url'), 260);
		var w2Iface = textInput(iface, 110), w2Mac = textInput(_('mac'), 160),
			w2Code = textInput(_('code'), 100), w2Delay = textInput(_('delay'), 100), w2Url = textInput(_('url'), 260);
		root.appendChild(section(_('WNM'),
			fieldRow(_('wnm_req'), wIface, wMac, wUrl,
				act(_('发送'), function() {
					if (!requireText(wMac.value, _('MAC'))) return null;
					return _('确认向 %s 发送 WNM 请求？').format(wMac.value.trim());
				}, function() {
					return wnmReq(wIface.value.trim(), wMac.value.trim(), wUrl.value.trim());
				})
			),
			fieldRow(_('wnm_req2'), w2Iface, w2Mac, w2Code, w2Delay, w2Url,
				act(_('发送'), function() {
					if (!requireText(w2Mac.value, _('MAC'))) return null;
					return _('确认向 %s 发送 WNM 2 请求？').format(w2Mac.value.trim());
				}, function() {
					return wnmReq2(w2Iface.value.trim(), w2Mac.value.trim(), w2Code.value.trim(), w2Delay.value.trim(), w2Url.value.trim());
				})
			)
		));

		/* QoS 流分类 / 代理 ARP */
		var qIface = textInput(iface, 110), qMac = textInput(_('mac'), 160),
			qExc = textInput(_('dscp_exception'), 100), qRange = textInput(_('dscp_range'), 120);
		var family = sel([['ipv4', 'ipv4', true], ['ipv6', 'ipv6']]);
		root.appendChild(section(_('QoS 流分类'),
			fieldRow(_('qos_map'), qIface, qMac, qExc, qRange,
				act(_('应用'), function() {
					if (!requireText(qMac.value, _('MAC'))) return null;
					return _('确认向 %s 应用 QoS MAP？').format(qMac.value.trim());
				}, function() {
					return qosMap(qIface.value.trim(), qMac.value.trim(), qExc.value.trim(), qRange.value.trim());
				})
			),
			fieldRow(_('代理 ARP'), family,
				act(_('列出'), _('确认查询代理 ARP 列表？'), function() { return proxyArpList(family.value); })
			)
		));

		return root;
	}
});
