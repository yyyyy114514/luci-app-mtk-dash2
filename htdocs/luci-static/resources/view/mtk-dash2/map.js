'use strict';
'require view';
'require rpc';

var getStatus = rpc.declare({ object: 'map-easymesh', method: 'status' });
var getCaps = rpc.declare({ object: 'map-easymesh', method: 'capabilities' });
var setField = rpc.declare({ object: 'map-easymesh', method: 'set_field', params: ['field', 'value', 'reload'] });
var reloadSvc = rpc.declare({ object: 'map-easymesh', method: 'reload' });

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
