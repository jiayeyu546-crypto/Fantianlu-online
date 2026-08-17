// main.js — 简单的数据驱动渲染器，加载 data/heroes.json 与 data/works.json
(function(){
  console.log('main.js loaded');
  async function fetchJSON(path){
    try{
      // 优先使用不缓存策略并尝试多种回退路径，增加健壮性
      const stamp = Date.now();
      const sep = path.includes('?') ? '&' : '?';
      const attempts = [
        path + sep + '_=' + stamp,
        path,
        './' + path + sep + '_=' + stamp,
        './' + path
      ];
      let res = null;
      let lastErr = null;
      for(const attempt of attempts){
        try{
          res = await fetch(attempt, { cache: 'no-store' });
          console.log('fetch attempt', attempt, 'status', res.status, 'ok', res.ok);
          if(res.ok) break;
        }catch(e){
          console.warn('fetch attempt failed', attempt, e);
          lastErr = e;
          res = null;
        }
      }
      if(!res || !res.ok) {
        throw lastErr || new Error('All fetch attempts failed for ' + path);
      }
      // 尝试解析 JSON，若解析失败则打印文本以便调试编码/格式问题
      const text = await res.text();
      try{
        return JSON.parse(text);
      }catch(parseErr){
        console.error('fetchJSON parse error for', path, parseErr);
        console.error('Response text preview:', text.slice(0,1000));
        throw parseErr;
      }
    }catch(e){
      console.error('fetchJSON error', path, e);
      return null;
    }
  }

  const HERO_QUERY_KEYS = {
    lineage: 'lineage',
    decade: 'decade',
    q: 'q',
    id: 'id'
  };

  function getHeroesControls(){
    return {
      periodSelect: document.getElementById('filter-period'),
      tagSelect: document.getElementById('filter-tag'),
      qInput: document.getElementById('filter-q'),
      clearBtn: document.getElementById('filter-clear'),
      searchRegion: document.querySelector('.search-region'),
      listRoot: document.getElementById('heroes-list-root'),
      detailRoot: document.getElementById('hero-detail-root'),
      countEl: document.getElementById('results-count')
    };
  }

  function isHeroesPage(){
    return !!document.getElementById('heroes-list-root');
  }

  function getCurrentFilterParams(){
    const { periodSelect, tagSelect, qInput } = getHeroesControls();
    const params = new URLSearchParams(location.search);
    const lineage = (tagSelect?.value || '').trim();
    const decade = (periodSelect?.value || '').trim();
    const q = (qInput?.value || '').trim();

    if(lineage) params.set(HERO_QUERY_KEYS.lineage, lineage); else params.delete(HERO_QUERY_KEYS.lineage);
    if(decade) params.set(HERO_QUERY_KEYS.decade, decade); else params.delete(HERO_QUERY_KEYS.decade);
    if(q) params.set(HERO_QUERY_KEYS.q, q); else params.delete(HERO_QUERY_KEYS.q);
    return params;
  }

  function applyFiltersFromUrlToControls(){
    const { periodSelect, tagSelect, qInput } = getHeroesControls();
    const params = new URLSearchParams(location.search);
    const lineage = (params.get(HERO_QUERY_KEYS.lineage) || '').trim();
    const decade = (params.get(HERO_QUERY_KEYS.decade) || '').trim();
    const q = params.get(HERO_QUERY_KEYS.q) || '';

    if(tagSelect && lineage){
      const hasOption = Array.from(tagSelect.options).some(o => o.value === lineage);
      if(hasOption) tagSelect.value = lineage;
    }
    if(periodSelect && decade){
      const hasOption = Array.from(periodSelect.options).some(o => o.value === decade);
      if(hasOption) periodSelect.value = decade;
    }
    if(qInput) qInput.value = q;
  }

  function setArchiveMode(mode){
    const { searchRegion, listRoot, detailRoot } = getHeroesControls();
    const isDetail = mode === 'detail';
    if(searchRegion) searchRegion.hidden = isDetail;
    if(listRoot) listRoot.hidden = isDetail;
    if(detailRoot) detailRoot.hidden = !isDetail;
  }

  function replaceHeroesUrl(params){
    const query = params.toString();
    const next = `${location.pathname}${query ? `?${query}` : ''}`;
    history.replaceState(null, '', next);
  }

  function createBackToListLink(){
    const params = new URLSearchParams(location.search);
    params.delete(HERO_QUERY_KEYS.id);
    const query = params.toString();
    const href = `heroes.html${query ? `?${query}` : ''}`;
    const a = document.createElement('a');
    a.className = 'archive-card__link';
    a.href = href;
    a.textContent = '← 返回英雄一览';
    return a;
  }

  function parseYearFromFirstAppearance(value){
    if(!value) return '';
    const m = String(value).match(/(19|20)\d{2}/);
    return m ? m[0] : '';
  }

  function createHeroCard(hero){
    // produce archive-style card body; caller will wrap into li
    const container = document.createElement('div');
    container.className = 'archive-card';

    const idxWrap = document.createElement('div');
    idxWrap.className = 'archive-card__index';
    const idx = hero._archive_index ? String(hero._archive_index).padStart(3,'0') : '--';
    idxWrap.textContent = idx;

    const body = document.createElement('div');
    body.className = 'archive-card__body';

    const title = document.createElement('h3');
    title.className = 'archive-card__title';
    title.textContent = hero.name;

    const meta = document.createElement('div');
    meta.className = 'archive-card__meta';
    const lineage = hero.lineage || ((Array.isArray(hero.tags) && hero.tags.length) ? hero.tags[0] : '未标注谱系');
    const works = Array.isArray(hero.related_works_titles) ? hero.related_works_titles : [];
    const worksSummary = works.length > 1 ? `${works[0]}等` : (works[0] || '待补充');
    meta.textContent = `${lineage} / ${worksSummary}`;

    const excerpt = document.createElement('div');
    excerpt.className = 'archive-card__excerpt';
    excerpt.textContent = hero.short_intro || '';

    const footer = document.createElement('div');
    footer.className = 'archive-card__footer';
    if(hero.detail_available === false || !hero.id){
      const span = document.createElement('span');
      span.className = 'archive-card__link archive-card__link--disabled';
      span.textContent = '档案整理中';
      footer.appendChild(span);
    } else {
      const a = document.createElement('a');
      a.className = 'archive-card__link';
      if(isHeroesPage()){
        const params = getCurrentFilterParams();
        params.set(HERO_QUERY_KEYS.id, String(hero.id));
        a.href = `heroes.html?${params.toString()}`;
      } else {
        a.href = `heroes.html?id=${encodeURIComponent(hero.id)}`;
      }
      a.textContent = '查看档案 →';
      footer.appendChild(a);
    }

    body.appendChild(title);
    if(meta.textContent) body.appendChild(meta);
    body.appendChild(excerpt);
    body.appendChild(footer);

    // image or CSS placeholder
    let imageNode;
    const imgUrl = hero.image || ((hero.images && hero.images[0] && hero.images[0].url) ? hero.images[0].url : null);
    if(imgUrl){
      const imgWrap = document.createElement('div');
      imgWrap.className = 'archive-image';
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = hero.name;
      img.style.width = '100%';
      img.style.height='100%';
      img.style.objectFit = hero.image_fit === 'contain' ? 'contain' : 'cover';
      img.onerror = () => {
        imgWrap.classList.add('archive-image--pending');
        imgWrap.innerHTML = '';
        const code = hero._archive_index ? String(hero._archive_index).padStart(3,'0') : '--';
        const badge = document.createElement('span');
        badge.className = 'archive-image__code';
        badge.textContent = `ARCHIVE ${code}`;
        const main = document.createElement('div');
        main.className = 'archive-image__pending-main';
        main.textContent = 'IMAGE PENDING';
        const sub = document.createElement('div');
        sub.className = 'archive-image__pending-sub';
        sub.textContent = '图像待核实';
        imgWrap.appendChild(badge);
        imgWrap.appendChild(main);
        imgWrap.appendChild(sub);
      };
      imgWrap.appendChild(img);
      imageNode = imgWrap;
    }else{
      const placeholder = document.createElement('div');
      placeholder.className = 'archive-image archive-image--pending';
      const code = hero._archive_index ? String(hero._archive_index).padStart(3,'0') : '--';
      const badge = document.createElement('span');
      badge.className = 'archive-image__code';
      badge.textContent = `ARCHIVE ${code}`;
      const line1 = document.createElement('div');
      line1.className = 'archive-image__pending-main';
      line1.textContent = 'IMAGE PENDING';
      const line2 = document.createElement('div');
      line2.className = 'archive-image__pending-sub';
      line2.textContent = '图像待核实';
      placeholder.appendChild(badge);
      placeholder.appendChild(line1);
      placeholder.appendChild(line2);
      imageNode = placeholder;
    }

    container.appendChild(idxWrap);
    container.appendChild(imageNode);
    container.appendChild(body);
    return container;
  }

  async function renderFeaturedHeroes(){
    const container = document.getElementById('featured-heroes-list');
    if(!container) return;
    const heroes = await fetchJSON('data/heroes.json');
    if(!heroes) {
      container.textContent = '无法加载英雄数据。';
      console.error('renderFeaturedHeroes: heroes is null');
      return;
    }
    // 显示前 4 个条目作为示例
    const slice = heroes.slice(0,4);
    slice.forEach(h => {
      container.appendChild(createHeroCard(h));
    });
  }

  // 在列表页渲染所有英雄
  async function renderHeroesList(){
    const listRoot = document.getElementById('heroes-list-root');
    if(!listRoot) return;
    // 清空并显示加载中提示
    listRoot.innerHTML = '';
    const loading = document.createElement('li'); loading.textContent = '加载中...'; loading.className = 'heroes-list__item heroes-list__loading';
    listRoot.appendChild(loading);
    const heroes = await fetchJSON('data/heroes.json');
    if(!heroes){ listRoot.innerHTML = ''; const err = document.createElement('li'); err.textContent = '无法加载数据（查看控制台以获取详细错误）'; err.className='heroes-list__item heroes-list__error'; listRoot.appendChild(err); console.error('renderHeroesList: heroes is null'); return; }
    if(!Array.isArray(heroes)){
      listRoot.innerHTML = '';
      const err = document.createElement('li'); err.textContent = '数据格式错误：期望数组'; err.className='heroes-list__item heroes-list__error'; listRoot.appendChild(err);
      console.error('renderHeroesList: heroes is not array', heroes);
      return;
    }
    console.log('renderHeroesList: loaded', heroes.length, 'items');
    listRoot.innerHTML = '';
    if(heroes.length === 0){
      const note = document.createElement('li'); note.textContent = '暂无英雄数据。'; note.className='heroes-list__item heroes-list__empty'; listRoot.appendChild(note); return;
    }
    // 初始化筛选控件并缓存数据；为每个英雄分配稳定档案编号
    window._HEROES_CACHE = heroes;
    heroes.forEach((h,i)=>{ h._archive_index = i+1 });
    initFilterControls(heroes);
    applyFiltersFromUrlToControls();

    const params = new URLSearchParams(location.search);
    const id = (params.get(HERO_QUERY_KEYS.id) || '').trim();
    if(id){
      renderHeroDetail();
    } else {
      renderHeroesFiltered();
    }
  }

  function initFilterControls(heroes){
    const periodSelect = document.getElementById('filter-period');
    const tagSelect = document.getElementById('filter-tag');
    const qInput = document.getElementById('filter-q');
    const clearBtn = document.getElementById('filter-clear');
    if(!periodSelect || !tagSelect) return;
    const periods = new Set();
    const lineages = new Set();
    const lineageOrder = ['西游谱', '封神谱', '众生谱', '追光谱'];
    const periodOrder = ['1940s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

    heroes.forEach(h => {
      if(h.period) periods.add(h.period);
      if(h.lineage) lineages.add(h.lineage);
      else if(Array.isArray(h.tags) && h.tags.length) lineages.add(h.tags[0]);
    });

    periodOrder.filter(p => periods.has(p)).forEach(p=>{
      const opt=document.createElement('option');
      opt.value=p;
      opt.textContent=p;
      periodSelect.appendChild(opt);
    });

    lineageOrder.filter(l => lineages.has(l)).forEach(t=>{
      const opt=document.createElement('option');
      opt.value=t;
      opt.textContent=t;
      tagSelect.appendChild(opt);
    });

    // 如果表单存在，避免表单提交引起页面刷新
    const form = document.getElementById('archive-search-form');
    if(form){ form.addEventListener('submit', e=>e.preventDefault()); }

    const onChange = () => renderHeroesFiltered();
    periodSelect.addEventListener('change', onChange);
    tagSelect.addEventListener('change', onChange);
    qInput && qInput.addEventListener('input', onChange);
    clearBtn && clearBtn.addEventListener('click', ()=>{ periodSelect.value=''; tagSelect.value=''; if(qInput) qInput.value=''; renderHeroesFiltered(); });
  }

  function renderHeroesFiltered(){
    const listRoot = document.getElementById('heroes-list-root');
    if(!listRoot) return;
    setArchiveMode('list');
    const heroes = window._HEROES_CACHE || [];

    // 规范化筛选值，去除首尾空格
    const period = (document.getElementById('filter-period')?.value || '').trim();
    const tag = (document.getElementById('filter-tag')?.value || '').trim();
    const q = (document.getElementById('filter-q')?.value || '').trim().toLowerCase();
    listRoot.innerHTML = '';
    const filtered = heroes.filter(h => {
      if(period && String((h.period||'')).trim() !== period) return false;
      const lineage = String(h.lineage || ((Array.isArray(h.tags) && h.tags[0]) ? h.tags[0] : '')).trim();
      if(tag && lineage !== tag) return false;
      if(q){ const hay = ((h.name||'')+' '+(h.short_intro||'')+' '+(h.long_intro||'')).toLowerCase(); if(!hay.includes(q)) return false; }
      return true;
    });

    console.debug('renderHeroesFiltered: selected filters', { period, tag, q, matched: filtered.map(h=>h.id) });

    const countEl = document.getElementById('results-count'); if(countEl) countEl.textContent = `当前显示 ${filtered.length} 位英雄`;

    const urlParams = getCurrentFilterParams();
    urlParams.delete(HERO_QUERY_KEYS.id);
    replaceHeroesUrl(urlParams);

    if(filtered.length === 0){ const li=document.createElement('li'); li.className='archive-card-item heroes-list__empty'; li.textContent='没有符合筛选条件的条目。'; listRoot.appendChild(li);
      // 清空详情并移除 URL id
      const detailRoot = document.getElementById('hero-detail-root'); if(detailRoot) detailRoot.innerHTML = '';
      try{ const u = new URL(location.href); u.searchParams.delete('id'); history.replaceState(null,'', u.pathname + u.search); }catch(e){}
      return; }

    filtered.forEach(h=>{ const li=document.createElement('li'); li.className='archive-card-item'; const card = createHeroCard(h); li.appendChild(card); listRoot.appendChild(li); });

    // 若当前 URL 包含 detail id，但该 id 不在筛选结果中，则清空详情区并移除 id 参数
    const detailRoot = document.getElementById('hero-detail-root');
    if(detailRoot) detailRoot.innerHTML = '';
  }

  // 渲染英雄详情（如果 URL 有 id）
  async function renderHeroDetail(){
    const detailRoot = document.getElementById('hero-detail-root');
    if(!detailRoot) return;
    setArchiveMode('detail');
    const params = new URLSearchParams(location.search);
    const id = (params.get(HERO_QUERY_KEYS.id) || '').trim();
    if(!id){
      detailRoot.innerHTML = '';
      setArchiveMode('list');
      return;
    }

    // 优先使用已缓存的数据以保持与列表一致性
    let heroes = window._HEROES_CACHE;
    if(!Array.isArray(heroes)){
      heroes = await fetchJSON('data/heroes.json');
      if(!heroes){ detailRoot.textContent = '无法加载数据'; return; }
    }
    heroes.forEach((h, i) => {
      if(!h._archive_index) h._archive_index = i + 1;
    });

    const hero = heroes.find(x => String(x.id) === String(id));
    if(!hero){
      detailRoot.innerHTML = '';
      const top = document.createElement('div');
      top.className = 'hero-detail__top';
      top.appendChild(createBackToListLink());

      const title = document.createElement('h1');
      title.className = 'hero-detail__name';
      title.textContent = '未找到该英雄档案';

      const note = document.createElement('p');
      note.className = 'hero-detail__summary';
      note.textContent = '请返回英雄一览后重新选择。';

      detailRoot.appendChild(top);
      detailRoot.appendChild(title);
      detailRoot.appendChild(note);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    // 渲染详情
    detailRoot.innerHTML = '';
    const top = document.createElement('div');
    top.className = 'hero-detail__top';
    top.appendChild(createBackToListLink());
    const lineageHint = (new URLSearchParams(location.search).get(HERO_QUERY_KEYS.lineage) || '').trim();
    if(lineageHint){
      const hint = document.createElement('span');
      hint.className = 'hero-detail__back-hint';
      hint.textContent = `返回：${lineageHint}`;
      top.appendChild(hint);
    }

    const code = document.createElement('p');
    code.className = 'hero-detail__code';
    const archiveNo = hero._archive_index ? String(hero._archive_index).padStart(3, '0') : '---';
    code.textContent = `ARCHIVE ${archiveNo}`;

    const lineage = document.createElement('p');
    lineage.className = 'hero-detail__lineage';
    lineage.textContent = `${hero.lineage || '未标注谱系'} / HERO ARCHIVE`;

    const h1 = document.createElement('h1');
    h1.className = 'hero-detail__name';
    h1.textContent = hero.name;

    const workTitle = Array.isArray(hero.related_works_titles) && hero.related_works_titles.length ? hero.related_works_titles[0] : '—';
    const year = parseYearFromFirstAppearance(hero.first_appearance);
    const workMeta = document.createElement('p');
    workMeta.className = 'hero-detail__work';
    workMeta.textContent = year ? `${workTitle} · ${year}` : workTitle;

    const grid = document.createElement('div');
    grid.className = 'hero-detail__grid';

    const media = document.createElement('figure');
    media.className = 'hero-detail__media';
    const imgWrap = document.createElement('div');
    imgWrap.className = 'hero-detail__image';
    const imgUrl = hero.image || ((hero.images && hero.images[0] && hero.images[0].url) ? hero.images[0].url : null);
    if(imgUrl){
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = hero.name;
      imgWrap.appendChild(img);
    } else {
      imgWrap.classList.add('hero-detail__image--pending');
      imgWrap.textContent = 'IMAGE PENDING';
    }
    media.appendChild(imgWrap);

    const body = document.createElement('div');
    body.className = 'hero-detail__body';

    const summary = document.createElement('p');
    summary.className = 'hero-detail__summary';
    summary.textContent = hero.long_intro || hero.short_intro || '';

    const meta = document.createElement('dl');
    meta.className = 'hero-detail__meta';
    meta.innerHTML = `
      <div><dt>首次出现</dt><dd>${hero.first_appearance || '—'}</dd></div>
      <div><dt>所属谱系</dt><dd>${hero.lineage || '—'}</dd></div>
      <div><dt>相关作品</dt><dd>${Array.isArray(hero.related_works_titles) ? hero.related_works_titles.join('、') : '—'}</dd></div>
    `;

    body.appendChild(summary);
    body.appendChild(meta);
    grid.appendChild(media);
    grid.appendChild(body);

    const bottom = document.createElement('div');
    bottom.className = 'hero-detail__bottom';
    bottom.appendChild(createBackToListLink());

    detailRoot.appendChild(top);
    detailRoot.appendChild(code);
    detailRoot.appendChild(lineage);
    detailRoot.appendChild(h1);
    detailRoot.appendChild(workMeta);
    detailRoot.appendChild(grid);
    detailRoot.appendChild(bottom);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function renderWorksList(){
    const listRoot = document.getElementById('works-list-root');
    if(!listRoot) return;

    listRoot.innerHTML = '';
    const loading = document.createElement('li');
    loading.textContent = '加载中...';
    loading.className = 'archive-card-item heroes-list__loading';
    listRoot.appendChild(loading);

    const works = await fetchJSON('data/works.json');
    if(!works || !Array.isArray(works)){
      listRoot.innerHTML = '';
      const err = document.createElement('li');
      err.className = 'archive-card-item heroes-list__error';
      err.textContent = '无法加载作品数据（查看控制台以获取详细错误）';
      listRoot.appendChild(err);
      return;
    }

    listRoot.innerHTML = '';
    works.forEach((w, i) => {
      const li = document.createElement('li');
      li.className = 'archive-card-item';

      const card = document.createElement('div');
      card.className = 'archive-card';

      const idx = document.createElement('div');
      idx.className = 'archive-card__index';
      idx.textContent = String(i + 1).padStart(3, '0');

      let imageNode;
      const imgCandidate = (Array.isArray(w.key_frames) && w.key_frames.length && w.key_frames[0].image_url) ? w.key_frames[0].image_url : null;
      if(imgCandidate){
        const imgWrap = document.createElement('div');
        imgWrap.className = 'archive-image';
        const img = document.createElement('img');
        img.src = imgCandidate;
        img.alt = w.title || '作品图像';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        imgWrap.appendChild(img);
        imageNode = imgWrap;
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'archive-image archive-image--pending';
        placeholder.textContent = 'IMAGE PENDING';
        imageNode = placeholder;
      }

      const body = document.createElement('div');
      body.className = 'archive-card__body';
      const title = document.createElement('h3');
      title.className = 'archive-card__title';
      title.textContent = w.title || '未命名作品';
      const meta = document.createElement('div');
      meta.className = 'archive-card__meta';
      meta.textContent = w.year || '';
      const footer = document.createElement('div');
      footer.className = 'archive-card__footer';
      const a = document.createElement('a');
      a.className = 'archive-card__link';
      a.href = `works.html?id=${encodeURIComponent(w.id)}`;
      a.textContent = '查看档案 →';
      footer.appendChild(a);

      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(footer);

      card.appendChild(idx);
      card.appendChild(imageNode);
      card.appendChild(body);
      li.appendChild(card);
      listRoot.appendChild(li);
    });

    const countEl = document.getElementById('works-results-count');
    if(countEl) countEl.textContent = `当前显示 ${works.length} 件作品`;
  }

  async function renderWorkDetail(){
    const detailRoot = document.getElementById('work-detail-root');
    if(!detailRoot) return;
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    // 同上：若无 id 则不在列表页显示错误信息
    if(!id){ return; }
    const works = await fetchJSON('data/works.json');
    if(!works){ detailRoot.textContent = '无法加载数据'; return; }
    const work = works.find(x => x.id === id);
    if(!work){ detailRoot.textContent = '找不到指定作品。'; return; }
    const h1 = document.createElement('h1'); h1.textContent = work.title;
    const synopsis = typeof work.synopsis === 'string' ? work.synopsis.trim() : '';
    detailRoot.appendChild(h1);
    if(synopsis){
      const p = document.createElement('p');
      p.textContent = synopsis;
      detailRoot.appendChild(p);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    try{
      console.log('DOM loaded — start rendering');
      renderFeaturedHeroes();
      renderHeroesList();
      renderHeroDetail();
      renderWorksList();
      renderWorkDetail();
    }catch(err){
      console.error('Rendering error', err);
      const root = document.querySelector('main') || document.body;
      const msg = document.createElement('div');
      msg.className = 'renderer-error';
      msg.textContent = '页面渲染发生错误，请打开控制台查看详情。';
      root.insertBefore(msg, root.firstChild);
    }
  });

})();
// 1. 自动更新页脚年份，避免每年手动修改 HTML。
const yearElement = document.querySelector("#current-year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// 2. 获取页面导航和手机菜单按钮。
const menuButton = document.querySelector(".menu-button");
const siteNavigation = document.querySelector("#site-nav");
const navigationLinks = document.querySelectorAll(".site-nav a");

// 3. 在手机端展开或关闭导航菜单。
if (menuButton && siteNavigation) {
  menuButton.addEventListener("click", () => {
    const menuIsOpen = siteNavigation.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(menuIsOpen));
  });
}

// 4. 平滑滚动到当前页面中的目标区域。
const pageLinks = document.querySelectorAll('a[href^="#"]');

pageLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    const targetSection = document.querySelector(targetId);

    if (!targetSection) {
      return;
    }

    event.preventDefault();
    targetSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // 更新导航状态，并在手机端选择板块后自动收起菜单。
    navigationLinks.forEach((navigationLink) => {
      navigationLink.classList.toggle("is-current", navigationLink === link);
    });

    if (siteNavigation && menuButton) {
      siteNavigation.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
});

// 5. 从手机宽度切回桌面宽度时，清理手机菜单的展开状态。
window.addEventListener("resize", () => {
  if (window.innerWidth > 960 && siteNavigation && menuButton) {
    siteNavigation.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  }
});
