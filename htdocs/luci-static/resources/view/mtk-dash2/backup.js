'use strict';
'require view';
'require rpc';

var list = rpc.declare({ object: 'mtk-dash2', method: 'list_backups' });
var caps = rpc.declare({ object: 'mtk-dash2', method: 'capabilities' });
var make = rpc.declare({ object: 'mtk-dash2', method: 'backup' });
var preview = rpc.declare({ object: 'mtk-dash2', method: 'restore_preview', params: ['backup'] });
var restore = rpc.declare({ object: 'mtk-dash2', method: 'restore', params: ['backup'] });
var rollback = rpc.declare({ object: 'mtk-dash2', method: 'rollback' });

function section(title) {
	var el = E('div', { 'class': 'cbi-section' }, [E('h3', {}, [title])]);
	for (var i = 1; i < arguments.length; i++) el.appendChild(arguments[i]);
	return el;
}
function fmtSize(n) {
	if (n == null) return '-';
	if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB';
	if (n > 1024) return (n / 1024).toFixed(1) + ' KB';
	return n + ' B';
}

return view.extend({
	load: function() { return Promise.all([list(), caps()]); },
	render: function(data) {
		var d = data[0] || {}, c = data[1] || {}, tools = c.tools || {};
		var root = E('div', { 'class': 'cbi-map' });
		root.appendChild(E('h2', {}, [_('备份恢复')]));
		root.appendChild(E('p', {}, [_('归档为带时间戳的脱敏压缩包（含 wireless UCI、MAP 配置与元数据）；恢复时敏感字段保留当前真实值，恢复后会自动应用并复核，失败自动回滚。')]));

		var out = E('pre', { 'style': 'max-height:420px;overflow:auto' }, [_('操作结果将显示在这里。')]);
		function show(r) { out.textContent = JSON.stringify(r, null, 2); }

		var mkBox = E('div', {}, []);
		if (tools.tar) {
			mkBox.appendChild(E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() {
				if (!window.confirm(_('创建当前配置的脱敏备份？'))) return;
				make().then(show).catch(function(e) { show({ error: String(e) }); });
			} }, [_('创建备份')]));
		} else {
			mkBox.appendChild(E('p', { 'class': 'alert-message warning' }, [_('缺少 tar，无法创建压缩归档。')]));
		}
		var rbBox = E('button', { 'class': 'cbi-button cbi-button-remove', 'click': function() {
			if (!window.confirm(_('回滚到最近一次恢复/应用前的自动快照？当前配置将被覆盖，无线会重新加载。'))) return;
			rollback().then(show).catch(function(e) { show({ error: String(e) }); });
		} }, [_('回滚最近变更')]);
		root.appendChild(section(_('创建与回滚'), E('div', {}, [mkBox, ' ', rbBox])));

		var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('备份 ID'), _('创建时间'), _('大小'), _('模块'), _('版本'), _('操作')])]);
		var previewed = {};
		(d.backups || []).forEach(function(x) {
			var id = String(x.id);
			var mods = (x.modules || []).map(function(m) { return m.id; }).join(', ') || '-';
			var acts = E('td', {}, []);
			acts.appendChild(E('button', { 'class': 'cbi-button', 'click': function() {
				preview(id).then(function(v) { previewed[id] = v; show(v); }).catch(function(e) { show({ error: String(e) }); });
			} }, [_('预览差异')]));
			acts.appendChild(E('button', { 'class': 'cbi-button cbi-button-remove', 'click': function() {
				if (!previewed[id]) { window.alert(_('请先预览差异再恢复。')); return; }
				if (!window.confirm(_('确认恢复备份 ') + id + _('？将写入配置并重新加载无线；敏感字段保留当前值。'))) return;
				restore(id).then(show).catch(function(e) { show({ error: String(e) }); });
			} }, [_('恢复')]));
			acts.appendChild(E('button', { 'class': 'cbi-button', 'click': function() {
				var a = document.createElement('a');
				a.href = 'data:application/octet-stream,' + encodeURIComponent(JSON.stringify({ backup: x }, null, 2));
				a.download = 'mtk-dash2-backup-' + id + '.json';
				a.click();
			} }, [_('导出清单')]));
			t.appendChild(E('tr', {}, [E('td', {}, [id]), E('td', {}, [String(x.created || '-')]), E('td', {}, [fmtSize(x.size)]), E('td', {}, [mods]), E('td', {}, [String(x.version || '-')]), acts]));
		});
		if (!(d.backups || []).length) t.appendChild(E('tr', {}, [E('td', { colspan: 6 }, [_('暂无备份。')])]));
		root.appendChild(section(_('备份列表'), t));
		root.appendChild(section(_('操作输出'), out));

		var modInfo = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('模块'), _('来源'), _('说明')])]);
		((d.backups || [])[0] || {}).modules && d.backups[0].modules.forEach(function(m) {
			modInfo.appendChild(E('tr', {}, [E('td', {}, [String(m.id)]), E('td', {}, [E('code', {}, [String(m.source || '-')])]), E('td', {}, [_('脱敏归档')])]));
		});
		root.appendChild(section(_('备份模块'), modInfo));
		return root;
	},
	handleSaveApply: null
});
