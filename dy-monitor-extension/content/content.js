// 抖音监控 v9 - 带类目切换
(function(){"use strict";console.log("[抖音监控] v9 带类目切换");

// ─── 调试日志 ───
let dyLogs = [];
function dyLog(msg) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${msg}`;
  dyLogs.push(line);
  if (dyLogs.length > 200) dyLogs.splice(0, 50);
  // 更新运行状态条（显示最近一条）
  const bar = document.getElementById('dy-log-bar');
  if (bar) { bar.textContent = line; bar.style.display = 'block'; }
  // 如果调试面板存在也更新
  const el = document.getElementById('dy-debug-log');
  if (el) { el.textContent = dyLogs.slice(-40).join('\n'); el.scrollTop = el.scrollHeight; }
}

// ─── 类目相关 ───
const CATEGORY_API = '/compass_api/config_center/category/cate_list?level=4&scene=4&default_cate_to_level=2';
let selectedPaths = new Set();
let cateTree = [];

// 按名称路径在类目树中逐级查找，返回每级对应的 cate_id
function getCateIdsByPath(tree, path) {
  const ids = [];
  let current = tree;
  for (const name of path) {
    const node = current.find(n => n.cate_name === name);
    if (!node) break;
    ids.push(node.cate_id);
    current = node.children || [];
  }
  return ids.length === path.length ? ids : null;
}

async function fetchCategoryTree() {
  const res = await fetch(CATEGORY_API, { credentials: 'include' });
  const json = await res.json();
  if (json.data && json.data.cate_list) return json.data.cate_list;
  throw new Error('类目树获取失败');
}
function fullClick(el) {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function waitEl(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject('找不到元素: ' + selector), timeout);
    const el = document.querySelector(selector);
    if (el) { clearTimeout(timer); resolve(el); return; }
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { clearTimeout(timer); obs.disconnect(); resolve(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
}

async function selectCategoryViaCascader(categoryPath) {
  dyLog("级联选类目: " + categoryPath.join(' > '));

  // 第一步：查 cate_id
  let cateIds = null;
  if (cateTree.length > 0) {
    cateIds = getCateIdsByPath(cateTree, categoryPath);
    if (cateIds) dyLog("  查得 cate_id: " + cateIds.join(', '));
  }

  // 第二步：点击级联选择器
  const picker = await waitEl('.ecom-cascader-picker, [class*="cascader"][class*="picker"]');
  fullClick(picker);
  await sleep(1500);
  dyLog("  弹出层已打开");

  // 第三步：遍历每一级类目
  for (let level = 0; level < categoryPath.length; level++) {
    const name = categoryPath[level];
    const targetId = cateIds ? cateIds[level] : null;
    let found = false;

    for (let retry = 0; retry < 4 && !found; retry++) {
      if (retry > 0) await sleep(500);

      // 策略A：title 属性精确匹配（已确认页面有 title="玩具乐器"）
      let el = document.querySelector('.ecom-cascader-menu-item[title="' + name + '"]');
      if (el) { fullClick(el); found = true; dyLog("  第" + (level+1) + "级 title匹配: " + name); break; }

      // 策略B：role="option" + data-level + title（用户提供的备用模式）
      el = document.querySelector('body [role="option"][data-level="' + (level+1) + '"][title="' + name + '"]');
      if (el) { fullClick(el); found = true; dyLog("  第" + (level+1) + "级 role匹配: " + name); break; }

      // 策略C：按级联菜单列索引
      const menus = document.querySelectorAll('.ecom-cascader-menu, [class*="cascader"][class*="menu"]');
      if (menus.length > level) {
        const items = menus[level].querySelectorAll('.ecom-cascader-menu-item, [class*="menu-item"], li');
        for (const item of items) {
          const txt = (item.textContent || '').trim();
          if (txt === name || txt.startsWith(name + '（') || txt.startsWith(name + '(')) {
            fullClick(item);
            found = true;
            dyLog("  第" + (level+1) + "级菜单列[" + level + "]点击: " + name);
            break;
          }
        }
        if (found) break;
      }
    }

    if (!found) throw new Error('第' + (level+1) + '级无法定位: ' + name);
    await sleep(3000);
  }

  // 如果弹窗还在，找最后一个有"全部"的菜单列，点那个"全部"
  let allClicked = false;
  for (let retry = 0; retry < 6 && !allClicked; retry++) {
    if (retry > 0) await sleep(1000);
    const menus = document.querySelectorAll('.ecom-cascader-menu, [class*="cascader"][class*="menu"]');
    dyLog("  重试" + (retry+1) + ": 菜单列数=" + menus.length);
    // 从后往前找，找到最后一个包含可见"全部"的列
    for (let m = menus.length - 1; m >= 0; m--) {
      const menu = menus[m];
      if (menu.offsetParent === null) continue;
      const allItems = menu.querySelectorAll('.ecom-cascader-menu-item, [class*="menu-item"], li');
      for (const item of allItems) {
        if (item.offsetParent === null) continue;
        if ((item.textContent || '').trim() === '全部') {
          fullClick(item);
          dyLog("  第" + (m+1) + "列(最后一列)点击'全部'完成选择");
          await sleep(2000);
          allClicked = true;
          break;
        }
      }
      if (allClicked) break;
    }
  }
  if (!allClicked) {
    dyLog("  未找到'全部', body.click 关闭");
    document.body.click();
    await sleep(1000);
  }

  // 等待表格数据加载完成（最多等20秒）
  for (let w = 0; w < 40; w++) {
    const rows = document.querySelectorAll('tr[data-row-key], .ant-table-row, [class*="table"] tr, table tr');
    if (rows.length > 5) break;
    await sleep(500);
  }

  // 切完类目后多等几秒，确保页面数据完全加载再开始采集
  await sleep(5000);
  dyLog("  类目切换完成，开始采集");
}

// ─── 类目选择器 UI ───
function updateCateUI() {
  const ct = document.getElementById('dy-cate-count');
  if (ct) ct.textContent = selectedPaths.size > 0 ? '已选 '+selectedPaths.size+' 个' : '未选';
  const clr = document.getElementById('dy-cate-clear');
  if (clr) clr.style.display = selectedPaths.size > 0 ? 'inline-block' : 'none';
}
function renderCatePicker() {
  const container = document.getElementById('dy-cate-picker');
  if (!container) return;
  container.innerHTML = '<div class="dy-cate-bar" style="display:flex;align-items:center;gap:6px">'
    + '<button id="dy-cate-btn" style="flex:1;padding:4px 10px;border:none;border-radius:6px;cursor:pointer;font-size:12px;background:#f0f0f0">🎯 选类目</button>'
    + '<span id="dy-cate-count" style="font-size:11px;color:#999">' + (selectedPaths.size > 0 ? '已选 ' + selectedPaths.size + ' 个' : '未选') + '</span>'
    + '<button id="dy-cate-clear" style="padding:4px 8px;border:none;border-radius:6px;cursor:pointer;font-size:11px;background:#fbe9e7;color:#c62828;display:' + (selectedPaths.size > 0 ? 'inline-block' : 'none') + '">✕ 清除</button></div>'
    + '<div id="dy-cate-tree" style="display:none;max-height:500px;overflow-y:auto;border:1px solid #eee;border-radius:8px;padding:6px;margin-top:6px;background:#fafbfc;position:relative;z-index:10"></div>';
  document.getElementById('dy-cate-btn').onclick = async () => {
    const treeEl = document.getElementById('dy-cate-tree');
    if (treeEl.style.display === 'block') { treeEl.style.display = 'none'; return; }
    treeEl.style.display = 'block';
    if (treeEl.children.length === 0) {
      try { cateTree = await fetchCategoryTree(); renderCateTree(treeEl, cateTree.filter(n => n.cate_name !== '全部'), ''); }
      catch(e) { treeEl.innerHTML = '<div style="color:#999;padding:10px">加载类目失败</div>'; }
    }
  };
  document.getElementById('dy-cate-clear').onclick = function() {
    selectedPaths.clear();
    updateCateUI();
    const treeEl = document.getElementById('dy-cate-tree');
    if (treeEl) {
      treeEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
  };
}
function renderCateTree(container, nodes, prefix) {
  nodes.forEach(node => {
    const path = prefix ? `${prefix}>${node.cate_name}` : node.cate_name;
    const children = (node.children || []).filter(c => c.cate_name !== '全部');
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:4px;font-size:12px';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.style.cssText = 'width:14px;height:14px;accent-color:#4f6ef7;flex-shrink:0'; cb.checked = selectedPaths.has(path); cb.dataset.path = path;
    div.appendChild(cb);
    if (children.length > 0) {
      const toggle = document.createElement('span'); toggle.textContent = '▶'; toggle.style.cssText = 'width:16px;text-align:center;cursor:pointer;font-size:10px;color:#94a3b8;flex-shrink:0';
      const childContainer = document.createElement('div'); childContainer.style.cssText = 'padding-left:16px;display:none';
      let expanded = false;
      toggle.onclick = () => { expanded = !expanded; toggle.textContent = expanded ? '▼' : '▶'; childContainer.style.display = expanded ? 'block' : 'none'; if (expanded && childContainer.children.length === 0) renderCateTree(childContainer, children, path); };
      div.appendChild(toggle);
      cb.onchange = () => {
        if (cb.checked) selectedPaths.add(path);
        else { selectedPaths.delete(path); childContainer.querySelectorAll('input').forEach(c => { c.checked = false; selectedPaths.delete(c.dataset.path||''); }); }
        updateCateUI();
      };
      const label = document.createElement('span'); label.textContent = node.cate_name; label.style.cssText = 'flex:1;color:#475569;cursor:pointer'; label.onclick = () => cb.click();
      div.appendChild(label); container.appendChild(div); container.appendChild(childContainer);
    } else {
      cb.onchange = () => { if (cb.checked) selectedPaths.add(path); else selectedPaths.delete(path);
        updateCateUI(); };
      const label = document.createElement('span'); label.textContent = node.cate_name; label.style.cssText = 'flex:1;color:#475569;cursor:pointer'; label.onclick = () => cb.click();
      div.appendChild(label); container.appendChild(div);
    }
  });
}

// ─── 数据存储 ───
const KEY="dy_monitor_data";let L=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){return{}}},S2=(d)=>localStorage.setItem(KEY,JSON.stringify(d));

// ─── 扫描页面商品 ───
function scan(){
const now=Date.now(),data=L();let n=0;
let r=document.querySelectorAll('tr.ecom-table-row, tr[data-row-key], tr[class*="ant-table-row"], .ant-table-row, tr[class*="product"], div[class*="product-item"], [data-testid*="product"], table tr');
if(!r||!r.length)r=document.querySelectorAll("[data-productid],[data-id]");
if(!r||!r.length)r=document.querySelectorAll("table tr");
if(!r||!r.length){const w=window.__NUXT__||window.__NEXT_DATA__||window.__INITIAL_STATE__;if(w)return extractObj(w,data,now)}
r.forEach((row,i)=>{
const id=row.getAttribute("data-row-key")||row.getAttribute("data-productid")||row.getAttribute("data-id")||row.getAttribute("id")||"r_"+i;
const nm=pT(row,['[class*="name"]','[class*="title"]','td:nth-child(2)','a']);
const pr=pN(row,['[class*="price"]','[class*="amount"]','td:nth-child(3)']);
const sa=pI(row,['[class*="sales"]','[class*="sold"]','[class*="volume"]','td:nth-child(4)']);
if(!id||!nm)return;if(!data[id])data[id]=[];data[id].push({t:now,r:i+1,p:pr,s:sa,_n:nm.trim(),_c:window._dyCurCate||''});if(data[id].length>50)data[id]=data[id].slice(-50);n++
});S2(data);if(n>0)dyLog("扫描到 "+n+" 个商品");return n}
function pT(e,s){for(const x of s){try{const c=e.querySelector(x);if(c&&c.textContent)return c.textContent.trim()}catch(e){}}return""}
function pN(e,s){const t=pT(e,s),m=t.match(/[\d.]+/);return m?parseFloat(m[0]):0}
function pI(e,s){const t=pT(e,s),m=t.replace(/,/g,"").match(/\d+/);return m?parseInt(m[0]):0}
function extractObj(o,d,now,dp){if(dp>6)return 0;let n=0;if(Array.isArray(o)){o.forEach(i=>{n+=extractObj(i,d,now,(dp||0)+1)})}else if(o&&typeof o==="object"){const pid=o.productId||o.product_id||o.itemId||o.id,pnm=o.productName||o.title||o.product_name||o.name;if(pid&&pnm&&typeof pnm==="string"){if(!d[pid])d[pid]=[];d[pid].push({t:now,r:o.rank||o.ranking||0,p:parseFloat(o.price||o.currentPrice||0),s:parseInt(o.sales||o.soldCount||0),_n:String(pnm).slice(0,100),_c:window._dyCurCate||''});if(d[pid].length>50)d[pid]=d[pid].slice(-50);n++}for(const k of Object.keys(o)){n+=extractObj(o[k],d,now,(dp||0)+1)}}return n}

// ─── 翻页 ───
function pagContainer(){return document.querySelector('.ecom-pagination,.ant-pagination,[class*="pagination"],[class*="Pagination"],[class*="page"][class*="list"]')}
function getPageItems(container){
  if(!container)return {items:[],lis:[]};
  const items=[],lis=[];
  container.querySelectorAll('a,button,span,div,li').forEach(el=>{
    const txt=(el.textContent||'').trim();
    if(/^\d+$/.test(txt)&&el.children.length===0){const n=parseInt(txt);if(n>=1&&n<=999)items.push({el,num:n})}
  });
  const seen=new Set(),unique=[];
  items.forEach(it=>{if(!seen.has(it.num)){seen.add(it.num);unique.push(it)}});
  return {items:unique, lis: Array.from(container.querySelectorAll('li'))};
}
function getPage(){
  try{
    const c=pagContainer();if(!c)return 1;
    const activeLi=c.querySelector('li.ecom-pagination-item-active,li.ant-pagination-item-active,li.active,li[class*="active"],li[class*="current"]');
    if(activeLi){const a=activeLi.querySelector('a');if(a){const n=parseInt(a.textContent);if(n>0)return n}const n=parseInt(activeLi.textContent);if(n>0)return n}
    const currentLi=c.querySelector('[aria-current="page"],[aria-current="true"]');
    if(currentLi){const a=currentLi.querySelector('a')||currentLi;const n=parseInt(a.textContent||a.getAttribute('title'));if(n>0)return n}
    const allLi=c.querySelectorAll('li');
    for(const li of allLi){const a=li.querySelector('a');if(!a)continue;const txt=(a.textContent||'').trim();
      if(!/^\d+$/.test(txt))continue;const aStyle=getComputedStyle(a);
      if(aStyle.color==='rgb(25, 102, 255)'||aStyle.color==='rgb(0, 102, 255)')return parseInt(txt)}
    const {items}=getPageItems(c);
    if(items.length>0)return Math.min(...items.map(i=>i.num));
  }catch(e){}return 1
}
function getTotal(){
  try{const c=pagContainer();if(!c)return 100;const {items}=getPageItems(c);if(items.length>0)return Math.min(Math.max(...items.map(i=>i.num)),500)}catch(e){}return 100
}
function nextBtn(){
  try{const c=pagContainer();if(!c)return null;
    const cur=getPage();
    const allLi=Array.from(c.querySelectorAll('li'));
    for(const li of allLi){const a=li.querySelector('a');if(!a)continue;const t=(a.textContent||'').trim();if((t==='>'||t==='›'||t==='❯')&&li.offsetParent!==null){return a}}
    const nextClsLi=c.querySelector('li.ecom-pagination-next,li.ant-pagination-next,[class*="next"]');
    if(nextClsLi){const a=nextClsLi.querySelector('a');if(a)return a;return nextClsLi}
    const {items}=getPageItems(c);
    for(const it of items){if(it.num===cur+1&&it.el.offsetParent!==null)return it.el}
    let best=null,bestN=Infinity;for(const it of items){if(it.num>cur&&it.num<bestN){bestN=it.num;best=it.el}}if(best)return best;
    const lastLi=allLi[allLi.length-1];if(lastLi&&lastLi.offsetParent!==null){const a=lastLi.querySelector('a');if(a)return a;return lastLi}
  }catch(e){}return null
}
function clickEl(el){try{el.click();return true}catch(e){}try{el.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));return true}catch(e){}return false}
function findNextInContainer(){const c=pagContainer();if(!c)return null;const allLi=Array.from(c.querySelectorAll('li'));
  // 找class含next的
  for(const li of allLi){const cls=li.className||'';if(cls.indexOf('next')>=0&&li.offsetParent!==null&&!cls.includes('disabled')){const a=li.querySelector('a');return a||li}}
  // 找 > 符号
  for(const li of allLi){const a=li.querySelector('a');if(!a)continue;const t=(a.textContent||'').trim();if((t==='>'||t==='›'||t==='❯')&&li.offsetParent!==null&&!li.classList.contains('ecom-pagination-disabled'))return a}
  // 最后可见li
  let lastVisible=null;
  for(let i=allLi.length-1;i>=0;i--){const li=allLi[i];if(li.offsetParent===null)continue;const a=li.querySelector('a');if(!a)continue;const t=(a.textContent||'').trim();if(/^\d+$/.test(t))break;if(t!=='<'&&t!=='‹'){lastVisible=li;break}}
  if(lastVisible){const a=lastVisible.querySelector('a');if(a&&!a.disabled)return a;return lastVisible}return null;
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

// ─── 全量扫描（含类目切换）───
async function scanAll(prog){
_stopScan=false;
let totalAll=0;
let cateQueue = [];
if (selectedPaths.size > 0) {
  cateQueue = [...selectedPaths].map(p => ({ path: p.split('>'), pathStr: p }));
} else {
  cateQueue = [{ path: [], pathStr: '' }];
}
for (let ci = 0; ci < cateQueue.length && !_stopScan; ci++) {
  const cateItem = cateQueue[ci];
  if (cateItem.path.length > 0 && cateItem.path[0] !== '') {
    console.log("[抖音监控] 切类目:", cateItem.pathStr); dyLog("切换类目: " + cateItem.pathStr);
    try { await selectCategoryViaCascader(cateItem.path); } catch(e) { console.log("[抖音监控] 切类目失败:", e.message); dyLog("切类目失败: " + e.message); continue; }
  }
  window._dyCurCate = cateItem.pathStr || '';
  const ul=document.querySelector('.ecom-pagination,[class*="pagination"]');
  if(!ul){console.log("[抖音监控] 无分页");continue}
  const firstA=ul.querySelector('li:first-child a');
  if(firstA&&firstA.textContent.trim()==='1'){firstA.click();await sleep(2000)}else{
    const allA=ul.querySelectorAll('a');let found=false;
    for(const a of allA){if(a.textContent.trim()==='1'){a.click();await sleep(2000);found=true;break}}
    if(!found)continue
  }
  let c=scan();let total=c;let lastNum=1;
  for(let loop=0;loop<100;loop++){
    if(_stopScan)break;
    // 每轮重新获取分页容器（Vue 翻页后会重建 DOM）
    const ul2 = document.querySelector('.ecom-pagination,[class*="pagination"]');
    if (!ul2) {dyLog("  分页容器丢失");break;}
    const as=ul2.querySelectorAll('a');const nums=[];const els={};
    as.forEach(a=>{const t=a.textContent.trim();if(/^\d+$/.test(t)){const n=parseInt(t);nums.push(n);if(!els[n])els[n]=a}});
    if(nums.length===0){dyLog("  无页码按钮(共1页?)，结束翻页");break}
    const nextNums=nums.filter(n=>n>lastNum).sort((a,b)=>a-b);
    if(nextNums.length===0){const nA=ul2.querySelector('[class*="next"] a,li:last-child a');if(nA&&(nA.textContent.trim()==='>'||nA.textContent.trim()==='›'))nA.click();else{dyLog("  无下一页，结束翻页");break;}}
    else{const nA=els[nextNums[0]];if(!nA)break;nA.click();dyLog("  翻到第"+nextNums[0]+"页");}
    await sleep(3000);
    for(let w=0;w<20;w++){await sleep(800);const rows=document.querySelectorAll('tr[data-row-key],.ant-table-row,table tr');if(rows.length>5)break}
    c=scan();total+=c;
    // 检测当前页——优先用 active 类，其次用颜色
    const newUl = document.querySelector('.ecom-pagination,[class*="pagination"]');
    if (newUl) {
      const activeLi = newUl.querySelector('li.ecom-pagination-item-active, li.ant-pagination-item-active, li.active, li[class*="active"], li[class*="current"]');
      if (activeLi) {
        const aEl = activeLi.querySelector('a');
        lastNum = parseInt(aEl ? aEl.textContent : activeLi.textContent) || lastNum;
      } else {
        // 用颜色检测（容许多种蓝色）
        const allAs = newUl.querySelectorAll('a');
        allAs.forEach(a => {
          const t = a.textContent.trim();
          if (/^\d+$/.test(t)) {
            const s = getComputedStyle(a);
            const c = s.color;
            // 匹配常见的 Ant Design 蓝色
            if (c.includes('24, 144, 255') || c.includes('25, 102, 255') || c.includes('0, 102, 255') || c.includes('22, 119, 255')) {
              lastNum = parseInt(t);
            }
          }
        });
      }
    }
    dyLog("  当前页:"+lastNum+" 累计:"+total);
    if(c===0&&nextNums.length===0)break
  }
  totalAll += total;
}
return totalAll}

// ─── 调试 ───
function debugBtn(){
  console.log("[抖音监控] =========== 全面调试 ===========");
  const cur=getPage(),tot=getTotal();
  console.log("[抖音监控] 当前页:",cur,"总页:",tot);
  const c=pagContainer();
  if(c){
    console.log("[抖音监控] 分页容器:",c.tagName,'#'+(c.id||''),'.'+(c.className||'').slice(0,80));
    const {items}=getPageItems(c);
    console.log("[抖音监控] 页码:",items.map(i=>i.num));
    const lis=Array.from(c.querySelectorAll('li'));
    lis.forEach((li,i)=>{const txt=(li.textContent||'').trim().slice(0,15);console.log("  li["+i+"] cls:",(li.className||'').slice(0,60),"txt:",txt,"vis:",li.offsetParent!==null);
      Array.from(li.children).forEach((ch,j)=>{const ct=(ch.textContent||'').trim().slice(0,15);console.log("    >["+j+"]",ch.tagName,'cls:'+(ch.className||'').slice(0,40),'txt:'+ct,'vis:',ch.offsetParent!==null)})});
    const nbtn=nextBtn();console.log("[抖音监控] nextBtn:",nbtn?nbtn.tagName+(nbtn.className?' .'+(nbtn.className||'').slice(0,40):'')+(nbtn?' txt:'+(nbtn.textContent||'').trim().slice(0,10):'')+ ' vis:'+(nbtn?nbtn.offsetParent!==null:'') :'null');
    const allCs=document.querySelectorAll('.ecom-pagination,[class*="pagination"],[class*="Pagination"]');
    if(allCs.length>1)console.log("[抖音监控] 注意: 有",allCs.length,"个分页容器!");
  }else{console.log("[抖音监控] 未找到分页容器")}
  console.log("[抖音监控] =========== 结束 ===========");
}

// ─── 面板 ───
let panel=null,toggle=null,visible=false,scanning=false,_stopScan=false,autoTimer=null,autoCountdown=0;
const CFG_KEY="dy_monitor_cfg",BASE_KEY="dy_monitor_baseline",NEWP_KEY="dy_monitor_newproducts";
function getCfg(){try{return JSON.parse(localStorage.getItem(CFG_KEY)||"{}")}catch(e){return{}}}
function setCfg(d){localStorage.setItem(CFG_KEY,JSON.stringify(d))}
function getBase(){try{return JSON.parse(localStorage.getItem(BASE_KEY)||"null")}catch(e){return null}}
function setBase(d){localStorage.setItem(BASE_KEY,JSON.stringify(d))}
function getNewProducts(){try{return JSON.parse(localStorage.getItem(NEWP_KEY)||"[]")}catch(e){return[]}}
function setNewProducts(d){localStorage.setItem(NEWP_KEY,JSON.stringify(d))}

function build(){
  const h=L(),now=Date.now();const base=getBase();const baseIds=new Set(base?base.ids:[]);const baseAux=new Set(base?base.aux:[]);
  const uniqueMap=new Map();
  Object.entries(h).forEach(([id,es])=>{const sorted=es.sort((a,b)=>a.t-b.t);const lt=sorted[sorted.length-1];if(!lt||!lt._n)return;
    const namePrefix=lt._n.trim().slice(0,15);const price=lt.p||0;const key=namePrefix+'|'+price.toFixed(2);
    if(!uniqueMap.has(key)||lt.t>uniqueMap.get(key).lt.t)uniqueMap.set(key,{id,es,lt,name:lt._n})});
  const items=[];
  uniqueMap.forEach(({id,es,lt,name})=>{const namePrefix=name.slice(0,15);const price=lt.p||0;
    let isNewListed=true;
    if(base){if(baseIds.has(id)){isNewListed=false}else{for(const aux of baseAux){const parts=aux.split('|');if(parts.length===2){const bn=parts[0],bp=parseFloat(parts[1])||0;if(bn.slice(0,15)===namePrefix&&(bp===0&&price===0||bp>0&&price>0&&Math.abs(bp-price)/Math.max(bp,price)<0.05)){isNewListed=false;break}}}}}
    let ch="",bc="";
    if(es.length>=2){const pv=es[es.length-2];if(pv&&pv.r!==undefined&&lt.r!==undefined){const df=pv.r-lt.r;if(df>0){ch="↑"+df;bc="u"}else if(df<0){ch="↓"+Math.abs(df);bc="d"}}}
    items.push({id,name,price,sales:lt.s||0,rank:lt.r||0,isNewListed,ch,bc})});
  items.sort((a,b)=>(a.rank||999)-(b.rank||999));return items;
}
function autoUpdateBaseline(){
  const h=L();const ids=[],aux=[];const seen=new Map();
  Object.entries(h).forEach(([id,es])=>{const sorted=es.sort((a,b)=>a.t-b.t);const lt=sorted[sorted.length-1];if(!lt||!lt._n)return;
    const key=(lt._n.trim().slice(0,15)+'|'+(lt.p||0).toFixed(2));
    if(!seen.has(key)||lt.t>seen.get(key).t)seen.set(key,{t:lt.t,id:id,name:lt._n,price:lt.p})});
  seen.forEach(v=>{ids.push(v.id);aux.push(v.name.trim()+'|'+v.price.toFixed(2))});
  if(ids.length>0){setBase({ids,aux,time:Date.now(),count:ids.length});console.log("[抖音监控] 基准更新:",ids.length+"个")}
}
function saveBaseline(){const h=L();const ids=[],aux=[];Object.entries(h).forEach(([id,es])=>{const lt=es[es.length-1];if(lt&&lt._n&&lt.p!==undefined){ids.push(id);aux.push((lt._n.trim()+'|'+lt.p.toFixed(2)))}});if(ids.length===0){alert("无数据");return}setBase({ids,aux,time:Date.now(),count:ids.length});render();upd();alert("基准已保存: "+ids.length+"个")}
function toggleP(){visible=!visible;panel.classList.toggle("show",visible);toggle.classList.toggle("hide",visible);if(visible){render();upd();updAutoBtn()}}
function render(){const el=document.getElementById("dy-list");if(el)el.innerHTML=''}
function upd(){const el=document.getElementById("dy-stats");if(!el)return;const items=build(),base=getBase();el.innerHTML='<div class="c"><span class="n">'+items.length+'</span><span class="l">商品</span></div><div class="c"><span class="n" style="color:#666">'+(base?base.count:'无')+'</span><span class="l">基准</span></div>'}
function exp(){const data=L(),csv=["id,time,rank,price,sales"];Object.entries(data).forEach(([id,es])=>{(es||[]).forEach(e=>{csv.push(id+","+new Date(e.t).toISOString()+","+(e.r||"")+","+(e.p||0)+","+(e.s||0))})});const blob=new Blob([csv.join("\n")],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="douyin_"+Date.now()+".csv";a.click()}
function esc(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML}
function updAutoBtn(){const btn=document.getElementById("dy-auto");if(!btn)return;const cfg=getCfg();if(autoTimer){const m=Math.floor(autoCountdown/60),s=autoCountdown%60;btn.textContent="⏸ "+m+"分"+s+"秒";btn.className="p"}else{btn.textContent=cfg.interval?"▶ "+cfg.interval+"分钟":"▶ 自动";btn.className="s"}}
function startAuto(){const cfg=getCfg();const interval=(cfg.interval||10)*60*1000;if(autoTimer){clearInterval(autoTimer);autoTimer=null}autoCountdown=Math.floor(interval/1000);autoTimer=setInterval(()=>{autoCountdown--;updAutoBtn();if(autoCountdown===10){refreshTimeFilter()}if(autoCountdown<=0){const btn=document.getElementById("dy-scan");if(btn&&!scanning)btn.click();const cfg2=getCfg();autoCountdown=Math.floor((cfg2.interval||10)*60)}},1000);updAutoBtn()}
function refreshTimeFilter(){
  dyLog("自动刷新: 点击近一天→实时");
  // 找"近1天"或"近一天"按钮
  const allEls=document.querySelectorAll('span,div,button,a,label');
  let jinyi=null,shishi=null;
  allEls.forEach(el=>{
    const t=(el.textContent||'').trim();
    if(t==='近一天'||t==='近1天')jinyi=el;
    if(t==='实时')shishi=el;
  });
  if(jinyi){jinyi.click();dyLog("  点击近一天")}
  setTimeout(()=>{
    if(shishi){shishi.click();dyLog("  点击实时")}
  },500);
}
function goSearchProduct(productId){
  dyLog("搜索商品: "+productId);
  // 找搜索输入框（placeholder含"商品名"或"搜索"）
  let input=null;
  const allInputs=document.querySelectorAll('input[type="text"],input:not([type]),textarea');
  allInputs.forEach(el=>{
    const ph=(el.placeholder||'').trim();
    if(ph.indexOf('商品名')>=0||ph.indexOf('搜索')>=0||ph.indexOf('商品ID')>=0||ph.indexOf('商品标题')>=0){input=el}
  });
  if(!input){dyLog("  未找到搜索框");alert("未找到商品搜索框");return}
  // 聚焦并设置值
  input.focus();
  input.value=productId;
  // 触发Vue/React框架的事件
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  // 模拟回车
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  input.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  input.dispatchEvent(new KeyboardEvent('keypress',{key:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  dyLog("  已填入搜索框并回车");
}
function stopAuto(){if(autoTimer){clearInterval(autoTimer);autoTimer=null}updAutoBtn()}
function toggleAuto(){if(autoTimer){stopAuto()}else{startAuto()}}
function showNewList(){const list=getNewProducts();if(list.length===0){alert("暂无新上榜记录");return}
  const mask=document.createElement("div");mask.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999999;display:flex;align-items:center;justify-content:center';
  const box=document.createElement("div");box.style.cssText='background:#fff;color:#333;border-radius:12px;width:90%;max-width:700px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.25)';
  const hdr=document.createElement("div");hdr.style.cssText='padding:12px 16px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center';
  hdr.innerHTML='<h3 style="margin:0;font-size:15px">✨ 新上榜商品记录</h3><button id="dy-newclose" style="background:none;border:none;cursor:pointer;font-size:18px;color:#999;padding:2px 6px">✕</button>';box.appendChild(hdr);
  const content=document.createElement("div");content.style.cssText='flex:1;overflow-y:auto;padding:8px 12px';
  list.forEach((batch,bIdx)=>{const batchDiv=document.createElement("div");batchDiv.style.cssText='margin-bottom:12px;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden';
    const bTitle=document.createElement("div");bTitle.style.cssText='padding:8px 12px;background:#f8f9fa;font-size:13px;font-weight:500;display:flex;justify-content:space-between';
    bTitle.innerHTML='<span>第'+(bIdx+1)+'次 · '+batch.time+'</span><span style="color:#e65100">'+batch.count+'个新商品</span>';batchDiv.appendChild(bTitle);
    batch.items.forEach((item,i)=>{const pureId=(item.id||'').replace(/_\d+$/,'');const row=document.createElement("div");row.style.cssText='padding:6px 12px;border-top:1px solid #f0f0f0;font-size:12px;display:flex;gap:10px;align-items:center';
      // ID可点击复制
      const idSpan=document.createElement('span');
      idSpan.textContent=pureId;
      idSpan.style.cssText='cursor:pointer;font-size:10px;color:#4f6ef7;background:#f0f0f0;padding:1px 6px;border-radius:4px;white-space:nowrap;font-weight:600;user-select:none;transition:all .2s';
      idSpan.title='点击复制ID并搜索';
      idSpan.onclick=function(){const t=this;const txt=pureId;navigator.clipboard.writeText(txt).then(function(){t.textContent='🔍 搜索中';t.style.background='#bbdefb';t.style.color='#1565c0';setTimeout(function(){t.textContent=txt;t.style.background='#f0f0f0';t.style.color='#4f6ef7'},2000)}).catch(function(){});goSearchProduct(txt)};
      row.appendChild(document.createElement('span')).textContent=(i+1)+'.';
      row.lastChild.style.cssText='color:#999;min-width:24px';
      row.appendChild(idSpan);
      const nameSpan=document.createElement('span');nameSpan.textContent=item.name;nameSpan.style.cssText='flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';row.appendChild(nameSpan);
      const priceSpan=document.createElement('span');priceSpan.textContent='¥'+item.price.toFixed(2);priceSpan.style.cssText='color:#e65100;font-weight:600;min-width:60px';row.appendChild(priceSpan);
      const salesSpan=document.createElement('span');salesSpan.textContent='销量 '+item.sales;salesSpan.style.cssText='color:#999;min-width:50px';row.appendChild(salesSpan);
      const cateSpan=document.createElement('span');cateSpan.textContent=(item.cate||'全部').replace(/>/g,' > ');cateSpan.style.cssText='color:#888;font-size:10px;background:#f5f5f5;padding:1px 6px;border-radius:4px;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis';cateSpan.title='类目: '+(item.cate||'全部');row.appendChild(cateSpan);
      batchDiv.appendChild(row)});content.appendChild(batchDiv)});
  box.appendChild(content);
  const footer=document.createElement("div");footer.style.cssText='padding:10px 16px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end';
  const clrBtn=document.createElement("button");clrBtn.textContent='🗑️ 清空记录';clrBtn.style.cssText='padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:12px;background:#fbe9e7;color:#c62828';
  clrBtn.onclick=function(){if(confirm("清空所有新上榜记录?")){setNewProducts([]);box.remove();mask.remove()}};footer.appendChild(clrBtn);
  const expBtn=document.createElement("button");expBtn.textContent='📤 导出CSV';expBtn.style.cssText='padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:12px;background:#e3f2fd;color:#1565c0';
  expBtn.onclick=function(){let csv='批次,时间,ID,名称,价格,销量,类目\n';list.forEach((b,bi)=>{b.items.forEach(item=>{csv+=(bi+1)+','+b.time+','+(item.id||'').replace(/_\d+$/,'')+','+item.name+','+item.price+','+item.sales+','+(item.cate||'全部')+'\n'})});const blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='新上榜_'+Date.now()+'.csv';a.click()};
  footer.appendChild(expBtn);box.appendChild(footer);mask.appendChild(box);document.body.appendChild(mask);
  document.getElementById("dy-newclose").onclick=function(){mask.remove()};mask.onclick=function(e){if(e.target===mask)mask.remove()};
}
function showBaseline(){
  const base = getBase();
  if (!base || !base.aux || base.aux.length === 0) { alert("暂无基准数据"); return; }
  // 从原始数据中查找完整名称和ID
  const rawData = L();
  const items = (base.ids || []).map((id, i) => {
    const auxParts = (base.aux[i] || '').split('|');
    const auxName = auxParts[0] || '未知';
    const auxPrice = parseFloat(auxParts[1]) || 0;
    // 从原始数据查找完整商品标题
    let fullName = auxName;
    if (rawData[id]) {
      const sorted = [...rawData[id]].sort((a,b) => a.t - b.t);
      const lt = sorted[sorted.length - 1];
      if (lt && lt._n) fullName = lt._n.trim();
    }
    return { id, name: fullName, price: auxPrice, pureId: id.replace(/_\d+$/, '') };
  });
  const mask=document.createElement("div");mask.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999999;display:flex;align-items:center;justify-content:center';
  const box=document.createElement("div");box.style.cssText='background:#fff;color:#333;border-radius:12px;width:90%;max-width:700px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.25)';
  const hdr=document.createElement("div");hdr.style.cssText='padding:12px 16px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center';
  hdr.innerHTML='<h3 style="margin:0;font-size:15px">📋 基准商品列表</h3><button id="dy-baseclose" style="background:none;border:none;cursor:pointer;font-size:18px;color:#999;padding:2px 6px">✕</button>';box.appendChild(hdr);
  const content=document.createElement("div");content.style.cssText='flex:1;overflow-y:auto;padding:8px 12px';
  const info = document.createElement("div");info.style.cssText='padding:8px 12px;background:#f8f9fa;border-radius:8px;font-size:12px;color:#666;margin-bottom:8px';
  info.innerHTML = '共 <b>' + base.count + '</b> 个商品 · 保存时间: ' + new Date(base.time).toLocaleString();
  content.appendChild(info);
  items.forEach((item,i)=>{const row=document.createElement("div");row.style.cssText='padding:6px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;display:flex;gap:10px;align-items:center';
    // 序号
    const idxSpan=document.createElement('span');idxSpan.textContent=String(i+1);idxSpan.style.cssText='color:#999;min-width:24px';row.appendChild(idxSpan);
    // 可点击复制的ID
    const idSpan=document.createElement('span');
    idSpan.textContent=item.pureId;
    idSpan.style.cssText='cursor:pointer;font-size:10px;color:#4f6ef7;background:#f0f0f0;padding:1px 6px;border-radius:4px;white-space:nowrap;font-weight:600;user-select:none;transition:all .2s';
    idSpan.title='点击复制ID并搜索';
    idSpan.onclick=function(){const t=this;const txt=item.pureId;navigator.clipboard.writeText(txt).then(function(){t.textContent='🔍 搜索中';t.style.background='#bbdefb';t.style.color='#1565c0';setTimeout(function(){t.textContent=txt;t.style.background='#f0f0f0';t.style.color='#4f6ef7'},2000)}).catch(function(){});goSearchProduct(txt)};
    row.appendChild(idSpan);
    // 名称（可悬浮看完整）
    const nameSpan=document.createElement('span');
    nameSpan.textContent=item.name;
    nameSpan.style.cssText='flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    nameSpan.title=item.name;
    row.appendChild(nameSpan);
    // 价格
    const priceSpan=document.createElement('span');
    priceSpan.textContent='¥'+item.price.toFixed(2);
    priceSpan.style.cssText='color:#1a73e8;font-weight:600;min-width:60px;text-align:right';
    row.appendChild(priceSpan);
    content.appendChild(row)});
  box.appendChild(content);
  const footer=document.createElement("div");footer.style.cssText='padding:10px 16px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end';
  const clrBtn=document.createElement("button");clrBtn.textContent='🗑️ 清除基准';clrBtn.style.cssText='padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:12px;background:#fbe9e7;color:#c62828';
  clrBtn.onclick=function(){if(confirm("清除基准?")){localStorage.removeItem(BASE_KEY);mask.remove();upd();}};footer.appendChild(clrBtn);
  const closeBtn=document.createElement("button");closeBtn.textContent='关闭';closeBtn.style.cssText='padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:12px;background:#f0f0f0';
  closeBtn.onclick=function(){mask.remove()};footer.appendChild(closeBtn);
  box.appendChild(footer);mask.appendChild(box);document.body.appendChild(mask);
  document.getElementById("dy-baseclose").onclick=function(){mask.remove()};mask.onclick=function(e){if(e.target===mask)mask.remove()};
}

// ─── 初始化 ───
function init(){
  if(panel)return;
  toggle=document.createElement("button");toggle.id="dy-toggle";toggle.textContent="📊";toggle.title="面板 (Alt+M)";toggle.onclick=toggleP;document.body.appendChild(toggle);
  panel=document.createElement("div");panel.id="dy-panel";
  // 内联样式（兼容旧版）
  const s=document.createElement("style");s.textContent='#dy-panel{position:fixed;top:80px;right:20px;width:360px;max-height:80vh;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;display:none;flex-direction:column;border:1px solid #e8e8e8;overflow-y:auto}#dy-panel.show{display:flex}#dy-panel .h{padding:14px 16px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;background:#fafbfc;border-radius:16px 16px 0 0}#dy-panel .h h3{margin:0;font-size:15px;font-weight:600;color:#1a1a2e}#dy-panel .h button{background:none;border:none;cursor:pointer;font-size:16px;padding:4px 8px;color:#999;border-radius:6px;transition:all .15s}#dy-panel .h button:hover{background:#e8e8e8;color:#666;transform:scale(1.05)}#dy-panel .h button:active{transform:scale(.95)}#dy-panel .s{padding:12px 16px;display:flex;gap:10px;border-bottom:1px solid #f0f0f0}#dy-panel .s .c{flex:1;text-align:center;padding:8px 4px;background:#f8f9fa;border-radius:10px;transition:all .2s}#dy-panel .s .c:hover{background:#eef1f5;transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.06)}#dy-panel .s .c .n{font-size:20px;font-weight:700;color:#1a73e8;display:block;line-height:1.3}#dy-panel .s .c .l{font-size:11px;color:#888;margin-top:2px;display:block}#dy-panel .f{padding:10px 12px;border-top:1px solid #f0f0f0;display:flex;gap:6px;flex-wrap:wrap;justify-content:center}#dy-panel .f button{padding:7px 14px;border:none;border-radius:8px;cursor:pointer;font-size:12px;min-width:56px;font-weight:500;transition:all .15s;user-select:none}#dy-panel .f button:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.1)}#dy-panel .f button:active{transform:translateY(0) scale(.97)}#dy-panel .f .p{background:#1a73e8;color:#fff}#dy-panel .f .p:hover{background:#1557b0;box-shadow:0 2px 12px rgba(26,115,232,.35)}#dy-panel .f .s{background:#f2f3f5;color:#333}#dy-panel .f .s:hover{background:#e4e6e8;box-shadow:0 2px 8px rgba(0,0,0,.08)}#dy-panel .f .p:disabled{opacity:.6;cursor:wait;transform:none;box-shadow:none}#dy-panel .f .s:disabled{opacity:.6;cursor:wait;transform:none;box-shadow:none}#dy-panel #dy-log-bar{animation:dyLogPulse .3s}#dy-panel input[type=number]:focus{border-color:#1a73e8!important;box-shadow:0 0 0 2px rgba(26,115,232,.15)}#dy-panel input[type=number]:hover{border-color:#bbb}#dy-toggle{position:fixed;bottom:20px;right:20px;z-index:999998;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#1a73e8,#1557b0);color:#fff;font-size:20px;border:none;box-shadow:0 4px 16px rgba(26,115,232,.4);cursor:pointer;transition:all .25s;display:flex;align-items:center;justify-content:center}#dy-toggle:hover{transform:scale(1.12);box-shadow:0 6px 20px rgba(26,115,232,.5)}#dy-toggle:active{transform:scale(.95)}@keyframes dyLogPulse{0%{background:#fffbe6}50%{background:#fff3cd}100%{background:#fffbe6}}#dy-toggle.hide{display:none}';
  document.head.appendChild(s);
  panel.innerHTML='<div class="h"><h3>🎯 榜单监控</h3><button id="dy-close">✕</button></div><div class="s" id="dy-stats"></div><div id="dy-log-bar" style="display:none;padding:4px 16px;font-size:11px;color:#666;background:#fffbe6;border-bottom:1px solid #f0f0f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div><div id="dy-cate-picker" style="padding:0 16px 6px"></div><div id="dy-list" style="display:none"></div>'
    + '<div class="f"><button class="p" id="dy-scan" style="flex:1;padding:8px 14px;font-size:13px">📄 全量扫描</button><button class="s" id="dy-stop" style="display:none;padding:8px 14px;font-size:13px">⏹ 停止</button></div>'
    + '<div class="f" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;padding:8px 12px"><button class="s" id="dy-clr">🗑️ 清除</button><button class="s" id="dy-baseclr" style="color:#c62828">❌ 清基准</button><button class="s" id="dy-viewbase">📋 查看基准</button><button class="p" id="dy-newlist">✨ 新上榜</button></div>'
    + '<div class="f" style="display:flex;align-items:center;gap:8px;padding:6px 12px"><button class="s" id="dy-auto" style="flex:none;padding:6px 16px">▶ 自动</button><span style="font-size:11px;color:#999">间隔</span><input id="dy-interval" type="number" min="1" max="1440" value="10" style="width:50px;height:26px;font-size:11px;border:1px solid #ddd;border-radius:6px;text-align:center;padding:0;background:#fff;color:#333;outline:none;transition:border-color .15s"><span style="font-size:11px;color:#999">分钟</span></div>';
  document.body.appendChild(panel);

  // 渲染类目选择器
  renderCatePicker();
  document.getElementById("dy-newlist").onclick=function(){showNewList()};
  document.getElementById("dy-auto").onclick=toggleAuto;
  document.getElementById("dy-interval").onchange=function(){const v=parseInt(this.value)||10;if(v<1)this.value=1;if(v>1440)this.value=1440;const cfg=getCfg();cfg.interval=parseInt(this.value);setCfg(cfg);if(autoTimer){stopAuto();startAuto()}};
  const cfg=getCfg();if(cfg.interval){const inp=document.getElementById("dy-interval");if(inp)inp.value=cfg.interval}
  let x1,y1;const hdr=panel.querySelector(".h");hdr.onmousedown=function(e){e.preventDefault();x1=e.clientX-panel.offsetLeft;y1=e.clientY-panel.offsetTop;document.onmousemove=function(ev){panel.style.left=ev.clientX-x1+"px";panel.style.top=ev.clientY-y1+"px";panel.style.right="auto"};document.onmouseup=function(){document.onmousemove=null}};
  console.log("[抖音监控] 面板就绪"); dyLog("面板已加载")

  // ---- 补全遗漏的事件绑定 ----
  document.getElementById("dy-close").onclick=toggleP;
  document.getElementById("dy-stop").onclick=function(){_stopScan=true;this.style.display='none';scanning=false};
  document.getElementById("dy-baseclr").onclick=function(){if(confirm("清除基准?")){localStorage.removeItem(BASE_KEY);render();upd();alert("基准已清除")}};
  document.getElementById("dy-clr").onclick=function(){if(confirm("清除所有数据?")){localStorage.removeItem(KEY);render();upd()}};
  document.getElementById("dy-viewbase").onclick=function(){showBaseline()};
  document.getElementById("dy-scan").onclick=async function(){if(scanning)return;scanning=true;this.disabled=true;this.textContent="⏳ 扫描中...";const sb=document.getElementById("dy-stop");if(sb)sb.style.display='inline-block';_stopScan=false;const t=await scanAll(function(p,c){const b=document.getElementById("dy-scan");if(b)b.textContent="⏳ 扫描中 ("+c+"个)";render();upd()});this.textContent="✅ 完成 "+t+"个";if(sb)sb.style.display='none';scanning=false;if(t>0){const before=getBase();autoUpdateBaseline();const after=getBase();if(before&&after){const bIds=new Set(before.ids),bAux=new Set(before.aux);const h=L(),added=[];Object.entries(h).forEach(([id,es])=>{const sorted=es.sort((a,b)=>a.t-b.t);const lt=sorted[sorted.length-1];if(!lt||!lt._n)return;const nameP=lt._n.trim().slice(0,15),price=lt.p||0;let isNew=true;if(bIds.has(id))isNew=false;else{for(const aux of bAux){const p=aux.split('|');if(p.length===2&&p[0].slice(0,15)===nameP){const bp=parseFloat(p[1])||0;if((bp===0&&price===0)||(bp>0&&price>0&&Math.abs(bp-price)/Math.max(bp,price)<0.05)){isNew=false;break}}}}if(isNew){added.push({id,name:lt._n,price,sales:lt.s||0,rank:lt.r||0,cate:lt._c||'',time:new Date().toLocaleString()})}});if(added.length>0){const list=getNewProducts();list.unshift({batch:list.length+1,count:added.length,time:new Date().toLocaleString(),items:added});setNewProducts(list.slice(0,50))}}render();upd()}else{render();upd()};setTimeout(()=>{this.textContent="📄 全量扫描";this.disabled=false},2000)};

}
document.addEventListener("keydown",function(e){if(e.altKey&&e.key==="m"){e.preventDefault();toggleP()}});
init();setTimeout(()=>{const c=scan();if(c>0){render();upd()}},3000);dyLog("初始化完成")})();