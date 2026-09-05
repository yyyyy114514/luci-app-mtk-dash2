'use strict';
'require view';
'require rpc';
var get=rpc.declare({object:'mtk-dash2',method:'diagnostics'});
function render(d){d=d||{};var root=E('div',{'class':'cbi-map'},[E('h2',{},[_('脱敏诊断')]),E('p',{},[_('输出已过滤密码、密钥、PSK、SAE、凭据等敏感字段。')])]);var t=E('table',{'class':'cbi-section-table'},[E('tr',{},[_('步骤'),_('退出码'),_('结果'),_('输出')])]);(d.steps||[]).forEach(function(s){t.appendChild(E('tr',{},[E('td',{},[s.name]),E('td',{},[String(s.exit_code)]),E('td',{},[s.ok?_('成功'):_('失败')]),E('td',{},[E('pre',{},[s.output||s.error||JSON.stringify(s.files||s.interfaces||s.probes||{})])])]));});root.appendChild(E('div',{'class':'cbi-section'},[t]));var b=E('button',{'class':'cbi-button cbi-button-action','click':function(){get().then(function(x){var n=render(x);root.parentNode.replaceChild(n,root);});}},[_('重新收集')]);var dl=E('button',{'class':'cbi-button','click':function(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));a.download='mtk-dash2-diagnostics.json';a.click();}},[_('下载脱敏 JSON')]);root.appendChild(E('div',{'class':'cbi-section'},[b,dl]));return root;}
return view.extend({load:get,render:render});
