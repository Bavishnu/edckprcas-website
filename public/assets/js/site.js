(() => {
  'use strict';
  const page = document.body.dataset.page || 'home';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeUrl = value => {
    const s = String(value || '').trim();
    if (!s) return '';
    if (s.startsWith('/') || s.startsWith('#')) return s;
    try { const u = new URL(s, location.href); return ['http:','https:','mailto:','tel:'].includes(u.protocol) ? s : ''; } catch { return ''; }
  };
  const mediaBaseUrl = String(window.EDCKPRCAS_CONFIG?.mediaBaseUrl || '').replace(/\/+$/, '');
  const assetUrl = value => {
    const safe = safeUrl(value);
    if (!safe || !mediaBaseUrl) return safe;
    if (safe.startsWith('/uploads/')) return `${mediaBaseUrl}${safe}`;
    if (safe.startsWith('uploads/')) return `${mediaBaseUrl}/${safe}`;
    return safe;
  };
  const img = (src, alt = '') => `<img src="${esc(assetUrl(src))}" alt="${esc(alt)}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('image-fallback')">`;
  const textOr = (v, fallback = '') => esc(v || fallback);
  const youtubeVideoId = value => {
    const raw = String(value || '').trim(); if (!raw) return '';
    try {
      const u = new URL(raw);
      let id = '';
      if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1).split('/')[0];
      else if (u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com')) id = u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)||[])[1] || '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
    } catch { return ''; }
  };
  const youtubeEmbed = (value, autoplay = false) => {
    const id = youtubeVideoId(value);
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1${autoplay?'&autoplay=1':''}` : '';
  };
  const youtubeThumbnail = value => {
    const id = youtubeVideoId(value);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
  };
  const dateParts = value => {
    const d = new Date(`${value || ''}T00:00:00`);
    if (Number.isNaN(d.getTime())) return { day: '—', month: 'DATE', year: '' };
    return { day: d.getDate(), month: d.toLocaleString('en', { month: 'short' }).toUpperCase(), year: d.getFullYear() };
  };
  const blogPublicationTime = item => {
    if (!item?.publishAt) return null;
    const value = String(item.publishAt);
    const parsed = new Date(value.length === 16 ? `${value}:00` : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };
  const isBlogPublished = item => {
    const status = String(item?.status || 'Published').trim().toLowerCase();
    if (['draft','unpublished','hidden'].includes(status)) return false;
    const publishAt = blogPublicationTime(item);
    if (publishAt && publishAt > Date.now()) return false;
    if (status === 'scheduled' && !publishAt) return false;
    return true;
  };
  const publishedBlogs = () => (data?.blogs || []).filter(isBlogPublished);
  function scheduleBlogPublicationRefresh() {
    const now = Date.now();
    const next = (data?.blogs || []).filter(item => String(item.status || '').trim().toLowerCase() === 'scheduled')
      .map(blogPublicationTime).filter(value => value && value > now).sort((a,b)=>a-b)[0];
    if (!next) return;
    const refreshWhenVisible = () => {
      const wait = Math.max(0, next - Date.now() + 900);
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') location.reload();
        else document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') location.reload(); }, { once:true });
      }, Math.min(wait, 2147483000));
    };
    refreshWhenVisible();
  }
  let data = null;
  let activeBook = null;

  const navItems = [
    ['about.html','About','about'], ['people.html','People','people'], ['events.html','Programmes','events'],
    ['startups.html','Ventures','startups'], ['impact.html','Impact','impact'],
    ['social-media.html','Social media','social'], ['gallery.html','Gallery','gallery']
  ];
  const moreItems = [
    ['messages.html','Messages from heads'], ['gallery.html','Gallery'], ['blogs.html','Blogs'],
    ['social-media.html','Social media'], ['mentors.html','Mentors'], ['annual-reports.html','Annual reports'], ['opportunities.html','Opportunities']
  ];
  function renderHeader() {
    const s = data.site || {};
    const navCopy = data.navigation || {};
    const fallbackLinks = [
      { group: 'THE EDC', groupNote: 'Purpose, people and leadership', label: 'About the EDC', url: 'about.html' },
      { group: 'THE EDC', groupNote: 'Purpose, people and leadership', label: 'People behind the work', url: 'people.html' },
      { group: 'THE EDC', groupNote: 'Purpose, people and leadership', label: 'Messages from heads', url: 'messages.html' },
      { group: 'PROGRAMMES & VENTURES', groupNote: 'Learn, build and participate', label: 'Events & programmes', url: 'events.html' },
      { group: 'PROGRAMMES & VENTURES', groupNote: 'Learn, build and participate', label: 'Student ventures', url: 'startups.html' },
      { group: 'PROGRAMMES & VENTURES', groupNote: 'Learn, build and participate', label: 'Opportunities', url: 'opportunities.html' },
      { group: 'KNOWLEDGE & IMPACT', groupNote: 'Stories, evidence and records', label: 'Impact so far', url: 'impact.html' },
      { group: 'KNOWLEDGE & IMPACT', groupNote: 'Stories, evidence and records', label: 'Achievements', url: 'achievements.html' },
      { group: 'KNOWLEDGE & IMPACT', groupNote: 'Stories, evidence and records', label: 'Blogs & insights', url: 'blogs.html' },
      { group: 'KNOWLEDGE & IMPACT', groupNote: 'Stories, evidence and records', label: 'Annual reports', url: 'annual-reports.html' },
      { group: 'COMMUNITY', groupNote: 'People and moments around the EDC', label: 'Mentor network', url: 'mentors.html' },
      { group: 'COMMUNITY', groupNote: 'People and moments around the EDC', label: 'Gallery', url: 'gallery.html' },
      { group: 'COMMUNITY', groupNote: 'People and moments around the EDC', label: 'Social media', url: 'social-media.html' },
      { group: 'COMMUNITY', groupNote: 'People and moments around the EDC', label: 'Reach us', url: 'contact.html' }
    ];
    const links = Array.isArray(navCopy.megaLinks) && navCopy.megaLinks.length ? navCopy.megaLinks : fallbackLinks;
    const groupMap = new Map();
    links.forEach(item => {
      const heading = item.group || 'Explore';
      if (!groupMap.has(heading)) groupMap.set(heading, { title: heading, note: item.groupNote || '', links: [] });
      groupMap.get(heading).links.push([item.url || '#', item.label || 'Untitled']);
    });
    const groups = [...groupMap.values()];
    const active = (key) => ({ 'social-media': 'social', 'annual-reports': 'reports', 'team-year': 'people' }[key] || key) === page ? 'active' : '';
    const topSocial = [['linkedin','LinkedIn'],['instagram','Instagram'],['youtube','YouTube']].filter(([key]) => s[key]);
    const navLabel = (key, fallback) => textOr(navCopy[key], fallback);
    const brandMark = s.logoImage ? `<img class="brand-logo" src="${esc(assetUrl(s.logoImage))}" alt="${textOr(s.shortName,'EDCKPRCAS')} official logo">` : `<span class="brand-mark"><span>KPR</span><span class="brand-mark-sub">EDC</span></span>`;
    $('#site-header').innerHTML = `
      <div class="top-strip"><div class="wrap"><span class="top-strip-centre"><strong>${navLabel('topLinePrefix','Established')} ${textOr(s.established,'2020')}</strong> <span aria-hidden="true">·</span> ${navLabel('topLineBrand','EDCKPRCAS')}</span></div></div>
      <header class="site-header" id="siteHeader"><div class="wrap nav-main">
        <a class="brand brand-logo-only" href="index.html" aria-label="${textOr(s.shortName,'EDCKPRCAS')} home">${brandMark}</a>
        <nav class="main-nav" aria-label="Main navigation">
          <a class="${active('about')}" href="about.html">${navLabel('mainAbout','About')}</a>
          <a class="${active('people')}" href="people.html">${navLabel('mainPeople','People')}</a>
          <a class="${active('events')}" href="events.html">${navLabel('mainProgrammes','Programmes')}</a>
          <a class="${active('startups')}" href="startups.html">${navLabel('mainVentures','Ventures')}</a>
          <a class="${active('impact')}" href="impact.html">${navLabel('mainImpact','Impact')}</a>
          <a class="${active('social')}" href="social-media.html">${navLabel('mainSocial','Social media')}</a>
          <a class="${active('gallery')}" href="gallery.html">${navLabel('mainGallery','Gallery')}</a>
          <div class="nav-more"><button type="button" id="megaToggle" aria-haspopup="true" aria-expanded="false" aria-controls="edcMegaMenu">${navLabel('exploreLabel','Explore')} <span class="nav-caret" aria-hidden="true">↗</span></button>
            <div class="mega-menu" id="edcMegaMenu" aria-label="Explore website sections"><div class="mega-menu-top"><span class="eyebrow">${navLabel('megaTitle','Explore EDCKPRCAS')}</span></div><div class="mega-menu-grid">${groups.map(group=>`<section class="mega-group"><span class="mega-group-title">${esc(group.title)}</span><small>${esc(group.note)}</small>${group.links.map(([href,label])=>`<a class="${active(href.replace('.html',''))}" href="${esc(safeUrl(href)||'#')}">${esc(label)}<b>↗</b></a>`).join('')}</section>`).join('')}</div></div>
          </div>
        </nav>
        <div class="nav-action"><a class="btn nav-cta" href="contact.html">${navLabel('reachOutLabel','Reach out')} <span class="btn-arrow">↗</span></a><button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="mobileNav">Menu +</button></div>
      </div><nav class="mobile-nav" id="mobileNav" aria-label="Mobile navigation">${[['index.html','Home','home'],...links.map(item=>[item.url||'#',item.label||'Explore',(item.url||'').replace('.html','')])].map(([href,label,key])=>`<a class="${active(key)}" href="${esc(safeUrl(href)||'#')}">${esc(label)}</a>`).join('')}</nav></header>`;
    const hdr = $('#siteHeader');
    const onScroll = () => hdr?.classList.toggle('scrolled', window.scrollY > 12);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    const megaButton = $('#megaToggle');
    megaButton?.addEventListener('click', () => {
      const panel = $('#edcMegaMenu'); const open = panel.classList.toggle('open');
      megaButton.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-more')) { $('#edcMegaMenu')?.classList.remove('open'); megaButton?.setAttribute('aria-expanded','false'); }
    });
    $('#menuBtn')?.addEventListener('click', () => {
      const nav = $('#mobileNav'); const open = nav.classList.toggle('open');
      $('#menuBtn').setAttribute('aria-expanded', String(open)); $('#menuBtn').textContent = open ? 'Close ×' : 'Menu +';
    });
  }

  function pageEndPanel() {
    const panelPage = ({ social: 'social-media', reports: 'annual-reports', 'blog-detail': 'blogs', 'team-year': 'people' })[page] || page;
    const item = (data.pagePanels || []).find(x => x.page === panelPage);
    if (!item) return '';
    const tones = ['navy','mint','white','soft','green'];
    const tone = tones[Math.max(0, (['about','people','events','startups','impact','messages','gallery','blogs','social','mentors','reports','contact','opportunities','achievements'].indexOf(panelPage === 'team-year' ? 'people' : panelPage)) % tones.length)];
    const destination = safeUrl(item.buttonUrl);
    const currentFile = ({social:'social-media.html',reports:'annual-reports.html','blog-detail':'blog.html','team-year':'team.html'}[page] || `${page}.html`).toLowerCase();
    const targetFile = String(destination || '').split('?')[0].split('/').pop().toLowerCase();
    const showButton = Boolean(destination && item.buttonLabel && targetFile !== currentFile && !destination.endsWith('#'));
    return `<section class="page-end-panel page-end-tone-${tone}"><div class="wrap page-end-inner"><div class="page-end-copy reveal"><div class="eyebrow">${textOr(item.eyebrow,'KPRCAS EDC')}</div><h2>${textOr(item.title)}</h2><p>${textOr(item.text)}</p>${showButton ? `<a class="btn" href="${esc(destination)}">${textOr(item.buttonLabel)} <span class="btn-arrow" aria-hidden="true">↗</span></a>` : ''}</div><div class="page-end-image reveal reveal-delay-1">${item.image ? img(item.image,item.title) : `<div class="media-placeholder" aria-label="EDC image area"><span>EDC-KPRCAS</span></div>`}</div></div></section>`;
  }

  function socialMark(key) {
    const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    if (key === 'linkedin') return `<svg ${common}><path fill="currentColor" d="M5.2 3.5a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2ZM3.5 9.2h3.4v11.3H3.5zM9.1 9.2h3.3v1.5h.05a3.6 3.6 0 0 1 3.25-1.8c3.45 0 4.1 2.25 4.1 5.15v6.45h-3.45v-5.72c0-1.37-.03-3.13-1.9-3.13-1.9 0-2.2 1.48-2.2 3.03v5.82H9.1z"/></svg>`;
    if (key === 'instagram') return `<svg ${common}><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.7" cy="6.5" r="1.2" fill="currentColor"/></svg>`;
    if (key === 'youtube') return `<svg ${common}><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.5v-7l6 3.5z"/></svg>`;
    if (key === 'facebook') return `<svg ${common}><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8z"/></svg>`;
    return '';
  }

  function renderFooter() {
    const s = data.site || {}; const h = data.home || {}; const n = data.navigation || {};
    const social = [['linkedin','LinkedIn'],['instagram','Instagram'],['youtube','YouTube'],['facebook','Facebook']].filter(([key]) => s[key]);
    const fallbackFooter = [
      {heading:'The EDC',label:'About the EDC',url:'about.html'},{heading:'The EDC',label:'People',url:'people.html'},{heading:'The EDC',label:'Messages from heads',url:'messages.html'},{heading:'The EDC',label:'Impact so far',url:'impact.html'},
      {heading:'Programmes & ventures',label:'Events & programmes',url:'events.html'},{heading:'Programmes & ventures',label:'Student ventures',url:'startups.html'},{heading:'Programmes & ventures',label:'Opportunities',url:'opportunities.html'},{heading:'Programmes & ventures',label:'Mentor network',url:'mentors.html'},
      {heading:'Stories & contact',label:'Achievements',url:'achievements.html'},{heading:'Stories & contact',label:'Gallery',url:'gallery.html'},{heading:'Stories & contact',label:'Blogs',url:'blogs.html'},{heading:'Stories & contact',label:'Social media',url:'social-media.html'},{heading:'Stories & contact',label:'Annual reports',url:'annual-reports.html'},{heading:'Stories & contact',label:'Reach us',url:'contact.html'}
    ];
    const footerLinks = (Array.isArray(n.footerGroups) && n.footerGroups.length ? n.footerGroups : fallbackFooter).filter(item => !/admin|administration/i.test(item.label || '') && item.url !== 'content-manager/');
    const footerColumns = [...new Set(footerLinks.map(item=>item.heading || 'Explore'))].map(heading=>({heading,links:footerLinks.filter(item=>item.heading===heading)}));
    const homeCta = page === 'home' ? `<section class="cta-band"><div class="wrap cta-inner"><div><div class="eyebrow eyebrow-light">${textOr(h.ctaEyebrow,'EDCKPRCAS')}</div><h2>${textOr(h.ctaTitle,'Have an idea worth exploring?')}</h2><p>${textOr(h.ctaText,'Bring your question or programme enquiry to the EDC team.')}</p></div><a href="${esc(safeUrl(h.ctaButtonUrl)||'contact.html')}" class="btn btn-white">${textOr(h.ctaButtonLabel,'Start an enquiry')} <span class="btn-arrow">↗</span></a></div></section>` : pageEndPanel();
    $('#site-footer').innerHTML = `${homeCta}
      <footer class="site-footer"><div class="footer-wordmark-wrap"><div class="footer-typing" aria-label="EDC"><span class="footer-typing-text" data-footer-typing>EDC</span><span class="footer-cursor" aria-hidden="true"></span></div><div class="footer-tagline" data-footer-tagline aria-label="Think Entrepreneur! Become Entrepreneur!!"></div></div><div class="wrap"><div class="footer-grid"><div class="footer-brand"><a class="brand footer-brand-lockup" href="index.html" aria-label="EDCKPRCAS home">${s.logoImage ? `<img class="footer-brand-logo" src="${esc(assetUrl(s.logoImage))}" alt="EDCKPRCAS official logo">` : `<span class="brand-mark"><span>KPR</span><span class="brand-mark-sub">EDC</span></span>`}</a><p>${textOr(n.footerBrandLine,'EDCKPRCAS')}</p><div class="footer-socials">${social.map(([key,label])=>`<a href="${esc(safeUrl(s[key]))}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${socialMark(key)}</a>`).join('')}</div></div>
      ${footerColumns.map(col=>`<div class="footer-col"><h4>${esc(col.heading)}</h4>${col.links.map(item=>`<a href="${esc(safeUrl(item.url)||'#')}">${esc(item.label)}</a>`).join('')}</div>`).join('')}</div>
      <div class="footer-bottom"><span>Created by Bavishnu (Associate - EDCKPRCAS) · <a href="mailto:bavishnu919@gmail.com">bavishnu919@gmail.com</a></span></div></div></footer>`;
    runFooterTyping();
  }

  function runFooterTyping() {
    const node = $('[data-footer-typing]');
    const tagline = $('[data-footer-tagline]');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const typeLoop = (element, phrase, typeDelay, deleteDelay, endPause, startPause) => {
      if (!element) return;
      if (reduce) { element.textContent = phrase; return; }
      let cursor = 0, direction = 1;
      element.textContent = '';
      const tick = () => {
        if (!element.isConnected) return;
        cursor += direction;
        element.textContent = phrase.slice(0, cursor);
        if (cursor >= phrase.length) { direction = -1; window.setTimeout(tick, endPause); return; }
        if (cursor <= 0) { direction = 1; window.setTimeout(tick, startPause); return; }
        window.setTimeout(tick, direction > 0 ? typeDelay : deleteDelay);
      };
      window.setTimeout(tick, startPause);
    };
    typeLoop(node, 'EDC', 480, 240, 1900, 500);
    typeLoop(tagline, 'Think Entrepreneur! Become Entrepreneur!!', 64, 30, 1500, 1000);
  }

  function pageHero(kicker, title, description, number) {
    const pageIntro = (data.pageIntros || []).find(item => item.page === page);
    kicker = pageIntro?.eyebrow || kicker; title = pageIntro?.title || title;
    description = pageIntro?.description || description;
    return `<section class="page-hero"><div class="wrap page-hero-inner"><div class="page-hero-copy"><div class="eyebrow"><span class="eyebrow-rule"></span>${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p><div class="breadcrumb"><a href="index.html">Home</a><span> / </span>${esc(title)}</div></div><div class="page-hero-art">${pageIntro?.image ? `<div class="page-hero-photo">${img(pageIntro.image,title)}</div>` : ''}${pageDiagramSvg(page)}</div></div></section>`;
  }
  function sectionHead(kicker, title, description = '') {
    return `<div class="section-head"><div><div class="eyebrow">${esc(kicker)}</div><h2>${esc(title)}</h2></div>${description ? `<p>${esc(description)}</p>` : ''}</div>`;
  }
  function ctaLink(label, href = 'contact.html') { return `<a class="text-link" href="${esc(safeUrl(href) || 'contact.html')}">${esc(label)} <span class="btn-arrow">↗</span></a>`; }

  function ecosystemDiagramSvg() {
    return `<svg class="ecosystem-svg" viewBox="0 0 760 330" role="img" aria-label="A diagram of students, mentors, programmes and ventures connected through the EDCKPRCAS" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="edcCore" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#00a86b" stop-opacity=".30"/><stop offset="1" stop-color="#00a86b" stop-opacity="0"/></radialGradient></defs>
      <g fill="none" stroke="#8da5bd" stroke-width="1.8" opacity=".7"><path d="M380 165L155 74M380 165L605 75M380 165L150 260M380 165L610 258M380 165L380 42M380 165L380 290"/><path d="M155 74L380 42L605 75M150 260L380 290L610 258" stroke-dasharray="5 7" opacity=".65"/></g>
      <circle cx="380" cy="165" r="110" fill="url(#edcCore)"/><circle cx="380" cy="165" r="58" fill="#102a56"/><circle cx="380" cy="165" r="48" fill="none" stroke="#00a86b" stroke-width="2"/><text x="380" y="160" text-anchor="middle" fill="#fff" font-family="Manrope,Arial,sans-serif" font-size="20" font-weight="800">EDC</text><text x="380" y="183" text-anchor="middle" fill="#a9efd2" font-family="DM Sans,Arial,sans-serif" font-size="9" letter-spacing="2">KPRCAS</text>
      <g fill="#fff" stroke="#9eb1c5" stroke-width="1.5"><rect x="92" y="44" width="126" height="60" rx="7"/><rect x="542" y="45" width="126" height="60" rx="7"/><rect x="84" y="230" width="132" height="60" rx="7"/><rect x="544" y="228" width="132" height="60" rx="7"/><rect x="320" y="12" width="120" height="54" rx="7"/><rect x="315" y="264" width="130" height="54" rx="7"/></g>
      <g fill="#102a56" font-family="Manrope,Arial,sans-serif" font-size="12" font-weight="800" text-anchor="middle"><text x="155" y="79">STUDENTS</text><text x="605" y="80">MENTORS</text><text x="150" y="265">PROGRAMMES</text><text x="610" y="263">VENTURES</text><text x="380" y="44">INDUSTRY</text><text x="380" y="296">IMPACT</text></g>
      <g fill="#00a86b"><circle class="diagram-pulse" cx="155" cy="44" r="5"/><circle class="diagram-pulse delay-1" cx="605" cy="45" r="5"/><circle class="diagram-pulse delay-2" cx="150" cy="230" r="5"/><circle class="diagram-pulse delay-3" cx="610" cy="228" r="5"/><circle class="diagram-pulse delay-2" cx="380" cy="12" r="5"/><circle class="diagram-pulse delay-1" cx="380" cy="264" r="5"/></g>
      <g fill="#2877e8"><circle cx="280" cy="120" r="3"/><circle cx="490" cy="126" r="3"/><circle cx="270" cy="212" r="3"/><circle cx="500" cy="208" r="3"/></g>
    </svg>`;
  }

  function pageDiagramSvg(key) {
    const common = `fill="none" stroke="#7890aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    const shapes = {
      about:`<circle cx="150" cy="105" r="58" ${common}/><circle cx="150" cy="105" r="28" stroke="#00a86b" stroke-width="3"/><path d="M150 18V47M150 163V192M63 105H92M208 105H237M88 43L109 64M191 146L212 167M212 43L191 64M109 146L88 167" ${common}/><circle cx="150" cy="105" r="7" fill="#2877e8"/>`,
      people:`<g ${common}><path d="M150 40L70 110L150 174L230 110Z"/><path d="M70 110L150 110L230 110M150 40V174"/></g><g fill="#fff" stroke="#00a86b" stroke-width="3"><circle cx="150" cy="40" r="17"/><circle cx="70" cy="110" r="17"/><circle cx="230" cy="110" r="17"/><circle cx="150" cy="174" r="17"/></g><circle cx="150" cy="110" r="23" fill="#102a56"/><text x="150" y="115" text-anchor="middle" fill="white" font-size="14" font-weight="800">EDC</text>`,
      events:`<g ${common}><rect x="58" y="40" width="184" height="138" rx="8"/><path d="M58 78H242M93 28V54M207 28V54"/><path d="M91 99H112M131 99H152M171 99H192M91 125H112M131 125H152M171 125H192M91 151H112M131 151H152"/></g><rect x="125" y="84" width="22" height="22" fill="#00a86b" opacity=".8"/>`,
      startups:`<g ${common}><path d="M55 174H245"/><rect x="75" y="128" width="30" height="46" fill="#cfe0f0"/><rect x="132" y="90" width="30" height="84" fill="#b4d8ca"/><rect x="189" y="52" width="30" height="122" fill="#2877e8"/><path d="M70 112L144 72L202 34" stroke="#00a86b" stroke-width="3"/><path d="M187 34H202V49" stroke="#00a86b" stroke-width="3"/></g>`,
      impact:`<g fill="none"><circle cx="150" cy="108" r="80" stroke="#d4e0eb" stroke-width="16"/><circle cx="150" cy="108" r="80" stroke="#00a86b" stroke-width="16" stroke-dasharray="340 170" transform="rotate(-90 150 108)"/><circle cx="150" cy="108" r="53" stroke="#2877e8" stroke-width="2"/><circle cx="150" cy="108" r="28" fill="#102a56"/></g><text x="150" y="114" text-anchor="middle" fill="white" font-size="15" font-weight="800">EDC</text>`,
      messages:`<g ${common}><path d="M48 56H252V156H112L78 184V156H48Z"/><path d="M83 91H217M83 116H196" stroke="#00a86b" stroke-width="4"/><circle cx="220" cy="56" r="10" fill="#2877e8" stroke="none"/></g>`,
      gallery:`<g stroke="#7890aa" stroke-width="2"><rect x="44" y="36" width="94" height="66" fill="#dce7f1"/><rect x="151" y="36" width="103" height="112" fill="#ccebdd"/><rect x="44" y="113" width="94" height="75" fill="#e8edf3"/><rect x="151" y="159" width="103" height="29" fill="#2877e8"/></g>`,
      blogs:`<g ${common}><path d="M67 32H198L232 66V184H67Z"/><path d="M198 32V66H232M91 92H205M91 116H205M91 140H190M91 164H166"/><path d="M87 32V184" stroke="#00a86b" stroke-width="4"/></g>`,
      social:`<g ${common}><circle cx="150" cy="106" r="72"/><circle cx="150" cy="106" r="45"/><circle cx="150" cy="106" r="18" fill="#00a86b"/><path d="M150 34V16M222 106H244M150 178V196M78 106H56"/></g><g fill="#2877e8"><circle cx="150" cy="16" r="6"/><circle cx="244" cy="106" r="6"/><circle cx="150" cy="196" r="6"/><circle cx="56" cy="106" r="6"/></g>`,
      mentors:`<g ${common}><path d="M150 36L220 75V147L150 186L80 147V75Z"/><path d="M150 36V186M80 75L220 147M220 75L80 147"/></g><g fill="#fff" stroke="#00a86b" stroke-width="3"><circle cx="150" cy="36" r="11"/><circle cx="220" cy="75" r="11"/><circle cx="220" cy="147" r="11"/><circle cx="150" cy="186" r="11"/><circle cx="80" cy="147" r="11"/><circle cx="80" cy="75" r="11"/></g>`,
      reports:`<g ${common}><path d="M70 30H184L222 68V184H70Z"/><path d="M184 30V68H222M94 92H196M94 116H196M94 140H196M94 164H168"/><path d="M52 48V201H202" stroke="#00a86b"/></g>`,
      contact:`<g ${common}><path d="M48 48H252V156H126L82 190V156H48Z"/><circle cx="101" cy="102" r="7" fill="#00a86b" stroke="none"/><circle cx="150" cy="102" r="7" fill="#2877e8" stroke="none"/><circle cx="199" cy="102" r="7" fill="#00a86b" stroke="none"/></g>`,
      opportunities:`<g ${common}><path d="M150 30V86M150 86L80 142M150 86L220 142M80 142V182M150 86V182M220 142V182"/><rect x="125" y="20" width="50" height="24" rx="5" fill="#102a56"/><rect x="54" y="178" width="52" height="23" rx="5" fill="#00a86b"/><rect x="124" y="178" width="52" height="23" rx="5" fill="#2877e8"/><rect x="194" y="178" width="52" height="23" rx="5" fill="#00a86b"/></g>`
    };
    return `<svg class="page-diagram-svg" viewBox="0 0 300 220" role="img" aria-label="${esc(key)} illustration" xmlns="http://www.w3.org/2000/svg">${shapes[key] || shapes.about}<g fill="#00a86b"><circle class="diagram-pulse" cx="48" cy="42" r="4"/><circle class="diagram-pulse delay-2" cx="255" cy="183" r="4"/><circle class="diagram-pulse delay-1" cx="249" cy="36" r="3"/></g></svg>`;
  }

  function voiceCarousel(items) {
    const ordered = [...items].sort((a,b) => Number(a.order || 0) - Number(b.order || 0));
    return `<div class="voice-carousel voice-carousel-leadership" data-voice-autoplay data-voice-interval="5000"><div class="voice-slides">${ordered.map((m,i)=>`<article class="voice-slide ${i===0?'active':''}" data-voice-slide="${i}"><div class="voice-leader-photo">${m.image ? img(m.image,`${m.name} – ${m.designation||'EDCKPRCAS leadership'}`) : `<span class="voice-author-placeholder">${esc(String(m.name||'EDC').split(/\s+/).map(x=>x[0]).join('').slice(0,2))}</span>`}</div><div class="voice-leader-copy"><div class="voice-slide-top"><span class="voice-index">${String(i+1).padStart(2,'0')} / ${String(ordered.length).padStart(2,'0')}</span><span class="voice-slide-label">Message from leadership</span></div><h3 class="voice-leader-name">${esc(m.name || 'EDCKPRCAS Leadership')}</h3>${m.designation ? `<p class="voice-leader-designation">${esc(m.designation)}</p>` : ''}${m.heading ? `<h4 class="voice-message-heading">${esc(m.heading)}</h4>` : ''}<p class="voice-message-body">${esc(m.quote || '')}</p></div></article>`).join('')}</div><div class="voice-controls"><div class="voice-dots">${ordered.map((m,i)=>`<span class="voice-dot ${i===0?'active':''}" data-voice-dot="${i}" aria-hidden="true"></span>`).join('')}</div></div></div>`;
  }

  function homePage() {
    const h = data.home || {};
    const wall = h.ecosystemWall || [];
    const frictions = h.frictionPoints || [];
    const journey = h.journey || [];
    const voiceMessages = data.messages || [];
    const leftPoints = h.comparisonLeftPoints || [];
    const rightPoints = h.comparisonRightPoints || [];
    const videoEmbed = youtubeEmbed(h.anthemVideoUrl);
    const anthemId = youtubeVideoId(h.anthemVideoUrl);
    return `<section class="home-hero edc-hero"><div class="wrap">
      <div class="edc-hero-head"><div class="hero-kicker eyebrow"><span class="eyebrow-rule"></span>${textOr(h.eyebrow,'EDCKPRCAS · ESTABLISHED 2020')}</div>
        <h1 class="edc-hero-title" data-scramble-slow><span>${textOr(h.title,'Think Entrepreneur! Become Entrepreneur!!')}</span></h1>
        <div class="edc-hero-copy"><p>${textOr(h.description,'The EDCKPRCAS helps students build entrepreneurial capability through programmes, teams, mentor interactions and student-led ventures.')}</p><div class="hero-actions"><a class="btn" href="${esc(safeUrl(h.primaryUrl) || 'startups.html')}">${textOr(h.primaryLabel,'Explore student ventures')} <span class="btn-arrow" aria-hidden="true">↗</span></a><a class="btn btn-outline" href="${esc(safeUrl(h.secondaryUrl) || 'about.html')}">${textOr(h.secondaryLabel,'Discover the EDC')} <span class="btn-arrow" aria-hidden="true">↗</span></a></div></div>
      </div>
      <div class="home-diagram reveal"><div class="home-diagram-copy"><div class="eyebrow">${textOr(h.diagramEyebrow,'EDC ecosystem map')}</div><h2>${textOr(h.diagramTitle,'Students, mentors, programmes and ventures.')}</h2><p>${textOr(h.diagramText,'A practical campus ecosystem for learning, collaboration and student enterprise.')}</p><a class="text-link" href="${esc(safeUrl(h.diagramLinkUrl)||'about.html')}">${textOr(h.diagramLinkLabel,'About the EDC')} <span class="btn-arrow" aria-hidden="true">↗</span></a></div><div class="home-diagram-art">${h.heroImage ? `<div class="home-diagram-photo">${img(h.heroImage,'KPRCAS EDC student community')}</div>` : ecosystemDiagramSvg()}</div></div>
    </div></section>
    <section class="section edc-wall-section"><div class="wrap"><div class="edc-wall-head"><div><div class="eyebrow">${textOr(h.ecosystemEyebrow,'The EDC ecosystem')}</div><h2>${textOr(h.ecosystemTitle,'People, programmes and student enterprise.')}</h2></div><p>${textOr(h.ecosystemDescription,'An active campus community connecting students, mentors, programmes, industry perspectives and student ventures.')}</p></div><div class="edc-logo-wall" role="list">${wall.map((item,i)=>`<div class="wall-tile ${item.image?'has-image':''} reveal reveal-delay-${i%4}" role="listitem">${item.image ? `<div class="wall-tile-image">${img(item.image,item.label)}</div>` : `<span class="wall-mark">${esc(item.mark || String(item.label||'EDC').slice(0,3))}</span>`}<b>${esc(item.label)}</b><small>${esc(item.sub || '')}</small></div>`).join('')}</div><div class="wall-foot"><span>${textOr(h.wallFootLabel,'EDCKPRCAS')}</span></div></div></section>
    <section class="section stakeholders-section"><div class="wrap"><div class="stakeholders-head"><div><div class="eyebrow">${textOr(h.stakeholderEyebrow,'OUR STAKEHOLDERS')}</div><h2>${textOr(h.stakeholderTitle,'Our stakeholders')}</h2></div><p>${textOr(h.stakeholderDescription,'Organisations and institutions connected with student entrepreneurship and EDC activities.')}</p></div></div>${(h.stakeholders||[]).filter(item=>item.logo).length ? `<div class="stakeholder-marquee" aria-label="EDC stakeholders"><div class="stakeholder-track">${[...(h.stakeholders||[]).filter(item=>item.logo),...(h.stakeholders||[]).filter(item=>item.logo)].map(item=>`<div class="stakeholder-logo" title="${esc(item.name||'EDC stakeholder')}">${img(item.logo,item.name||'EDC stakeholder')}</div>`).join('')}</div></div>` : `<div class="wrap"><div class="stakeholder-empty">Stakeholder logos will appear here after they are uploaded in the Home page CMS.</div></div>`}</section>
    <section class="section section-dark edc-friction-section"><div class="wrap"><div class="section-head"><div><div class="eyebrow eyebrow-light">${textOr(h.focusEyebrow,'How student enterprise develops')}</div><h2>${textOr(h.focusTitle,'A practical process, from first question to next milestone.')}</h2></div><p>${textOr(h.focusDescription,'The EDC encourages students to work through the key steps involved in developing an idea and a committed team.')}</p></div><div class="friction-grid">${frictions.map((f,i)=>`<article class="friction-card reveal reveal-delay-${i%3}"><div class="friction-card-image">${f.image ? img(f.image,f.title) : `<div class="media-placeholder"><span>EDC ACTIVITY</span></div>`}</div><span class="friction-number">${esc(f.symbol || String(i+1).padStart(2,'0'))}</span><div class="friction-motif" aria-hidden="true">${String(i+1).padStart(2,'0')}</div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p><span class="friction-line"></span></article>`).join('')}</div></div></section>
    <section class="section edc-journey-section"><div class="wrap"><div class="section-head"><div><div class="eyebrow">${textOr(h.pathwayEyebrow,'The EDC pathway')}</div><h2>${textOr(h.pathwayTitle,'From an idea to a tested next step.')}</h2></div><p>${textOr(h.pathwayDescription,'A set of practical steps that student teams can adapt to their idea, context and pace.')}</p></div><div class="journey-scroll-window" data-journey-scroll><div class="journey-scroll-panels">${journey.map((step,i)=>`<article class="journey-scroll-panel journey-tone-${i%6+1}" data-journey-panel="${i}"><div class="journey-scroll-copy"><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p><div class="journey-output"><span>${textOr(h.journeyOutputLabel,'WHAT THIS STEP CREATES')}</span><b>${esc(step.output || '')}</b></div></div><div class="journey-scroll-visual">${step.image ? `<div class="journey-stage-image">${img(step.image,step.title)}</div>` : `<div class="journey-visual-grid"></div><div class="journey-orb-graphic"><span class="orb orb-one"></span><span class="orb orb-two"></span><span class="orb orb-three"></span><span class="orb-center">${String(i+1).padStart(2,'0')}</span><div class="orb-ring ring-one"></div><div class="orb-ring ring-two"></div></div>`}</div></article>`).join('')}</div><div class="journey-scroll-progress"><span data-journey-progress></span></div><div class="journey-scroll-count" aria-live="polite"><span data-journey-current>01</span><span>/ ${String(journey.length).padStart(2,'0')}</span></div><div class="journey-scroll-hint">${textOr(h.journeyHint,'Scroll up or down to move between steps')}</div><button type="button" class="journey-exit" data-journey-exit>${textOr(h.journeyExitLabel,'Continue below')} <span aria-hidden="true">↘</span></button></div></div></section>
    <section class="section section-mint edc-compare-section"><div class="wrap"><div class="section-head"><div><div class="eyebrow">${textOr(h.comparisonEyebrow,'The value of structured support')}</div><h2>${textOr(h.comparisonTitle,'Move from individual interest to shared progress.')}</h2></div><p>${textOr(h.comparisonDescription,'The EDC encourages student teams to work with clear goals, useful feedback and evidence from real contexts.')}</p></div><div class="compare-grid"><article class="compare-card compare-muted reveal"><span class="compare-label">${textOr(h.comparisonLeftLabel,'EARLY EXPLORATION')}</span><h3>${textOr(h.comparisonLeftTitle,'Starting with an idea')}</h3><div class="compare-panel-image">${h.comparisonLeftImage ? img(h.comparisonLeftImage,'Early exploration') : `<div class="media-placeholder"><span>EARLY EXPLORATION</span></div>`}</div><ul>${leftPoints.map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul></article><article class="compare-card compare-strong reveal reveal-delay-1"><span class="compare-label">${textOr(h.comparisonRightLabel,'SUPPORTED DEVELOPMENT')}</span><h3>${textOr(h.comparisonRightTitle,'Developing through the EDC')}</h3><div class="compare-panel-image">${h.comparisonRightImage ? img(h.comparisonRightImage,'EDC-supported development') : `<div class="media-placeholder"><span>EDC DEVELOPMENT</span></div>`}</div><ul>${rightPoints.map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul><a href="${esc(safeUrl(h.comparisonLinkUrl)||'about.html')}" class="text-link">${textOr(h.comparisonLinkLabel,'Explore the EDC approach')} <span class="btn-arrow" aria-hidden="true">↗</span></a></article></div></div></section>
    <section class="section edc-anthem-section"><div class="wrap"><div class="section-head"><div><div class="eyebrow">${textOr(h.anthemEyebrow,'EDC-KPRCAS anthem')}</div><h2>${textOr(h.anthemTitle,'The EDC community in motion')}</h2></div><p>${textOr(h.anthemDescription,'Watch the official Entrepreneurship Development Cell anthem.')}</p></div><div class="anthem-video-frame">${anthemId ? `<button class="anthem-thumbnail" type="button" data-play-anthem="${anthemId}" aria-label="Play the EDC-KPRCAS anthem"><img data-anthem-thumbnail data-video-id="${anthemId}" data-poster="${esc(safeUrl(h.anthemPoster)||'')}" src="https://i.ytimg.com/vi/${anthemId}/hqdefault.jpg" alt="EDC-KPRCAS anthem video thumbnail"><span class="anthem-play-button" aria-hidden="true">▶</span><b>${textOr(h.anthemTitle,'EDC-KPRCAS anthem')}</b></button>` : `<div class="anthem-video-placeholder">${h.anthemPoster ? img(h.anthemPoster,'EDC-KPRCAS anthem poster') : (data.site?.logoImage ? img(data.site.logoImage,'EDC-KPRCAS official logo') : '<span class="anthem-placeholder-mark">EDC</span>')}<b>${textOr(h.anthemPlaceholderTitle,'EDC-KPRCAS Anthem')}</b><span>${textOr(h.anthemPlaceholderText,'Add the official YouTube link in Admin → Home page.')}</span></div>`}</div></div></section>
    <section class="section edc-feature-section"><div class="wrap"><div class="feature-band reveal"><div class="feature-band-image">${h.featureImage ? img(h.featureImage,'EDC student participation') : `<div class="media-placeholder"><span>EDC-KPRCAS</span></div>`}</div><div class="feature-band-copy"><div class="eyebrow eyebrow-light">${textOr(h.featureEyebrow,'Student participation')}</div><h2>${textOr(h.featureTitle,'Build the confidence to take an idea forward.')}</h2><p>${textOr(h.featureText,'Take part in workshops, founder conversations, entrepreneurship challenges and guided experimentation.')}</p><a href="${esc(safeUrl(h.featureButtonUrl)||'events.html')}" class="btn btn-white">${textOr(h.featureButtonLabel,'Explore programmes')} <span class="btn-arrow" aria-hidden="true">↗</span></a></div></div></div></section>
    <section class="section section-soft edc-work-section"><div class="wrap"><div class="section-head"><div><div class="eyebrow">${textOr(h.workEyebrow,'Explore EDC activities')}</div><h2>${textOr(h.workTitle,'People, programmes and student ventures.')}</h2></div><p>${textOr(h.workDescription,'Explore the work and opportunities that contribute to entrepreneurship development at KPRCAS.')}</p></div><div class="card-grid">${(h.workCards||[]).map((card,i)=>{const url=safeUrl(card.url)||'contact.html';return `<a class="card reveal reveal-delay-${Math.min(i%3,3)}" href="${esc(url)}"><div class="card-image">${card.image ? img(card.image,card.title) : `<div class="media-placeholder"><span>${esc(card.category||'EDC ACTIVITY')}</span></div>`}</div><div class="card-body"><div class="card-meta"><span>${esc(card.number||String(i+1).padStart(2,'0'))} / ${esc(card.eyebrow||'EDC')}</span><span class="card-tag">${esc(card.category||'EDC')}</span></div><h3>${esc(card.title)}</h3><p>${esc(card.text)}</p><div class="card-foot"><span>${esc(card.buttonLabel||'Explore')}</span><span class="card-arrow">↗</span></div></div></a>`;}).join('')}</div></div></section>
    <section class="section edc-blog-section"><div class="wrap"><div class="section-head"><div><div class="eyebrow">${textOr(h.blogEyebrow,'EDC stories and perspectives')}</div><h2>${textOr(h.blogTitle,'Ideas, insights and practical learning.')}</h2></div><p>${textOr(h.blogDescription,'Read perspectives on problem discovery, teamwork, innovation and student enterprise.')}</p></div><div class="blog-grid">${publishedBlogs().slice(0,3).map(blogCard).join('')}</div><div class="home-insights-link">${ctaLink(h.blogLinkLabel||'Read all insights',h.blogLinkUrl||'blogs.html')}</div></div></section>
    ${voiceMessages.length ? `<section class="section edc-voice-section"><div class="wrap"><div class="voice-heading"><div><div class="eyebrow">${textOr(h.messagesEyebrow,'Leadership perspectives')}</div><h2>${textOr(h.messagesTitle,'Messages from institutional leadership.')}</h2><p>${textOr(h.messagesDescription,'Perspectives from the leaders who support entrepreneurship development at KPRCAS.')}</p></div><a href="${esc(safeUrl(h.messagesLinkUrl)||'messages.html')}" class="text-link">${textOr(h.messagesLinkLabel,'All messages')} <span class="btn-arrow" aria-hidden="true">↗</span></a></div>${voiceCarousel(voiceMessages)}</div></section>` : ''}
    <section class="section edc-final-section"><div class="wrap"><h2 class="edc-final-title reveal" data-scramble-slow>${textOr(h.finalTitle,'Think Entrepreneur! Become Entrepreneur!!')}</h2><div class="edc-final-bottom"><p>${textOr(h.finalText,'Explore the people, programmes, ventures and outcomes of the EDCKPRCAS.')}</p><a class="btn" href="${esc(safeUrl(h.finalButtonUrl)||'about.html')}">${textOr(h.finalButtonLabel,'Explore the EDC')} <span class="btn-arrow" aria-hidden="true">↗</span></a></div></div></section>`;
  }

  function aboutPage() {
    const a = data.about || {};
    return `${pageHero(a.eyebrow,a.title,a.description,'01')}
      <section class="section"><div class="wrap intro-grid"><aside class="intro-aside reveal"><div class="eyebrow">${textOr(a.storyEyebrow,'Our story')}</div><div class="big-mark">${textOr(data.site?.established,'2020')}</div><div class="rule-label">${textOr(a.storyFootnote,'Established at KPRCAS')}</div><div class="about-story-image">${a.storyImage ? img(a.storyImage,a.storyTitle) : `<div class="media-placeholder"><span>EDC STORY</span></div>`}</div></aside><div class="intro-content reveal reveal-delay-1"><h2>${textOr(a.storyTitle,'Entrepreneurship as a campus-wide capability.')}</h2><p>${textOr(a.story,'A platform for exposure, experimentation and enterprise.')}</p></div></div></section>
      <section class="section section-soft"><div class="wrap"><div class="mission-grid"><article class="mission-card reveal"><div class="eyebrow">01 / ${textOr(a.missionLabel,'Mission')}</div><div class="about-purpose-image">${a.missionImage ? img(a.missionImage,'EDC mission') : `<div class="media-placeholder"><span>EDC MISSION</span></div>`}</div><h3>${textOr(a.missionTitle,'Why we exist.')}</h3><p>${textOr(a.mission)}</p></article><article class="mission-card reveal reveal-delay-1"><div class="eyebrow eyebrow-light">02 / ${textOr(a.visionLabel,'Vision')}</div><div class="about-purpose-image">${a.visionImage ? img(a.visionImage,'EDC vision') : `<div class="media-placeholder"><span>EDC VISION</span></div>`}</div><h3>${textOr(a.visionTitle,'What we are building towards.')}</h3><p>${textOr(a.vision)}</p></article></div></div></section>
      <section class="section"><div class="wrap">${sectionHead(textOr(a.principlesEyebrow,'What guides us'),textOr(a.principlesTitle,'A few principles. One shared ambition.'))}
        <div class="principle-grid">${(a.principles||[]).map((p,i)=>`<article class="principle reveal reveal-delay-${Math.min(i,3)}"><div class="principle-image">${p.image ? img(p.image,p.title) : `<div class="media-placeholder"><span>EDC PRINCIPLE</span></div>`}</div><div class="principle-num">0${i+1}</div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></article>`).join('')}</div></div></section>
      <section class="section section-soft"><div class="wrap">${sectionHead(textOr(a.journeyEyebrow,'Our journey'),textOr(a.journeyTitle,'Built over time. Strengthened by people.'))}
        <div class="timeline">${(a.journey||[]).map(j=>`<div class="timeline-item reveal"><div class="timeline-image">${j.image ? img(j.image,j.title) : `<div class="media-placeholder"><span>EDC MILESTONE</span></div>`}</div><b>${esc(j.year)}</b><h3>${esc(j.title)}</h3><p>${esc(j.text)}</p></div>`).join('')}</div></div></section>`;
  }

  function profileCard(item, i, mentor = false) {
    const role = mentor ? item.expertise : item.role;
    const meta = mentor ? item.organization : item.team;
    const link = mentor ? item.linkedin : item.linkedin;
    return `<article class="card profile-card reveal reveal-delay-${Math.min(i%3,3)}"><div class="card-image">${item.image ? img(item.image,item.name) : `<div class="media-placeholder"><span>${mentor?'MENTOR PORTRAIT':'EDC PROFILE'}</span></div>`}</div><div class="card-body"><div class="card-meta"><span>${esc(meta || (mentor?'Mentor network':'Team'))}</span><span class="card-tag">${mentor?'Mentor':'People'}</span></div><h3>${esc(item.name)}</h3><div class="profile-role">${esc(role)}</div><p>${esc(item.bio)}</p><div class="profile-links">${link ? `<a href="${esc(safeUrl(link))}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ''}${item.email ? `<a href="mailto:${esc(item.email)}">Email ↗</a>` : ''}</div></div></article>`;
  }
  function peoplePage() {
    const teams = data.teams || [];
    const profiles = data.people || [];
    const leadership = profiles.filter(person => !person.teamYear);
    return `${pageHero('People and student teams','The people who contribute to EDC activity.','Meet the people, student teams and collaborators who build the KPRCAS entrepreneurship ecosystem.','02')}
      <section class="section people-directory-section"><div class="wrap">${sectionHead('Leadership and coordinators','People behind the work.','Profiles are presented in the same card format as the mentor directory.')}
      ${leadership.length ? `<div class="card-grid people-profile-grid">${leadership.map((person,i)=>profileCard(person,i)).join('')}</div>` : `<div class="empty-state">People profiles will appear here when approved leadership and coordinator details are added through the Content Manager.</div>`}</div></section>
      <section class="section section-soft"><div class="wrap">${sectionHead('Student teams by academic year','Three academic years. One EDC community.','Choose an academic year to view its team roster, roles and approved photographs.')}
      ${teams.length ? `<div class="team-year-grid">${teams.map((team,i)=>`<a class="team-year-card reveal reveal-delay-${i%3}" href="team.html?year=${encodeURIComponent(team.yearKey||'')}" aria-label="View ${esc(team.title)}"><div class="team-year-image">${team.image ? img(team.image,team.title) : `<div class="team-year-art"><span>EDC STUDENT TEAM</span><strong>${esc(team.year || 'Academic year')}</strong><small>PEOPLE · ROLES · ACTIVITIES</small></div>`}</div><div class="team-year-copy"><span class="eyebrow">ACADEMIC YEAR</span><h3>${esc(team.title)}</h3><p>${esc(team.description)}</p><span class="team-year-link text-link">View team roster <span class="btn-arrow" aria-hidden="true">↗</span></span></div></a>`).join('')}</div>` : `<div class="empty-state">Academic-year teams will appear here when they are added through the Content Manager.</div>`}</div></section>`;
  }

  function teamYearPage() {
    const yearKey = new URLSearchParams(location.search).get('year') || '2026-2027';
    const team = (data.teams || []).find(t => t.yearKey === yearKey);
    if (!team) return `${pageHero('Student teams','Academic-year team not found.','Choose an academic year from the People page.','03')}<section class="section"><div class="wrap"><a class="btn" href="people.html">Back to People <span class="btn-arrow">↗</span></a></div></section>`;
    const members = (data.people || []).filter(p => p.teamYear === yearKey || p.teamYear === team.year);
    return `${pageHero(team.year,team.title,team.description,'03')}
      <section class="section"><div class="wrap">${sectionHead('Team roster',`EDC student team · ${team.year}`,'Profiles and responsibilities for this academic year.')}
      ${members.length ? `<div class="card-grid">${members.map((p,i)=>profileCard(p,i)).join('')}</div>` : `<div class="team-roster-empty"><div class="eyebrow">${esc(team.year)}</div><h2>Team profiles will appear here.</h2><p>The roster for this academic year can be published by adding members in Admin → People and selecting this academic year.</p></div>`}</div></section>`;
  }

  function eventRow(e,i) {
    const link = safeUrl(e.link);
    const picture = e.image ? img(e.image,e.title) : `<div class="media-placeholder"><span>EDC PROGRAMME</span></div>`;
    const date = e.date ? dateParts(e.date) : null;
    return `<article class="event-card reveal reveal-delay-${i%3}"><div class="event-card-image">${picture}</div><div class="event-card-copy"><div class="card-meta"><span>${esc(e.category||'EDC programme')}</span><span class="card-tag">${esc(e.status||'Programme')}</span></div><h3>${esc(e.title)}</h3><p>${esc(e.summary)}</p><div class="event-card-foot"><span>${date ? `${date.day} ${date.month} ${date.year}` : ''}${e.location ? ` · ${esc(e.location)}` : ''}</span>${link ? `<a class="text-link" href="${esc(link)}" target="_blank" rel="noopener">Programme details <span class="btn-arrow">↗</span></a>` : ''}</div></div></article>`;
  }
  function eventsPage() {
    const events = data.events || [];
    const categories = ['All',...new Set(events.map(e=>e.category).filter(Boolean))];
    const now = new Date(); now.setHours(0,0,0,0);
    const upcoming = events.filter(e => e.date && new Date(`${e.date}T00:00:00`) >= now && !/completed|closed/i.test(e.status||''));
    const archive = events.filter(e => !upcoming.includes(e));
    const upcomingSection = upcoming.length ? `<section class="section section-mint"><div class="wrap">${sectionHead('Upcoming programmes','Take part in what is next.')}<div class="event-card-grid">${upcoming.map((e,i)=>eventRow(e,i)).join('')}</div></div></section>` : '';
    const archiveSection = archive.length ? `<section class="section"><div class="wrap">${sectionHead('Programme archive','Learning through events and experiences.','Browse the EDC programme archive by category.')}<div class="filter-row" data-filter-container="events">${categories.map((c,i)=>`<button class="filter-chip ${i===0?'active':''}" data-filter="${esc(c)}" type="button">${esc(c)}</button>`).join('')}</div><div class="event-card-grid">${archive.map((e,i)=>`<div data-category="${esc(e.category||'')}" class="event-filter-item">${eventRow(e,i)}</div>`).join('')}</div></div></section>` : (events.length ? '' : `<section class="section"><div class="wrap">${sectionHead('Programmes','Activities will be listed here when confirmed.')}<div class="empty-state">No programme entries are currently published.</div></div></section>`);
    return `${pageHero('Events and programmes','Experiences that build entrepreneurial capability.','Explore EDC workshops, founder conversations, challenges, competitions and other learning experiences.','03')}${upcomingSection}${archiveSection}`;
  }

  function startupCard(s,i) {
    return `<article class="card reveal reveal-delay-${Math.min(i%3,3)}"><div class="card-image">${s.image ? img(s.image,s.name) : '<div class=\"media-placeholder\"><span>STUDENT VENTURE</span></div>'}</div><div class="card-body"><div class="card-meta"><span>${esc(s.sector)}</span><span class="card-tag">${esc(s.stage || 'Venture')}</span></div><h3>${esc(s.name)}</h3><p>${esc(s.summary)}</p><div class="card-foot">${s.founders ? `<span>${esc(s.founders)}</span>` : '<span>Student venture</span>'}${s.website && safeUrl(s.website) ? `<a class="card-arrow" href="${esc(safeUrl(s.website))}" target="_blank" rel="noopener" aria-label="Visit ${esc(s.name)}">↗</a>` : ''}</div></div></article>`;
  }
  function startupsPage() {
    const sectors = ['All',...new Set((data.startups||[]).map(s=>s.sector).filter(Boolean))];
    return `${pageHero('Venture portfolio','Meet the teams making ideas real.','Discover the startups and student ventures connected to the EDC.','04')}
      <section class="section"><div class="wrap">${sectionHead('The venture community','Different ideas. A shared drive to build.','Portfolio information is managed through the admin panel. Add verified founder details, venture links and progress updates.')}
      <div class="filter-row" data-filter-container="startups">${sectors.map((c,i)=>`<button class="filter-chip ${i===0?'active':''}" data-filter="${esc(c)}" type="button">${esc(c)}</button>`).join('')}</div>
      ${(data.startups||[]).length ? `<div class="card-grid">${(data.startups||[]).map(startupCard).join('')}</div>` : `<div class="empty-state">No student venture profiles are currently published.</div>`}</div></section>`;
  }

  function impactPage() {
    const d = data.impact || {};
    return `${pageHero(d.eyebrow,d.title,d.description,'05')}
      <section class="section section-dark"><div class="wrap"><div class="metric-grid">${(d.stats||[]).map((s,i)=>`<div class="metric reveal reveal-delay-${Math.min(i,3)}"><strong data-count-value="${esc(s.value)}">${esc(s.value)}</strong><h3>${esc(s.label)}</h3><p>${esc(s.note)}</p></div>`).join('')}</div></div></section>
      <section class="section"><div class="wrap impact-statement-layout"><div class="impact-quote reveal">${textOr(d.statement)}</div><div class="impact-statement-image">${d.statementImage ? img(d.statementImage,'EDC impact and student outcomes') : `<div class="media-placeholder"><span>EDC IMPACT</span></div>`}</div></div></section>
      <section class="section section-soft"><div class="wrap">${sectionHead(textOr(d.milestonesEyebrow,'Milestones'),textOr(d.milestonesTitle,'The journey behind the numbers.'))}
        <div class="milestone-list">${(d.milestones||[]).map(m=>`<article class="milestone reveal"><div class="milestone-image">${m.image ? img(m.image,m.title) : `<div class="media-placeholder"><span>EDC MILESTONE</span></div>`}</div><div class="year">${esc(m.year)}</div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></article>`).join('')}</div></div></section>`;
  }

  function messagesPage() {
    const items = data.messages || [];
    return `${pageHero('Leadership perspectives','Messages from the people who guide the EDC.','Read perspectives from institutional leadership on student initiative, collaboration and entrepreneurship development.','06')}
      <section class="section"><div class="wrap">${sectionHead('Messages from heads','Leadership perspectives.')}
      ${items.length ? voiceCarousel(items) : `<div class="empty-state">Approved leadership messages and portraits will be published here.</div>`}</div></section>`;
  }

  function galleryPage() {
    const items = data.gallery || [];
    return `${pageHero('EDC photo archive','Programmes, people and campus moments.','Explore photographs from entrepreneurship programmes, student teams, events and venture activities.','07')}
      <section class="section gallery-section"><div class="wrap">${sectionHead('Gallery archive','Scroll through the EDC photographs.','On desktop, scroll vertically to move through the horizontal collection. On mobile, swipe the gallery strip.')}</div>
      ${items.length ? `<div class="horiz-gallery-wrapper" id="portfolio"><div class="horiz-gallery-strip">${items.map((g,i)=>`<button class="project-wrap gallery-project reveal" type="button" data-gallery="${i}" aria-label="View ${esc(g.title)}"><div class="project-media">${g.image ? img(g.image,g.title) : '<div class="media-placeholder"><span>EDC GALLERY</span></div>'}</div><span class="project-meta">${esc(g.category)} · ${esc(g.date)}</span><b>${esc(g.title)}</b><span class="project-caption">${esc(g.caption || '')}</span></button>`).join('')}</div></div>` : `<div class="gallery-empty"><div class="eyebrow">EDC PHOTO ARCHIVE</div><h3>Programme photographs will appear here.</h3><p>Approved EDC images can be added from Admin → Gallery.</p></div>`}</section>`;
  }

  function achievementsPage() {
    const items = data.achievements || [];
    return `${pageHero('Achievements','Recognition earned through student initiative.','A record of EDC teams, student ventures and institutional participation across entrepreneurship challenges and programmes.','15')}
      <section class="section achievements-section"><div class="wrap">${sectionHead('EDC achievements','Milestones and recognitions.','Scroll through the achievement archive. Each entry includes the approved photograph and the context behind the recognition.')}</div>
      ${items.length ? `<div class="horiz-gallery-wrapper achievement-gallery-wrapper"><div class="horiz-gallery-strip achievement-gallery-strip">${items.map((a,i)=>`<article class="project-wrap achievement-project reveal reveal-delay-${i%3}"><div class="project-media">${a.image ? img(a.image,a.title) : `<div class="media-placeholder"><span>EDC ACHIEVEMENT</span></div>`}</div><div class="achievement-caption"><div class="achievement-meta"><span>${esc(a.year||'')}</span><span>${esc(a.category||'Recognition')}</span></div><h3>${esc(a.title)}</h3>${a.distinction ? `<b class="achievement-distinction">${esc(a.distinction)}</b>` : ''}<p>${esc(a.description||'')}</p></div></article>`).join('')}</div></div>` : `<div class="wrap"><div class="empty-state">Approved EDC achievements will appear here when they are added through the CMS.</div></div>`}</section>`;
  }

  function blogCard(b,i) {
    return `<article class="blog-card reveal reveal-delay-${Math.min(i%3,3)}"><a class="blog-card-link" href="blog.html?id=${encodeURIComponent(b.id)}" aria-label="Read ${esc(b.title)}"><div class="card-image">${b.image ? img(b.image,b.title) : `<div class="media-placeholder"><span>EDC ARTICLE IMAGE</span></div>`}</div><div class="blog-card-body"><div class="blog-meta"><span>${esc(b.category)}</span><span>${esc(b.date)}</span><span>${esc(b.readTime)}</span></div><h3>${esc(b.title)}</h3><p>${esc(b.excerpt)}</p><span class="text-link">Read article <span class="btn-arrow">↗</span></span><div class="small muted" style="margin-top:16px">By ${esc(b.author)}</div></div></a></article>`;
  }
  function blogsPage() {
    const visible = publishedBlogs().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    return `${pageHero('EDC articles','Ideas and insights from the EDC.','Read practical perspectives on problem discovery, teamwork, student enterprise, innovation and venture development.','08')}
      <section class="section"><div class="wrap">${sectionHead('Articles & insights','Read the latest EDC articles.')}
      ${visible.length ? `<div class="blog-grid">${visible.map(blogCard).join('')}</div>` : `<div class="empty-state">No articles are published at the moment. New articles appear here on their scheduled date.</div>`}</div></section>`;
  }
  function blogDetailPage() {
    const id = new URLSearchParams(location.search).get('id');
    const item = publishedBlogs().find(b => b.id === id);
    if (!item) return `${pageHero('EDC articles','Article not found.','The requested article may have been updated or removed.','08')}<section class="section"><div class="wrap"><a class="btn" href="blogs.html">Back to all articles</a></div></section>`;
    const paragraphs = String(item.body || item.excerpt || '').split(/\n\s*\n/).filter(Boolean);
    return `<article class="article-page"><div class="article-page-head"><div class="wrap article-page-wrap"><a class="article-back" href="blogs.html">← All articles</a><div class="eyebrow">${esc(item.category)} · ${esc(item.date)} · ${esc(item.readTime)}</div><h1>${esc(item.title)}</h1><p class="article-excerpt">${esc(item.excerpt)}</p><div class="article-byline">By ${esc(item.author)}</div></div></div><div class="article-cover">${item.image ? img(item.image,item.title) : `<div class="media-placeholder"><span>EDC ARTICLE COVER</span></div>`}</div><div class="wrap article-body-wrap"><div class="article-prose">${paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}<a class="article-back article-back-bottom" href="blogs.html">← Back to all articles</a></div></div></article>`;
  }

  function socialPage() {
    return `${pageHero('Across our channels','Stay close to what is happening.','A curated stream of announcements, programme moments and stories from the KPRCAS entrepreneurship ecosystem.','09')}
      <section class="section"><div class="wrap">${sectionHead('Social updates','The conversation continues beyond campus.')}
      ${(data.social||[]).length ? `<div class="social-grid">${(data.social||[]).map((p,i)=>{const preview=p.image || youtubeThumbnail(p.videoUrl || p.link);return `<article class="social-card reveal reveal-delay-${Math.min(i%3,3)}"><div class="social-image">${preview ? img(preview,p.platform+' video or post thumbnail') : '<div class="media-placeholder"><span>UPLOAD POST THUMBNAIL</span></div>'}</div><div class="social-copy"><div class="platform">${esc(p.platform)} · ${esc(p.date)}</div><p>${esc(p.caption)}</p>${p.link && safeUrl(p.link) ? `<a href="${esc(safeUrl(p.link))}" target="_blank" rel="noopener">View original post ↗</a>` : ''}</div></article>`;}).join('')}</div>` : `<div class="empty-state">No social media posts are currently published.</div>`}</div></section>`;
  }

  function mentorsPage() {
    return `${pageHero('Mentor network','Experience shared. Ambition strengthened.','A network of founders, professionals and specialists who help teams pressure-test ideas, sharpen decisions and navigate the next stage.','10')}
      <section class="section"><div class="wrap">${sectionHead('Our mentor community','The right question can change the next step.','Add verified mentor profiles, areas of expertise and LinkedIn links in the admin panel.')}
      ${(data.mentors||[]).length ? `<div class="card-grid">${(data.mentors||[]).map((m,i)=>profileCard(m,i,true)).join('')}</div>` : `<div class="empty-state">Mentor profiles will appear here as the EDC network is confirmed.</div>`}</div></section>`;
  }

  function reportsPage() {
    const reports = (data.reports || []).filter(r => safeUrl(r.pdfUrl)).sort((a,b) => String(b.year||'').localeCompare(String(a.year||'')));
    const years = [...new Set(reports.map(r => String(r.year || 'Other years')))];
    return `${pageHero('Knowledge & accountability','Annual reports, year by year.','Open each approved annual report in a full-window digital flipbook.','11')}
      <section class="section annual-reports-section"><div class="wrap">${sectionHead('Annual reports','Browse the EDC record by year.')}
      ${reports.length ? years.map(year=>`<section class="report-year-group"><div class="report-year-heading"><h3>${esc(year)}</h3><span>${reports.filter(r=>String(r.year||'Other years')===year).length} report(s)</span></div><div class="report-grid">${reports.filter(r=>String(r.year||'Other years')===year).map((r,i)=>`<article class="report-card reveal reveal-delay-${Math.min(i%3,3)}"><div class="report-cover ${r.cover ? 'has-report-cover' : 'has-pdf-cover'}" ${!r.cover ? `data-report-thumbnail data-pdf-url="${esc(assetUrl(r.pdfUrl))}"` : ''}>${r.cover ? img(r.cover,r.title+' cover') : `<canvas class="report-cover-canvas" aria-label="First page preview of ${esc(r.title)}"></canvas>`}<div class="report-cover-overlay"><small>${textOr(data.site.shortName,'EDCKPRCAS')}</small><strong>${esc(r.year)}</strong><span>${esc(r.title)}</span></div></div><div class="report-info"><h3>${esc(r.title)}</h3>${r.summary ? `<p>${esc(r.summary)}</p>` : ''}<button type="button" class="btn" data-report="${esc(r.id)}">View flipbook <span class="btn-arrow">↗</span></button></div></article>`).join('')}</div></section>`).join('') : `<div class="empty-state">Annual reports will appear here when a year and approved PDF are uploaded through the Content Manager.</div>`}</div></section>`;
  }

  async function renderReportCoverThumbnails() {
    if (page !== 'reports') return;
    const covers = $$('[data-report-thumbnail][data-pdf-url]');
    if (!covers.length) return;
    try {
      const pdfjs = await loadPdfJs();
      await Promise.all(covers.map(async cover => {
        const url = assetUrl(cover.dataset.pdfUrl);
        const canvas = $('.report-cover-canvas', cover);
        if (!url || !canvas) return;
        try {
          const documentPdf = await pdfjs.getDocument({ url }).promise;
          const firstPage = await documentPdf.getPage(1);
          const base = firstPage.getViewport({ scale: 1 });
          const box = cover.getBoundingClientRect();
          const width = Math.max(220, box.width || 300);
          const height = Math.max(260, box.height || 380);
          const scale = Math.min(width / base.width, height / base.height, 1.4);
          const viewport = firstPage.getViewport({ scale });
          const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
          canvas.width = Math.ceil(viewport.width * ratio);
          canvas.height = Math.ceil(viewport.height * ratio);
          canvas.style.width = `${Math.ceil(viewport.width)}px`;
          canvas.style.height = `${Math.ceil(viewport.height)}px`;
          const context = canvas.getContext('2d', { alpha: false });
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
          await firstPage.render({ canvasContext: context, viewport }).promise;
          cover.classList.add('pdf-cover-ready');
        } catch (error) {
          cover.classList.add('pdf-cover-fallback');
        }
      }));
    } catch (error) {
      covers.forEach(cover => cover.classList.add('pdf-cover-fallback'));
    }
  }

  function contactPage() {
    const c = data.contact || {}; const site = data.site || {};
    const choices = c.enquiryChoices || [
      {label:'Student / student team',description:'I have an idea or want to build a team'},
      {label:'Mentor / industry expert',description:'I would like to share experience'},
      {label:'Institution / industry partner',description:'I want to explore a collaboration'},
      {label:'Programme / event enquiry',description:'I want to know about an EDC programme'},
      {label:'General enquiry',description:'I have another question'}
    ];
    const goals = c.goals || [
      {label:'Explore an idea',description:'Understand a problem and shape an idea'},
      {label:'Build a team',description:'Find collaborators and complementary skills'},
      {label:'Join a programme',description:'Take part in a workshop, challenge or event'},
      {label:'Find a mentor',description:'Connect with relevant experience'},
      {label:'Collaborate',description:'Explore a project, session or partnership'}
    ];
    return `${pageHero(c.eyebrow,c.title,c.description,'12')}
      <section class="section"><div class="wrap contact-layout"><aside class="contact-panel reveal"><div class="contact-panel-image">${c.contactImage ? img(c.contactImage,'KPRCAS EDC contact') : `<div class="media-placeholder"><span>CONTACT THE EDC</span></div>`}</div><div class="eyebrow eyebrow-light">${textOr(c.contactPanelEyebrow,'Start a conversation')}</div><h3>${textOr(c.contactPanelTitle,'Let’s find the right next step.')}</h3><p>${textOr(c.contactPanelText,'Connect with the Entrepreneurship Development Cell for student ideas, programmes, mentorship, partnerships or general information.')}</p>
        <div class="contact-detail"><span>${textOr(c.locationLabel,'Location')}</span><b>${textOr(site.address,'Coimbatore, Tamil Nadu, India')}</b></div><div class="contact-detail"><span>${textOr(c.emailDetailLabel,'Email')}</span><b><a href="mailto:edc@kprcas.ac.in">edc@kprcas.ac.in</a></b></div>${site.phone ? `<div class="contact-detail"><span>${textOr(c.phoneDetailLabel,'Phone')}</span><b>${esc(site.phone)}</b></div>` : ''}${site.website ? `<div class="contact-detail"><span>Website</span><b>${esc(site.website)}</b></div>` : ''}${c.directionsUrl && safeUrl(c.directionsUrl) ? `<a class="btn btn-white" style="margin-top:22px" href="${esc(safeUrl(c.directionsUrl))}" target="_blank" rel="noopener">Get directions ↗</a>` : ''}</aside>
        <form class="contact-form contact-wizard reveal reveal-delay-1" id="contactForm" data-step="1"><div class="form-trap" aria-hidden="true"><label>Leave this field empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div><div class="wizard-head"><div><div class="eyebrow">EDC enquiry pathway</div><h3>${textOr(c.formTitle,'Tell us what you are working on.')}</h3></div><span class="wizard-count" data-contact-count>STEP 1 / 3</span></div><p class="wizard-intro">${textOr(c.formIntro,'A few quick choices help us direct your enquiry to the right conversation.')}</p><div class="wizard-progress"><i data-contact-progress style="width:33.333%"></i></div>
          <section class="wizard-panel active" data-contact-panel="1"><div class="wizard-question"><span>01</span><div><b>${textOr(c.step1Title,'What brings you here?')}</b><small>${textOr(c.step1Note,'Select the option closest to your situation.')}</small></div></div><div class="wizard-options">${choices.map((choice,i)=>{ const label=choice.label, desc=choice.description; return `<label class="wizard-option"><input type="radio" name="enquiryType" value="${esc(label)}"><span class="wizard-option-copy"><b>${esc(label)}</b><small>${esc(desc)}</small></span><i>↗</i></label>`; }).join('')}</div><div class="wizard-error" data-contact-error></div><div class="wizard-actions"><span class="wizard-help">${textOr(c.reviewHint,'You can review your details before sending.')}</span><button class="btn" type="button" data-contact-next>${textOr(c.continueLabel,'Continue')} <span class="btn-arrow">↗</span></button></div></section>
          <section class="wizard-panel" data-contact-panel="2" hidden><div class="wizard-question"><span>02</span><div><b>${textOr(c.step2Title,'What would you like to explore?')}</b><small>${textOr(c.step2Note,'Choose the outcome you have in mind.')}</small></div></div><div class="wizard-options wizard-options-grid">${goals.map((goal)=>{ const label=goal.label, desc=goal.description; return `<label class="wizard-option"><input type="radio" name="goal" value="${esc(label)}"><span class="wizard-option-copy"><b>${esc(label)}</b><small>${esc(desc)}</small></span><i>↗</i></label>`; }).join('')}</div><div class="wizard-error" data-contact-error></div><div class="wizard-actions"><button class="wizard-back" type="button" data-contact-back>← ${textOr(c.backLabel,'Back')}</button><button class="btn" type="button" data-contact-next>${textOr(c.continueLabel,'Continue')} <span class="btn-arrow">↗</span></button></div></section>
          <section class="wizard-panel" data-contact-panel="3" hidden><div class="wizard-question"><span>03</span><div><b>${textOr(c.step3Title,'How can we reach you?')}</b><small>${textOr(c.step3Note,'Share a few details and a short note.')}</small></div></div><div class="form-grid"><div class="field"><label for="contactName">${textOr(c.nameLabel,'Full name')}</label><input id="contactName" name="name" required maxlength="100" placeholder="${textOr(c.namePlaceholder,'Your name')}"></div><div class="field"><label for="contactEmail">${textOr(c.emailLabel,'Email address')}</label><input id="contactEmail" name="email" type="email" required maxlength="160" placeholder="${textOr(c.emailPlaceholder,'you@example.com')}"></div><div class="field full"><label for="contactSubject">${textOr(c.subjectLabel,'Subject (optional)')}</label><input id="contactSubject" name="subject" maxlength="160" placeholder="${textOr(c.subjectPlaceholder,'A short subject')}"></div><div class="field full"><label for="contactMessage">${textOr(c.messageLabel,'Your message')}</label><textarea id="contactMessage" name="message" required minlength="10" maxlength="5000" placeholder="${textOr(c.messagePlaceholder,'Tell us a little about your idea, question or collaboration…')}"></textarea></div></div><div class="wizard-actions"><button class="wizard-back" type="button" data-contact-back>← ${textOr(c.backLabel,'Back')}</button><button class="btn" type="submit">${textOr(c.submitLabel,'Send enquiry')} <span class="btn-arrow">↗</span></button></div></section>
          <div class="form-message" id="contactResult" role="status" aria-live="polite"></div><p class="wizard-privacy">${textOr(c.privacyNote,'Your enquiry will be sent to the EDC office by email. Please do not include sensitive personal information.')}</p></form></div></section>`;
  }

  function opportunitiesPage() {
    return `${pageHero('Take part','There is more than one way to build together.','Explore pathways for students, mentors, founders, institutions and industry partners to engage with the ecosystem.','13')}
      <section class="section"><div class="wrap">${sectionHead('Ways to participate','Bring your perspective. Find your next step.')}
      ${(data.opportunities||[]).length ? `<div class="opportunity-grid">${(data.opportunities||[]).map((o,i)=>`<article class="opportunity-card reveal reveal-delay-${Math.min(i%3,3)}"><div class="opportunity-image">${o.image ? img(o.image,o.title) : '<div class="media-placeholder"><span>EDC OPPORTUNITY</span></div>'}</div><div class="opportunity-meta"><span>${esc(o.type)}</span><span>${esc(o.status)}</span></div><h3>${esc(o.title)}</h3><p>${esc(o.summary)}</p><div class="small muted" style="margin-bottom:17px"><b>Who can participate:</b> ${esc(o.eligibility)}<br><b>Timeline:</b> ${esc(o.deadline)}</div>${o.link && safeUrl(o.link) ? `<a class="text-link" href="${esc(safeUrl(o.link))}" target="_blank" rel="noopener">Explore opportunity ↗</a>` : `<a class="text-link" href="contact.html">Enquire about this ↗</a>`}</article>`).join('')}</div>` : `<div class="participation-empty"><div class="eyebrow">PARTICIPATE IN THE EDC</div><h3>Start with a conversation.</h3><p>Students, mentors and institutional partners can contact the EDC to discuss ways to participate. Current calls and programme opportunities will be listed here when they are confirmed.</p><a class="btn" href="contact.html">Contact the EDC <span class="btn-arrow">↗</span></a></div>`}</div></section>`;
  }

  function wireVoiceCarousel() {
    const roots = $$('[data-voice-autoplay]');
    roots.forEach(root => {
      const slides = $$('[data-voice-slide]',root);
      const dots = $$('[data-voice-dot]',root);
      if (slides.length < 2) return;
      let index = Math.max(0, slides.findIndex(slide=>slide.classList.contains('active'))), timer = null;
      const interval = Math.max(3500, Number(root.dataset.voiceInterval || 5000));
      const show = next => {
        index = (next + slides.length) % slides.length;
        slides.forEach((slide,i)=>slide.classList.toggle('active',i===index));
        dots.forEach((dot,i)=>dot.classList.toggle('active',i===index));
      };
      const stop = () => { if (timer) window.clearInterval(timer); timer=null; };
      const start = () => {
        stop();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState === 'hidden') return;
        timer=window.setInterval(()=>show(index+1),interval);
      };
      root.addEventListener('mouseenter',stop);
      root.addEventListener('mouseleave',start);
      root.addEventListener('focusin',stop);
      root.addEventListener('focusout',event=>{ if (!root.contains(event.relatedTarget)) start(); });
      document.addEventListener('visibilitychange',()=>document.visibilityState==='hidden'?stop():start());
      start();
    });
  }

  function wireHomeInteractions() {
    if (page !== 'home') return;

    const anthemThumb = $('[data-anthem-thumbnail]');
    if (anthemThumb) {
      const videoId = anthemThumb.dataset.videoId || '';
      const poster = anthemThumb.dataset.poster || '';
      const candidates = ['hqdefault.jpg','sddefault.jpg','maxresdefault.jpg','mqdefault.jpg','default.jpg'].map(name => `https://i.ytimg.com/vi/${videoId}/${name}`);
      let candidateIndex = 0;
      anthemThumb.addEventListener('error', () => {
        candidateIndex += 1;
        if (candidateIndex < candidates.length) {
          anthemThumb.src = candidates[candidateIndex];
        } else if (poster && anthemThumb.src !== poster) {
          anthemThumb.src = poster;
        } else {
          anthemThumb.style.display = 'none';
          const frame = anthemThumb.closest('.anthem-video-frame');
          if (frame) frame.classList.add('anthem-thumbnail-unavailable');
        }
      });
    }

    const journeyPanels = $$('[data-journey-panel]');
    const journeyWindow = $('[data-journey-scroll]');
    const journeyProgress = $('[data-journey-progress]');
    const journeyCurrent = $('[data-journey-current]');
    const journeyExit = $('[data-journey-exit]');
    const canUseLoop = journeyPanels.length > 1 && window.gsap && window.ScrollTrigger && window.Observer && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.innerWidth > 760;

    if (canUseLoop) {
      gsap.registerPlugin(ScrollTrigger, Observer);
      let activeJourney = 0;
      let changingJourney = false;
      let journeyObserver = null;
      let journeyTrigger = null;
      const wrapJourney = gsap.utils.wrap(0, journeyPanels.length);
      const updateJourneyReadout = () => {
        if (journeyCurrent) journeyCurrent.textContent = String(activeJourney + 1).padStart(2,'0');
        if (journeyProgress) journeyProgress.style.width = `${((activeJourney + 1) / journeyPanels.length) * 100}%`;
      };
      gsap.set(journeyPanels, { autoAlpha: 0, yPercent: 10, zIndex: 0 });
      gsap.set(journeyPanels[0], { autoAlpha: 1, yPercent: 0, zIndex: 1 });
      updateJourneyReadout();

      const goToJourney = (requestedIndex, direction) => {
        if (changingJourney) return;
        const nextIndex = wrapJourney(requestedIndex);
        if (nextIndex === activeJourney) return;
        changingJourney = true;
        const currentPanel = journeyPanels[activeJourney];
        const nextPanel = journeyPanels[nextIndex];
        const incoming = nextPanel.querySelectorAll('.journey-phase,.journey-scroll-copy h3,.journey-scroll-copy p,.journey-output');
        gsap.set(nextPanel, { zIndex: 2 });
        gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: () => {
          gsap.set(currentPanel, { zIndex: 0, yPercent: 0 });
          gsap.set(nextPanel, { zIndex: 1, yPercent: 0 });
          activeJourney = nextIndex;
          changingJourney = false;
          updateJourneyReadout();
        }})
          .to(currentPanel, { autoAlpha: 0, yPercent: direction > 0 ? -9 : 9, duration: .42 }, 0)
          .fromTo(nextPanel, { autoAlpha: 0, yPercent: direction > 0 ? 12 : -12 }, { autoAlpha: 1, yPercent: 0, duration: .68 }, .08)
          .fromTo(incoming, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .48, stagger: .045, ease: 'power2.out' }, .24);
      };

      const leaveJourney = () => {
        journeyObserver?.disable();
        if (!journeyTrigger) return;
        const nextScrollPosition = Math.max(window.scrollY + 4, journeyTrigger.end + 4);
        window.scrollTo({ top: nextScrollPosition, behavior: 'smooth' });
      };

      journeyTrigger = ScrollTrigger.create({
        trigger: journeyWindow,
        start: () => `top top+=${Math.round($('#site-header')?.getBoundingClientRect().height || 108)}`,
        end: () => `+=${Math.max(window.innerHeight, 700)}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onEnter: () => journeyObserver?.enable(),
        onEnterBack: () => journeyObserver?.enable(),
        onLeave: () => journeyObserver?.disable(),
        onLeaveBack: () => journeyObserver?.disable()
      });
      journeyObserver = Observer.create({
        target: window,
        type: 'wheel,touch',
        tolerance: 10,
        preventDefault: true,
        onDown: () => goToJourney(activeJourney + 1, 1),
        onUp: () => goToJourney(activeJourney - 1, -1)
      });
      journeyObserver.disable();
      journeyExit?.addEventListener('click', leaveJourney);
      document.addEventListener('keydown', event => {
        if (!journeyTrigger?.isActive) return;
        if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); goToJourney(activeJourney + 1, 1); }
        if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); goToJourney(activeJourney - 1, -1); }
        if (event.key === 'Escape') { event.preventDefault(); leaveJourney(); }
      });
      window.addEventListener('resize', () => ScrollTrigger.refresh(), { passive: true });
    } else if (journeyPanels.length && window.gsap && window.ScrollTrigger && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.innerWidth > 760) {
      // Fallback when Observer is unavailable: a standard pinned six-stage scroll sequence.
      gsap.registerPlugin(ScrollTrigger);
      gsap.set(journeyPanels.slice(1), { autoAlpha: 0, yPercent: 8 });
      const tl = gsap.timeline({
        scrollTrigger: { trigger: '[data-journey-scroll]', start: () => `top top+=${Math.round($('#site-header')?.getBoundingClientRect().height || 108)}`, end: () => `+=${window.innerHeight * Math.max(1, journeyPanels.length - 1)}`, pin: true, scrub: 0.8, invalidateOnRefresh: true },
        defaults: { ease: 'power1.inOut', duration: 1 }
      });
      journeyPanels.forEach((panel, i) => {
        if (i > 0) { tl.to(journeyPanels[i-1], { autoAlpha: 0, yPercent: -7 }, i - 1); tl.to(panel, { autoAlpha: 1, yPercent: 0 }, i - 1); }
        tl.call(() => { if (journeyCurrent) journeyCurrent.textContent = String(i+1).padStart(2,'0'); if (journeyProgress) journeyProgress.style.width = `${((i+1)/journeyPanels.length)*100}%`; }, [], i);
      });
    } else if (journeyPanels.length) {
      journeyWindow?.classList.add('journey-unpinned');
      journeyPanels.forEach(panel=>{ panel.style.position='relative'; panel.style.opacity='1'; panel.style.visibility='visible'; panel.style.transform='none'; });
    }

  }

  function wireCounters() {
    const counters = $$('[data-count-value]');
    if (!counters.length) return;
    const animate = node => {
      const finalValue = node.dataset.countValue || node.textContent.trim();
      const match = finalValue.match(/^(\d+)(.*)$/);
      if (!match) return;
      const target = Number(match[1]), suffix = match[2], duration = 1250, start = performance.now();
      const draw = now => { const progress = Math.min(1,(now-start)/duration); const eased = 1-Math.pow(1-progress,3); node.textContent=`${Math.round(target*eased)}${suffix}`; if(progress<1)requestAnimationFrame(draw);else node.textContent=finalValue; };
      node.textContent=`0${suffix}`; requestAnimationFrame(draw);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { counters.forEach(node=>node.textContent=node.dataset.countValue||node.textContent); return; }
    const io = new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){io.unobserve(entry.target);animate(entry.target);}}),{threshold:.5});
    counters.forEach(node=>io.observe(node));
  }

  function openLightbox(item) {
    const root = $('#site-modal-root');
    root.innerHTML = `<div class="lightbox open" id="lightbox"><button class="lightbox-close" type="button" data-close-modal>Close ×</button><div><img src="${esc(assetUrl(item.image))}" alt="${esc(item.title)}"><div class="lightbox-caption">${esc(item.title)} · ${esc(item.caption || '')}</div></div></div>`;
    document.body.classList.add('no-scroll');
  }
  let pdfJsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsPromise) return pdfJsPromise;
    pdfJsPromise = new Promise((resolve,reject) => {
      const script=document.createElement('script');
      script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload=()=>{ if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';resolve(window.pdfjsLib);} else reject(new Error('The flipbook reader could not be loaded.')); };
      script.onerror=()=>reject(new Error('The flipbook reader needs an internet connection.'));
      document.head.appendChild(script);
    });
    return pdfJsPromise;
  }
  async function paintPdfPage() {
    if (!activeBook?.pdfDocument) return;
    const canvas=$('[data-pdf-canvas]'); if(!canvas) return;
    const pageObject=await activeBook.pdfDocument.getPage(activeBook.current);
    const viewport=pageObject.getViewport({scale:1});
    const maxWidth=Math.max(320,Math.min(window.innerWidth-48,1180));
    const maxHeight=Math.max(360,window.innerHeight-170);
    const scale=Math.min(maxWidth/viewport.width,maxHeight/viewport.height,2.2);
    const scaled=pageObject.getViewport({scale});
    const context=canvas.getContext('2d',{alpha:false});
    canvas.width=Math.ceil(scaled.width); canvas.height=Math.ceil(scaled.height);
    canvas.style.width=`${Math.ceil(scaled.width)}px`; canvas.style.height=`${Math.ceil(scaled.height)}px`;
    await pageObject.render({canvasContext:context,viewport:scaled}).promise;
    const pageLabel=$('[data-pdf-page-label]'); if(pageLabel)pageLabel.textContent=`Page ${activeBook.current} of ${activeBook.pdfDocument.numPages}`;
    const prev=$('[data-book-prev]'),next=$('[data-book-next]');
    if(prev)prev.disabled=activeBook.current<=1; if(next)next.disabled=activeBook.current>=activeBook.pdfDocument.numPages;
  }
  function renderBookModal() {
    if (!activeBook) return;
    const { item, pages, current } = activeBook;
    const root = $('#site-modal-root');
    if (activeBook.pdfUrl) {
      root.innerHTML = `<div class="book-modal open pdf-book-modal" id="bookModal"><div class="book-shell pdf-book-shell"><div class="book-top"><span>${esc(item.year||'')} · ${esc(item.title)}</span><button class="book-close" type="button" data-close-modal>Close ×</button></div><div class="pdf-book-stage"><div class="pdf-book-page" data-pdf-page><canvas data-pdf-canvas aria-label="Annual report page"></canvas></div><div class="pdf-book-loading" data-pdf-loading>Preparing the annual report flipbook…</div></div><div class="book-controls pdf-book-controls"><button type="button" data-book-prev disabled>← Previous</button><span data-pdf-page-label>Loading pages…</span><button type="button" data-book-next disabled>Next →</button></div></div></div>`;
      loadPdfJs().then(pdfjs=>pdfjs.getDocument({url:activeBook.pdfUrl}).promise).then(pdf=>{if(!activeBook)return;activeBook.pdfDocument=pdf;activeBook.current=1;const loading=$('[data-pdf-loading]');if(loading)loading.remove();return paintPdfPage();}).catch(error=>{const loading=$('[data-pdf-loading]');if(loading)loading.textContent=error.message||'Unable to open this PDF. Please re-upload the file.';});
      return;
    }
    const a = pages[current] || ''; const b = pages[current+1] || '';
    root.innerHTML = `<div class="book-modal open" id="bookModal"><div class="book-shell"><div class="book-top"><span>${esc(item.title)} · Digital preview</span><button class="book-close" type="button" data-close-modal>Close ×</button></div><div class="book-spread"><div class="book-page" data-page="${current+1}"><div class="book-kicker">${esc(data.site.shortName || 'EDCKPRCAS')}</div><h3>${current===0 ? esc(item.title) : esc((a.split('\n')[0] || item.title))}</h3><p>${esc(a)}</p></div><div class="book-page" data-page="${b ? current+2 : ''}"><div class="book-kicker">${b ? 'Annual review' : 'End of preview'}</div><h3>${b ? esc(b.split('\n')[0] || 'Highlights') : 'Continue the story.'}</h3><p>${esc(b || 'Add the approved PDF in the Content Manager to enable the full flipbook.')}</p></div></div><div class="book-controls"><button type="button" data-book-prev ${current===0?'disabled':''}>← Previous</button><span>Pages ${current+1}–${Math.min(current+2,pages.length)} / ${pages.length}</span><button type="button" data-book-next ${current+2>=pages.length?'disabled':''}>Next →</button></div></div></div>`;
  }
  function openReport(item) {
    const pages = Array.isArray(item.pages) && item.pages.length ? item.pages : ['Upload the approved annual report PDF in the Content Manager.'];
    activeBook = { item, pages, current: 0, pdfUrl: assetUrl(item.pdfUrl) };
    renderBookModal(); document.body.classList.add('no-scroll');
  }

  function wirePageActions() {
    const menu = $('#mobileNav');
    document.addEventListener('click', e => {
      const nextWizard = e.target.closest('[data-contact-next]');
      const backWizard = e.target.closest('[data-contact-back]');
      if (nextWizard || backWizard) {
        const wizard = e.target.closest('#contactForm');
        if (wizard) {
          const currentStep = Number(wizard.dataset.step || 1);
          const nextStep = backWizard ? Math.max(1, currentStep - 1) : Math.min(3, currentStep + 1);
          const error = $('[data-contact-panel="' + currentStep + '"] [data-contact-error]', wizard);
          if (error) error.textContent = '';
          if (nextWizard && currentStep === 1 && !wizard.querySelector('input[name="enquiryType"]:checked')) {
            if (error) error.textContent = 'Choose the option that best describes your enquiry.';
            return;
          }
          if (nextWizard && currentStep === 2 && !wizard.querySelector('input[name="goal"]:checked')) {
            if (error) error.textContent = 'Choose what you would like to explore.';
            return;
          }
          wizard.dataset.step = String(nextStep);
          $$('[data-contact-panel]', wizard).forEach(panel => {
            const active = Number(panel.dataset.contactPanel) === nextStep;
            panel.hidden = !active; panel.classList.toggle('active', active);
          });
          const count = $('[data-contact-count]', wizard);
          if (count) count.textContent = `STEP ${nextStep} / 3`;
          const progress = $('[data-contact-progress]', wizard);
          if (progress) progress.style.width = `${(nextStep / 3) * 100}%`;
          if (nextStep === 3) $('#contactName')?.focus({ preventScroll: true });
        }
        return;
      }
      const anthemButton = e.target.closest('[data-play-anthem]');
      if (anthemButton) {
        const id = anthemButton.dataset.playAnthem;
        const frame = anthemButton.closest('.anthem-video-frame');
        if (frame && /^[A-Za-z0-9_-]{11}$/.test(id||'')) frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=1" title="EDC-KPRCAS anthem" loading="eager" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      }
      const galleryBtn = e.target.closest('[data-gallery]');
      if (galleryBtn) { const item = (data.gallery||[])[Number(galleryBtn.dataset.gallery)]; if (item) openLightbox(item); }
      const reportBtn = e.target.closest('[data-report]');
      if (reportBtn) { const item = (data.reports||[]).find(x=>x.id===reportBtn.dataset.report); if (item) openReport(item); }
      const turnPdfPage = direction => {
        const page=$('[data-pdf-page]'); if(page)page.classList.add('turning');
        window.setTimeout(()=>{
          if(!activeBook?.pdfDocument)return;
          activeBook.current=Math.max(1,Math.min(activeBook.pdfDocument.numPages,activeBook.current+direction));
          paintPdfPage().catch(()=>{}).finally(()=>page?.classList.remove('turning'));
        },120);
      };
      if (e.target.closest('[data-book-prev]') && activeBook) {
        if(activeBook.pdfDocument && activeBook.current>1)turnPdfPage(-1);
        else if(activeBook.current>0){activeBook.current=Math.max(0,activeBook.current-2);renderBookModal();}
      }
      if (e.target.closest('[data-book-next]') && activeBook) {
        if(activeBook.pdfDocument && activeBook.current<activeBook.pdfDocument.numPages)turnPdfPage(1);
        else if(activeBook.current+2<activeBook.pages.length){activeBook.current=Math.min(activeBook.pages.length-1,activeBook.current+2);renderBookModal();}
      }
      if (e.target.closest('[data-close-modal]') || (e.target.classList.contains('lightbox') || e.target.classList.contains('article-modal') || e.target.classList.contains('book-modal'))) {
        $('#site-modal-root').innerHTML=''; activeBook=null; document.body.classList.remove('no-scroll');
      }
      const filter = e.target.closest('[data-filter]');
      if (filter) {
        const group = filter.closest('[data-filter-container]');
        if (group) {
          $$('[data-filter]',group).forEach(x=>x.classList.toggle('active',x===filter));
          const selected = filter.dataset.filter;
          const parent = group.parentElement;
          $$('.event-filter-item',parent).forEach(el=>el.style.display = selected==='All'||el.dataset.category===selected ? '' : 'none');
          if (page==='startups') {
            $$('.card',parent).forEach(el=> { const text=el.textContent; el.style.display=selected==='All'||text.includes(selected)?'':'none'; });
          }
        }
      }
      if (e.target.closest('a') && menu?.classList.contains('open')) { menu.classList.remove('open'); $('#menuBtn')?.setAttribute('aria-expanded','false'); }
    });
    const form = $('#contactForm');
    form?.addEventListener('submit', async e => {
      e.preventDefault(); const btn = form.querySelector('button[type="submit"]'); const result = $('#contactResult');
      btn.disabled = true; btn.textContent = 'Sending…'; result.textContent='';
      const payload = Object.fromEntries(new FormData(form).entries());
      const enquiryType = String(payload.enquiryType || 'General enquiry');
      const goal = String(payload.goal || 'General conversation');
      payload.subject = (payload.subject || `${enquiryType} · ${goal}`).slice(0,160);
      payload.message = `Enquiry type: ${enquiryType}\nWhat they want to explore: ${goal}\n\n${payload.message || ''}`;
      try {
        const response = await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to send your enquiry.');
        result.textContent = body.message || 'Thank you. Your enquiry has been received by the EDC.'; form.reset();
        form.dataset.step = '1';
        $$('[data-contact-panel]', form).forEach(panel => { const active = panel.dataset.contactPanel === '1'; panel.hidden = !active; panel.classList.toggle('active', active); });
        if ($('[data-contact-count]', form)) $('[data-contact-count]', form).textContent = 'STEP 1 / 3';
        if ($('[data-contact-progress]', form)) $('[data-contact-progress]', form).style.width = '33.333%';
      } catch(err) { result.textContent = err.message || 'The form could not be submitted. Please contact the team directly.'; result.style.color='#b34c4c'; }
      finally { btn.disabled=false; btn.innerHTML='Send enquiry <span class="btn-arrow">↗</span>'; }
    });
  }

  function revealIn() {
    const nodes = $$('.reveal:not(.in)');
    if (!nodes.length) return;
    if (window.gsap && window.ScrollTrigger && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.registerPlugin(ScrollTrigger);
      nodes.forEach(node => {
        gsap.fromTo(node, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: .72, ease: 'power2.out', clearProps: 'transform', scrollTrigger: { trigger: node, start: 'top 88%', once: true }, onComplete: () => node.classList.add('in') });
      });
      $$('.page-end-image img,.feature-band-image img,.card-image img,.project-media img,.social-image img,.article-cover img').forEach(image=>{
        image.classList.add('image-mask-target');
        gsap.fromTo(image,{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)',duration:.9,ease:'power2.out',scrollTrigger:{trigger:image,start:'top 88%',once:true}});
      });
      return;
    }
    if (!('IntersectionObserver' in window)) { nodes.forEach(n=>n.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(entry=>{ if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); } }),{threshold:.08,rootMargin:'0px 0px -25px 0px'});
    nodes.forEach(n=>io.observe(n));
  }

  function setupHorizontalGallery() {
    const wrappers = $$('.horiz-gallery-wrapper');
    if (!wrappers.length) return;
    wrappers.forEach(wrapper => {
      const strip = $('.horiz-gallery-strip',wrapper); if(!strip)return;
      if (window.gsap && window.ScrollTrigger && window.innerWidth > 760 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.registerPlugin(ScrollTrigger);
        const getDistance = () => Math.max(0, strip.scrollWidth - window.innerWidth + 48);
        gsap.to(strip, { x: () => -getDistance(), ease: 'none', scrollTrigger: { trigger: wrapper, start: () => `top top+=${Math.round($('#site-header')?.getBoundingClientRect().height || 108)}`, end: () => `+=${getDistance()}`, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 } });
      }
      // Touch swipe on phones and click-drag with a mouse on laptops/desktops.
      if (window.innerWidth <= 760 || !window.gsap || !window.ScrollTrigger) {
        wrapper.classList.add('gallery-touch-scroll');
        let down=false,startX=0,startLeft=0,dragged=false;
        wrapper.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;down=true;dragged=false;startX=event.clientX;startLeft=wrapper.scrollLeft;wrapper.setPointerCapture?.(event.pointerId);wrapper.classList.add('is-dragging');});
        wrapper.addEventListener('pointermove',event=>{if(!down)return;const delta=event.clientX-startX;if(Math.abs(delta)>5)dragged=true;wrapper.scrollLeft=startLeft-delta;});
        const end=()=>{down=false;wrapper.classList.remove('is-dragging');if(dragged){wrapper.dataset.suppressClick='1';window.setTimeout(()=>delete wrapper.dataset.suppressClick,180);}};
        wrapper.addEventListener('pointerup',end);wrapper.addEventListener('pointercancel',end);wrapper.addEventListener('lostpointercapture',end);
        wrapper.addEventListener('click',event=>{if(wrapper.dataset.suppressClick==='1'){event.preventDefault();event.stopPropagation();}},true);
      }
    });
  }

  function setupScrambleText() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $$('[data-scramble], [data-scramble-slow]').forEach(node => {
      const finalText = node.textContent.trim();
      if (!finalText) return;
      let played = false;
      const play = () => {
        if (played) return; played = true;
        const start = performance.now(), duration = node.hasAttribute('data-scramble-slow') ? 4600 : 1800;
        const frame = now => {
          const p = Math.min(1,(now-start)/duration);
          const revealCount = Math.floor(finalText.length * p);
          node.textContent = finalText.split('').map((ch,i)=> i < revealCount || ch === ' ' ? ch : chars[Math.floor(Math.random()*chars.length)]).join('');
          if (p < 1) requestAnimationFrame(frame); else node.textContent=finalText;
        };
        requestAnimationFrame(frame);
      };
      if ('IntersectionObserver' in window) { const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){play();io.disconnect();}},{threshold:.5});io.observe(node); } else play();
    });
  }

  function setMeta(name, content, isProperty=false) {
    if (!content) return;
    const selector = isProperty ? `meta[property=\"${name}\"]` : `meta[name=\"${name}\"]`;
    let node = $(selector);
    if (!node) { node = document.createElement('meta'); if (isProperty) node.setAttribute('property',name); else node.setAttribute('name',name); document.head.appendChild(node); }
    node.setAttribute('content',String(content).slice(0,500));
  }
  function updateSeo() {
    const pageNames = {home:'Home',about:'About the EDC',people:'People and student teams',events:'Events and programmes',startups:'Student ventures',impact:'EDC impact',messages:'Messages from heads',gallery:'EDC gallery',blogs:'EDC blogs',social:'EDC social media',mentors:'Mentor network',reports:'Annual reports',contact:'Reach the EDC',opportunities:'Opportunities',achievements:'Achievements','team-year':'Academic-year teams','blog-detail':'EDC article'};
    const browserTitles = {home:'Home',about:'About',people:'People',events:'Events',startups:'Startups',impact:'Impact',messages:'Messages',gallery:'Gallery',blogs:'Blogs',social:'Social',mentors:'Mentors',reports:'Reports',contact:'Contact',opportunities:'Opportunities',achievements:'Achievements','team-year':'Team','blog-detail':'Blog'};
    const query = new URLSearchParams(location.search);
    const blogId = query.get('id');
    const yearKey = query.get('year');
    const article = page === 'blog-detail' ? publishedBlogs().find(item=>item.id===blogId) : null;
    const team = page === 'team-year' ? (data.teams||[]).find(item=>item.yearKey===yearKey) : null;
    const intro = (data.pageIntros||[]).find(item=>item.page===page);
    const title = article ? article.title : team ? `${team.title || 'EDC student team'} ${team.year || ''}`.trim() : (page==='home' ? 'Entrepreneurship Development Cell at KPRCAS, Coimbatore' : (intro?.title || pageNames[page] || 'EDCKPRCAS'));
    const description = article ? (article.excerpt || '') : team ? `Explore the ${team.year || ''} student team at EDCKPRCAS, the Entrepreneurship Development Cell at KPRCAS, Coimbatore. ${team.description || ''}`.trim() : (page==='home' ? 'EDCKPRCAS is the Entrepreneurship Development Cell at KPRCAS, Coimbatore, supporting student entrepreneurship, innovation, startup development, mentoring and campus programmes.' : page==='people' ? 'Meet EDCKPRCAS student teams, coordinators and people supporting entrepreneurship development at KPRCAS, Coimbatore.' : (intro?.description || 'Entrepreneurship Development Cell at KPRCAS, Coimbatore.'));
    const base = String(data.site?.website || document.querySelector('meta[name="site-url"]')?.content || location.origin).replace(/\/$/,'');
    const queryString = page==='blog-detail' && blogId ? `?id=${encodeURIComponent(blogId)}` : page==='team-year' && yearKey ? `?year=${encodeURIComponent(yearKey)}` : '';
    const canonical = `${base}${location.pathname}${queryString}`;
    const seoTitle = page === 'home' ? 'EDCKPRCAS | Entrepreneurship Development Cell at KPRCAS, Coimbatore' : page === 'people' ? 'EDCKPRCAS | People and Student Teams at KPRCAS' : `${title} | EDCKPRCAS at KPRCAS`;
    document.title = seoTitle;
    setMeta('description',description || 'Entrepreneurship Development Cell at KPRCAS, Coimbatore.');
    setMeta('robots','index,follow,max-image-preview:large');
    let link = $('link[rel=canonical]'); if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link);} link.href=canonical;
    setMeta('og:title',seoTitle,true); setMeta('og:description',description,true); setMeta('og:type',article?'article':'website',true); setMeta('og:url',canonical,true);
    const socialImage = article?.image || team?.image || intro?.image || data.home?.heroImage || data.site?.logoImage || '';
    const resolvedSocialImage = socialImage ? assetUrl(socialImage) : '';
    const imageUrl = resolvedSocialImage ? (/^https:\/\//i.test(resolvedSocialImage) ? resolvedSocialImage : new URL(resolvedSocialImage,base).href) : '';
    if(imageUrl) { setMeta('og:image',imageUrl,true); setMeta('og:image:alt',title,true); }
    setMeta('twitter:card',imageUrl?'summary_large_image':'summary'); setMeta('twitter:title',`EDCKPRCAS | ${title}`); setMeta('twitter:description',description);
    if(imageUrl) setMeta('twitter:image',imageUrl);
    const organization = { '@context':'https://schema.org','@type':'EducationalOrganization','name':'EDCKPRCAS','alternateName':'KPRCAS Entrepreneurship Development Cell','url':base,'email':data.site?.email || 'edc@kprcas.ac.in','address':{'@type':'PostalAddress','addressLocality':'Coimbatore','addressRegion':'Tamil Nadu','addressCountry':'IN'}};
    const schema = article ? {
      '@context':'https://schema.org','@type':'BlogPosting','headline':article.title,'description':article.excerpt||'',
      'author':{'@type':'Person','name':article.author||'EDC Editorial Team'},
      'publisher':{'@type':'EducationalOrganization','name':'EDCKPRCAS','url':base},
      'datePublished':article.publishAt||article.date||undefined,
      'image':imageUrl||undefined,'mainEntityOfPage':canonical
    } : organization;
    let ld=$('#edc-jsonld'); if(!ld){ld=document.createElement('script');ld.type='application/ld+json';ld.id='edc-jsonld';document.head.appendChild(ld);} ld.textContent=JSON.stringify(schema);
  }

  async function init() {
    try {
      let response;
      // Local authoring keeps the full Node.js Content Manager API. Cloudflare Pages
      // serves the generated, read-only JSON snapshot from /data/site-data.json.
      try {
        response = await fetch('/api/content',{cache:'no-store'});
        if (!response.ok) throw new Error('Local content API unavailable.');
      } catch {
        response = await fetch('/data/site-data.json',{cache:'no-store'});
        if (!response.ok) throw new Error('Published website content could not be loaded.');
      }
      data = await response.json();
      const renderers = {home:homePage,about:aboutPage,people:peoplePage,'team-year':teamYearPage,events:eventsPage,startups:startupsPage,impact:impactPage,messages:messagesPage,gallery:galleryPage,achievements:achievementsPage,blogs:blogsPage,'blog-detail':blogDetailPage,social:socialPage,mentors:mentorsPage,reports:reportsPage,contact:contactPage,opportunities:opportunitiesPage};
      const renderer = renderers[page] || homePage;
      renderHeader(); $('#main').innerHTML = renderer(); renderFooter(); updateSeo(); wirePageActions(); wireHomeInteractions(); wireVoiceCarousel(); wireCounters(); revealIn(); setupHorizontalGallery(); setupScrambleText(); renderReportCoverThumbnails(); scheduleBlogPublicationRefresh();
    } catch (error) {
      $('#main').innerHTML = `<section class="section"><div class="wrap"><div class="eyebrow">Website setup</div><h1 style="font:800 38px var(--display);color:var(--navy)">Start the local website server.</h1><p style="max-width:650px;color:var(--body)">This project uses a small Node.js server for shared page content and the admin panel. Open the project folder and double-click <b>start.bat</b>, then visit <b>http://localhost:3000</b>. No npm install or other software is required. Details are in README.md.</p></div></section>`;
    }
  }
  init();
})();
