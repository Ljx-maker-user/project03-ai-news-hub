(async function(){
  // 配置：如已部署 Twikoo，请把 envId 填入下方以启用线上评论（推荐）
  const TWIKOO_ENVID = ''; // 例如 'your-twikoo-envId'
  const RAW_ARTICLES_URL = 'https://raw.githubusercontent.com/Ljx-maker-user/project03-ai-news-hub/main/articles.json';
  const PAGE_SIZE = 20;

  // 加载数据：优先尝试本地相对路径，再回退到仓库 raw 链接
  async function tryFetch(url){
    try{ const r = await fetch(url); if(!r.ok) throw new Error('fetch failed'); return await r.json(); }catch(e){ console.warn('fetch fail', url, e); throw e }
  }

  let remoteData = [];
  try{ remoteData = await tryFetch('articles.json'); }
  catch(e){
    try{ remoteData = await tryFetch(RAW_ARTICLES_URL); }
    catch(e2){ remoteData = []; console.warn('无法读取 articles.json（本地或远端）'); }
  }

  // 本地发布示例（localStorage）
  const localPosts = JSON.parse(localStorage.getItem('localPosts') || '[]');
  localPosts.forEach(p=> p.isLocal = true);

  // 合并数据（本地发布优先）
  let data = localPosts.concat(remoteData || []);

  // 顶部常用模块顺序（按需求排序）
  const topModules = [
    "大模型与基础技术",
    "应用落地",
    "前沿探索",
    "基础设施与工具",
    "2025 年最热细分赛道"
  ];

  // DOM 引用
  const moduleSelect = document.getElementById('moduleFilter');
  const topnav = document.getElementById('topnav');
  const headerSearch = document.getElementById('headerSearch');
  const searchInput = document.getElementById('search');
  const articlesEl = document.getElementById('articles');
  const tpl = document.getElementById('article-template');
  const submodulesEl = document.getElementById('submodules');
  const rankEl = document.getElementById('rankList');
  const loadMoreBtn = document.getElementById('loadMore');

  // 计算模块列表并渲染到下拉与顶部导航
  const moduleSet = Array.from(new Set(data.map(a=>a.module).filter(Boolean)));
  const modules = Array.from(new Set(topModules.concat(moduleSet))).filter(Boolean);
  modules.sort((a,b)=>{ const ia = topModules.indexOf(a), ib = topModules.indexOf(b); if(ia!==-1||ib!==-1) return (ia===-1?999:ia)-(ib===-1?999:ib); return a.localeCompare(b,'zh-CN'); });
  modules.forEach(m=>{ const o = document.createElement('option'); o.value = m; o.textContent = m; moduleSelect.appendChild(o); });

  // top nav
  const homeLink = document.createElement('a'); homeLink.href='#'; homeLink.className='nav-link active'; homeLink.textContent='首页'; topnav.appendChild(homeLink);
  modules.forEach(m=>{ const a = document.createElement('a'); a.href='#'; a.className='nav-link'; a.textContent = m; a.addEventListener('click', (e)=>{ e.preventDefault(); setModuleFilter(m); }); topnav.appendChild(a); });

  // 过滤 / 分页 状态
  let filtered = data.slice();
  let currentPage = 1;

  // 工具函数
  function isChinese(text){ return /[\u4e00-\u9fff]/.test(text||''); }
  function stripHtml(s){ if(!s) return ''; return s.replace(/<[^>]+>/g,''); }

  // 翻译（按需，使用 MyMemory 简易 API，可能有速率限制），结果缓存到 sessionStorage  
  async function translateText(text){
    if(!text) return '';
    const key = 'tr_' + encodeURIComponent(text).slice(0,200);
    const cached = sessionStorage.getItem(key); if(cached) return cached;
    try{
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|zh-CN';
      const r = await fetch(url); const j = await r.json(); const t = (j && j.responseData && j.responseData.translatedText) || '';
      if(t) sessionStorage.setItem(key,t);
      return t;
    }catch(e){ console.warn('translate failed', e); return ''; }
  }

  // 渲染当前页（按 currentPage）
  function renderPage(){
    articlesEl.innerHTML = '';
    const start = 0;
    const list = filtered.slice(start, currentPage * PAGE_SIZE);
    list.forEach((a,i)=> renderArticle(a, i));
    // Load more 按钮显示逻辑
    if(filtered.length > currentPage * PAGE_SIZE){ loadMoreBtn.style.display = 'inline-block'; } else { loadMoreBtn.style.display = 'none'; }
  }

  function renderArticle(a, idx){
    const node = tpl.content.cloneNode(true);
    const art = node.querySelector('.article-card');
    const titleEl = art.querySelector('.title');
    titleEl.textContent = a.title || '无标题';
    titleEl.href = a.link || '#';
    art.querySelector('.meta').textContent = `${a.source||''} · ${formatDate(a.published)} · ${a.author||''} · ${a.module||''}`;
    art.querySelector('.summary').textContent = stripHtml(a.summary) || '';
    const avatar = art.querySelector('.avatar'); avatar.textContent = (a.author? a.author.trim()[0].toUpperCase() : (a.source? a.source.trim()[0].toUpperCase() : 'A'));

    const viewBtn = art.querySelector('.view-btn');
    const translateBtn = art.querySelector('.translate-btn');

    // 如果内容已经包含中文，则隐藏翻译按钮
    if(isChinese(a.title) || isChinese(a.summary)) translateBtn.style.display='none';

    viewBtn.addEventListener('click', ()=> openArticleModal(a));
    translateBtn.addEventListener('click', async (e)=>{
      translateBtn.textContent = '翻译中…';
      const titleT = await translateText(a.title || '');
      const summaryT = await translateText(stripHtml(a.summary) || '');
      if(titleT) titleEl.textContent = titleT;
      if(summaryT) art.querySelector('.summary').textContent = summaryT;
      translateBtn.textContent = '已翻译';
    });

    articlesEl.appendChild(node);
  }

  function formatDate(s){ if(!s) return ''; try{ const d = new Date(s); if(isNaN(d)) return s; return d.toLocaleString('zh-CN',{month:'numeric',day:'numeric'}); }catch(e){ return s; } }

  // 子模块（标签/细分）渲染
  function renderSubmodules(selectedModule){
    submodulesEl.innerHTML = '';
    const pool = selectedModule ? data.filter(a=>a.module===selectedModule) : data;
    const counts = {};
    pool.forEach(a=> (a.tags||[]).forEach(t=> counts[t] = (counts[t]||0)+1));
    const tags = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).slice(0,30);
    tags.forEach(t=>{ const li = document.createElement('li'); const btn = document.createElement('button'); btn.className='tag'; btn.textContent = `${t} (${counts[t]})`; btn.addEventListener('click', ()=>{ searchInput.value = t; headerSearch.value = t; applyFilters(); }); li.appendChild(btn); submodulesEl.appendChild(li); });
    if(tags.length===0) submodulesEl.innerHTML = '<li><small>暂无细分</small></li>';
  }

  // 排行榜：按作者文章数
  function renderRankings(){ rankEl.innerHTML = ''; const authorCounts = {}; data.forEach(a=>{ const au = (a.author||'').split(',')[0].trim() || a.source || '匿名'; authorCounts[au] = (authorCounts[au]||0)+1; }); Object.entries(authorCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>{ const li = document.createElement('li'); li.textContent = `${k} (${v})`; rankEl.appendChild(li); }); }

  // 过滤函数：根据模块与关键词
  function applyFilters(){
    const module = moduleSelect.value;
    const q = (searchInput.value || '').trim().toLowerCase();
    filtered = data.slice();
    if(module) filtered = filtered.filter(a=>a.module===module);
    if(q) filtered = filtered.filter(a=> ((a.title||'') + ' ' + stripHtml(a.summary||'') + ' ' + (a.author||'') + ' ' + (a.tags||[]).join(' ')).toLowerCase().includes(q));
    currentPage = 1;
    renderPage();
    renderSubmodules(module||'');
    renderRankings();
  }

  // 设置模块筛选（顶部导航点击）
  function setModuleFilter(m){ moduleSelect.value = m; [...topnav.querySelectorAll('.nav-link')].forEach(a=> a.classList.toggle('active', a.textContent===m || (m==='' && a.textContent==='首页'))); applyFilters(); }

  // 加载更多
  function loadMore(){ if(filtered.length > currentPage * PAGE_SIZE){ currentPage++; renderPage(); } }
  loadMoreBtn.addEventListener('click', loadMore);

  // 简单的无限滚动（向下 600px 自动加载更多）
  let scrolling = false;
  window.addEventListener('scroll', ()=>{ if(scrolling) return; scrolling = true; setTimeout(()=>{ const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 600); if(nearBottom) loadMore(); scrolling = false; }, 200); });

  // 弹窗与评论（Twikoo 可选 / 本地 fallback）
  const modal = document.getElementById('articleModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMeta = document.getElementById('modalMeta');
  const modalSummary = document.getElementById('modalSummary');
  const modalLink = document.getElementById('modalLink');
  const twikooEl = document.getElementById('twikoo');
  const localCommentsEl = document.getElementById('local-comments');
  document.getElementById('modalClose').addEventListener('click', ()=>{ modal.style.display='none'; });

  function articleIdFor(a){ return 'art_' + (a.link || a.title || Math.random()).replace(/[^a-zA-Z0-9]/g,'_').slice(0,120); }

  async function openArticleModal(a){
    const id = articleIdFor(a);
    modalTitle.textContent = a.title || '无标题';
    modalMeta.textContent = `${a.source||''} · ${a.published || ''} · ${a.author||''} · ${a.module||''}`;
    modalSummary.textContent = stripHtml(a.summary||'');
    modalLink.href = a.link || '#';
    modal.style.display = 'flex';

    // 初始化评论区：优先 Twikoo（如配置），否则本地评论
    if(TWIKOO_ENVID){
      localCommentsEl.style.display = 'none'; twikooEl.style.display = 'block';
      try{
        // 若之前已初始化 twikoo，尝试销毁再重建（取决于库是否支持）
        if(window.twikoo && typeof window.twikoo.destroy === 'function'){ window.twikoo.destroy(); }
        if(window.twikoo && typeof window.twikoo.init === 'function'){ /* 使用全局 twikoo */ }
        // 初始化（每篇文章用 path 标识线程）
        if(window.twikoo && typeof window.twikoo.init === 'function'){
          window.twikoo.init({ envId: TWIKOO_ENVID, el: '#twikoo', path: id });
        }else if(typeof twikoo !== 'undefined' && twikoo.init){
          twikoo.init({ envId: TWIKOO_ENVID, el: '#twikoo', path: id });
        }else{
          console.warn('Twikoo 未加载或不支持'); localCommentsEl.style.display='block'; twikooEl.style.display='none'; renderLocalComments(id);
        }
      }catch(e){ console.warn('Twikoo 初始化失败', e); localCommentsEl.style.display='block'; twikooEl.style.display='none'; renderLocalComments(id); }
    }else{
      // 本地评论 fallback
      twikooEl.style.display='none'; localCommentsEl.style.display='block'; renderLocalComments(id);
    }
  }

  // 本地评论实现（localStorage）
  function renderLocalComments(articleId){
    const store = JSON.parse(localStorage.getItem('local_comments')||'{}');
    const list = store[articleId] || [];
    localCommentsEl.innerHTML = '';
    const form = document.createElement('div');
    form.innerHTML = `
      <div style="margin-bottom:8px"><input id="c_name" placeholder="称呼（可匿名）" style="width:100%;padding:8px"/></div>
      <div style="margin-bottom:8px"><textarea id="c_text" placeholder="写下你的评论" rows="3" style="width:100%;padding:8px"></textarea></div>
      <div style="text-align:right"><button id="c_submit" class="btn primary">发表评论</button></div>
    `;
    localCommentsEl.appendChild(form);
    const listEl = document.createElement('div'); listEl.className = 'comment-list';
    if(list.length===0) listEl.innerHTML = '<small>暂无评论，快来抢沙发</small>';
    list.forEach(c=>{ const d = document.createElement('div'); d.className='comment'; d.innerHTML = `<div style="color:#333"><strong>${escapeHtml(c.name||'匿名')}</strong> · <small style="color:#999">${formatDate(c.createdAt)}</small></div><div style="margin-top:6px;color:#111">${escapeHtml(c.text)}</div>`; listEl.appendChild(d); });
    localCommentsEl.appendChild(listEl);

    document.getElementById('c_submit').addEventListener('click', ()=>{
      const name = document.getElementById('c_name').value.trim() || '匿名';
      const text = document.getElementById('c_text').value.trim();
      if(!text){ alert('请输入评论内容'); return; }
      const item = { name, text, createdAt: new Date().toISOString() };
      const s = JSON.parse(localStorage.getItem('local_comments')||'{}');
      s[articleId] = s[articleId]||[]; s[articleId].unshift(item);
      localStorage.setItem('local_comments', JSON.stringify(s));
      renderLocalComments(articleId);
    });
  }

  function escapeHtml(str){ return (str||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; }); }

  // 发布（本地示例）
  const publishModal = document.getElementById('publishModal');
  document.getElementById('publishBtn').addEventListener('click', ()=>{
    // 填充模块下拉
    const pm = document.getElementById('p_module'); pm.innerHTML = '';
    modules.forEach(m=>{ const o=document.createElement('option'); o.value=m; o.textContent=m; pm.appendChild(o); });
    publishModal.style.display = 'flex';
  });
  document.getElementById('publishClose').addEventListener('click', ()=> publishModal.style.display='none');
  document.getElementById('publishForm').addEventListener('submit', (e)=>{
    e.preventDefault(); const title = document.getElementById('p_title').value.trim(); const summary = document.getElementById('p_summary').value.trim(); const module = document.getElementById('p_module').value; const author = document.getElementById('p_author').value.trim()||'你';
    if(!title){ alert('请输入标题'); return; }
    const post = { title, summary, link:'#', author, published:new Date().toISOString(), source:'本站用户', module, tags:[], isLocal:true };
    localPosts.unshift(post);
    localStorage.setItem('localPosts', JSON.stringify(localPosts));
    // 更新数据并刷新
    data = localPosts.concat(remoteData || []);
    applyFilters();
    publishModal.style.display='none';
    alert('发布已保存到本地（localStorage），仅作示例展示）');
  });

  document.getElementById('loginBtn').addEventListener('click', ()=>{ alert('登录示例：尚未实现后端（仅前端演示）'); });

  // 绑定搜索输入
  headerSearch.addEventListener('input', e=>{ searchInput.value = e.target.value; applyFilters(); });
  searchInput.addEventListener('input', e=>{ headerSearch.value = e.target.value; applyFilters(); });

  moduleSelect.addEventListener('change', ()=>{ const val = moduleSelect.value; [...topnav.querySelectorAll('.nav-link')].forEach(a=> a.classList.toggle('active', a.textContent===val || (val==='' && a.textContent==='首页'))); applyFilters(); });

  // 初始渲染
  applyFilters();

})();