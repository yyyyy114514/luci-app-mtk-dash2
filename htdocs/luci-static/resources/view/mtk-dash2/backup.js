'use strict';
'require view';
'require rpc';

var list = rpc.declare({ object: 'mtk-dash2', method: 'list_backups' });
var caps = rpc.declare({ object: 'mtk-dash2', method: 'capabilities' });
var make = rpc.declare({ object: 'mtk-dash2', method: 'backup' });
var preview = rpc.declare({ object: 'mtk-dash2', method: 'restore_preview', params: ['backup'] });
var restore = rpc.declare({ object: 'mtk-dash2', method: 'restore', params: ['backup'] });

function render(data) {
	var d = data[0] || {}, c = data[1] || {}, tools = c.tools || {}, root = E('div', { 'class': 'cbi-map' });
	root.appendChild(E('h2', {}, [_('备份恢复')]));
	root.appendChild(E('p', {}, [_('归档为时间戳压缩包，敏感值默认脱敏；恢复前必须先预览差异。')]));
	var out = E('pre', {}, [_('请选择备份并预览')]);
	if (tools.tar) {
		var b = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { make().then(function(x) { out.textContent = JSON.stringify(x, null, 2); }); } }, [_('创建脱敏备份')]);
		root.appendChild(E('div', { 'class': 'cbi-section' }, [b]));
	}
	var t = E('table', { 'class': 'cbi-section-table' }, [E('tr', {}, [_('编号'), _('创建时间'), _('大小'), _('模块'), _('操作')])]);
	(d.backups || []).forEach(function(x) {
		var p = E('button', { 'class': 'cbi-button', 'click': function() { preview(x.id).then(function(v) { out.textContent = JSON.stringify(v, null, 2); }); } }, [_('预览差异')]);
		var actions = [p];
		if (tools.uci) actions.push(E('button', { 'class': 'cbi-button cbi-button-remove', 'click': function() { if (confirm(_('恢复会写入配置并保留当前敏感值，是否继续？'))) restore(x.id).then(function(v) { out.textContent = JSON.stringify(v, null, 2); }); } }, [_('恢复')]));
		t.appendChild(E('tr', {}, [E('td', {}, [x.id]), E('td', {}, [x.created]), E('td', {}, [String(x.size || 0) + ' B']), E('td', {}, [String((x.modules || []).length)]), E('td', {}, actions)]));
	});
	root.appendChild(E('div', { 'class': 'cbi-section' }, [t, out]));
	return root;
}

return view.extend({ load: function() { return Promise.all([list(), caps()]); }, render: render });
