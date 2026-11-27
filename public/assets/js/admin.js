(() => {
  'use strict';
  const root = document.getElementById('admin-root');
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pretty = value => JSON.stringify(value, null, 2);
  let content = null, current = 'dashboard', currentIndex = -1, username = 'admin', inquiries = [];
  let toastTimer = null;

  const collections = {
    people:{title:'People', singular:'profile', collection:'people', primary:'name', secondary:'role', fields:[['name','Full name','text'],['role','Designation / role shown on the roster card','text'],['team','Affiliation / department line shown on the card','text'],['teamYear','Academic year','teamYear'],['order','Manual display order (lower number appears first)','number'],['cardTag','Small card badge label (optional)','text'],['bio','Profile biography','textarea'],['image','Individual member portrait photograph','image'],['imageAlt','Portrait alternative text (accessibility)','text'],['linkedin','LinkedIn URL','url'],['email','Email address','email']]},
    events:{title:'Events',singular:'event',collection:'events',primary:'title',secondary:'date',fields:[['title','Event title','text'],['date','Event date','date'],['category','Category','text'],['status','Status','text'],['location','Venue / location','text'],['summary','Description','textarea'],['image','Event image','image'],['link','Registration / event URL','url']]},
    startups:{title:'Startups',singular:'startup',collection:'startups',primary:'name',secondary:'sector',fields:[['name','Venture name','text'],['sector','Sector','text'],['stage','Stage / status','text'],['founders','Founder names','text'],['year','Year','text'],['summary','Venture overview','textarea'],['logo','Venture logo (left side of card)','image'],['logoAlt','Venture logo alternative text','text'],['founderImage','Founder / person portrait (right side of card)','image'],['founderImageAlt','Founder portrait alternative text','text'],['image','Legacy image (used as portrait if no founder portrait is supplied)','image'],['imageAlt','Legacy image alternative text','text'],['linkedin','LinkedIn URL','url'],['email','Founder contact email','email'],['website','Website URL','url'],['order','Display order (lower number appears first)','number']]},
    messages:{title:'Messages from heads',singular:'message',collection:'messages',primary:'name',secondary:'designation',fields:[['name','Name','text'],['designation','Designation','text'],['heading','Message heading','text'],['quote','Message / quote','textarea'],['image','Portrait image','image'],['order','Display order (lower number appears first)','number']]},
    gallery:{title:'Gallery',singular:'photo',collection:'gallery',primary:'title',secondary:'category',fields:[['title','Photo title','text'],['category','Category','text'],['date','Year / date','text'],['caption','Caption','textarea'],['image','Photo image','image'],['order','Display order (lower number appears first)','number']]},
    blogs:{title:'Blogs',singular:'blog article',collection:'blogs',primary:'title',secondary:'author',fields:[['title','Article title','text'],['category','Category','text'],['author','Author','text'],['date','Display date','date'],['status','Publication status','select',['Draft','Scheduled','Published']],['publishAt','Schedule publish date and time','datetime-local'],['readTime','Reading time','text'],['excerpt','Short summary','textarea'],['image','Cover image','image'],['body','Article body','textarea']]},
    social:{title:'Social media',singular:'social post',collection:'social',primary:'platform',secondary:'date',fields:[['platform','Platform','text'],['date','Post date','date'],['caption','Post caption','textarea'],['image','Post image / thumbnail (upload file)','image'],['videoUrl','Video URL (YouTube or public video post)','url'],['link','Original post URL','url'],['order','Display order (lower number appears first)','number']]},
    mentors:{title:'Mentors',singular:'mentor',collection:'mentors',primary:'name',secondary:'expertise',fields:[['name','Mentor name','text'],['category','Directory category','select',['Mentors','Speakers','Engaged With']],['expertise','Area of expertise','text'],['organization','Organisation','text'],['bio','Biography','textarea'],['organizationLogo','Organisation / company logo (left side of card)','image'],['organizationLogoAlt','Organisation logo alternative text','text'],['image','Mentor / speaker portrait photograph (right side of card)','image'],['imageAlt','Portrait alternative text','text'],['linkedin','LinkedIn URL','url'],['email','Email address','email'],['order','Display order (lower number appears first within the category)','number']]},
    reports:{title:'Annual reports',singular:'annual report',collection:'reports',primary:'title',secondary:'year',fields:[['title','Report title','text'],['year','Report year','text'],['summary','Report summary','textarea'],['cover','Cover image','image'],['pdfUrl','Annual report PDF (upload file)','pdf'],['pages','Flipbook preview pages','pages'],['order','Display order (lower number appears first within the year group)','number']]},
    opportunities:{title:'Opportunities',singular:'opportunity',collection:'opportunities',primary:'title',secondary:'type',fields:[['title','Opportunity title','text'],['type','Opportunity type','text'],['deadline','Deadline / timeline','text'],['status','Status','text'],['summary','Description','textarea'],['eligibility','Who can participate','textarea'],['image','Opportunity image','image'],['link','Application / information URL','url']]},
    achievements:{title:'Achievements',singular:'achievement',collection:'achievements',primary:'title',secondary:'year',fields:[['title','Achievement title','text'],['year','Year','text'],['category','Category / competition','text'],['distinction','Position / recognition','text'],['description','Achievement description','textarea'],['image','Achievement photograph','image'],['order','Display order (lower number appears first)','number']]},
    pageIntros:{title:'Page introductions',singular:'page introduction',collection:'pageIntros',primary:'title',secondary:'page',fields:[['page','Page to edit','select',['home','about','people','events','startups','impact','messages','gallery','blogs','social','mentors','reports','contact','opportunities','achievements','team-year']],['eyebrow','Small label above the page title','text'],['title','Page heading','text'],['description','Supporting paragraph','textarea'],['number','Page number / index label','text'],['image','Page hero image (legacy People group photo is also supported)','image'],['imageAlt','Page hero image alternative text','text']]},
    pagePanels:{title:'Page closing panels',singular:'page panel',collection:'pagePanels',primary:'title',secondary:'page',fields:[['page','Page to edit','select',['about','people','events','startups','impact','messages','gallery','blogs','social-media','mentors','annual-reports','contact','opportunities','achievements']],['eyebrow','Small label','text'],['title','Closing-panel heading','text'],['text','Supporting paragraph','textarea'],['image','Closing-panel image','image'],['imageAlt','Closing-panel image alternative text','text'],['buttonLabel','Button label (leave blank to hide)','text'],['buttonUrl','Button destination (must lead to a different page)','text']]},
    teams:{title:'Academic-year team pages',description:'Each academic year has its own complete public page. Edit the People-page card, team-page hero, roster, member-card labels, photographs and individual closing panel here.',singular:'team year',collection:'teams',primary:'title',secondary:'year',fields:[
      ['__section_identity','1. Academic-year identity and directory card','section'],
      ['year','Academic year (e.g. 2024–2025)','text'],['yearKey','URL year key (e.g. 2024-2025; keep stable once published)','text'],['order','People-page card display order (lower number appears first)','number'],['title','Main team title (default year card and page heading)','text'],['description','Main team description (default year card and page description)','textarea'],
      ['__section_card','2. People-page year card','section'],
      ['cardTitle','Year-card title override','text'],['cardDescription','Year-card supporting description','textarea'],['cardImage','Year-card photograph','image'],['cardImageAlt','Year-card photograph alternative text','text'],['cardEyebrow','Year-card small label','text'],['buttonLabel','Year-card button label','text'],['cardFallbackEyebrow','Year-card image placeholder top label','text'],['cardFallbackTitle','Year-card image placeholder title','text'],['cardFallbackMeta','Year-card image placeholder supporting label','text'],['image','Legacy shared team photograph (used if separate card / roster images are blank)','image'],
      ['__section_hero','3. Individual team-page hero','section'],
      ['heroEyebrow','Hero small label','text'],['heroTitle','Hero heading override','text'],['heroDescription','Hero supporting description','textarea'],['heroNumber','Hero page number / index label','text'],['heroImage','Hero photograph','image'],['heroImageAlt','Hero photograph alternative text','text'],['heroArtMode','Hero visual: uploaded image / illustration','select',['both','diagram','image','none']],
      ['__section_roster','4. Roster section and navigation','section'],
      ['rosterEyebrow','Roster section small label','text'],['rosterTitle','Roster section heading','text'],['rosterDescription','Roster section supporting description','textarea'],['rosterImage','Roster-page group photograph','image'],['rosterImageAlt','Roster group photograph alternative text','text'],['backButtonLabel','Return button label','text'],['backButtonUrl','Return button destination (normally people.html)','text'],
      ['__section_members','5. Member cards and empty state','section'],
      ['memberTagLabel','Default member-card badge for this year','text'],['memberLinkedInLabel','LinkedIn link label on this year roster','text'],['memberEmailLabel','Email link label on this year roster','text'],['emptyRosterEyebrow','Empty roster small label','text'],['emptyRosterTitle','Empty roster heading','text'],['emptyRosterDescription','Empty roster supporting text','textarea'],['emptyRosterActionText','Optional additional empty-roster instruction','text'],
      ['__section_end','6. This academic-year page closing panel','section'],
      ['pageEndEyebrow','Closing-panel small label','text'],['pageEndTitle','Closing-panel heading','text'],['pageEndText','Closing-panel paragraph','textarea'],['pageEndImage','Closing-panel photograph','image'],['pageEndImageAlt','Closing-panel photograph alternative text','text'],['pageEndButtonLabel','Closing-panel button label','text'],['pageEndButtonUrl','Closing-panel button destination','text'],['pageEndTone','Closing-panel colour theme','select',['navy','mint','white','soft','green']]
    ]}
  };
  const objects = {
    site:{title:'Site identity',description:'Update the EDC name, official logo, establishment year, contact details and social links.',keys:['brand','name','shortName','established','logoImage','email','phone','address','website','linkedin','instagram','youtube','facebook']},
    navigation:{title:'Navigation & footer copy',description:'Edit the centred establishment strip, main navigation, mega-menu links, footer columns and small navigation labels shown throughout the website.',keys:['topLinePrefix','topLineBrand','homeLabel','mainAbout','mainPeople','mainProgrammes','mainVentures','mainImpact','mainSocial','mainGallery','exploreLabel','reachOutLabel','reachOutUrl','megaTitle','megaNote','megaLinks','megaFooterLine','megaFooterCta','megaFooterCtaUrl','footerBrandLine','footerGroups','copyrightPrefix','copyrightSuffix']},
    home:{title:'Home page',description:'Edit homepage headings, supporting copy, every image slot, the anthem video, ecosystem tiles, focus cards, six practical steps, comparison content, activity cards, blog and leadership labels, page CTA and small interface labels.',keys:['eyebrow','title','description','primaryLabel','primaryUrl','secondaryLabel','secondaryUrl','heroImage','diagramEyebrow','diagramTitle','diagramText','diagramLinkLabel','diagramLinkUrl','statsTitle','statsDescription','stats','ecosystemEyebrow','ecosystemTitle','ecosystemDescription','ecosystemWall','stakeholderEyebrow','stakeholderTitle','stakeholderDescription','stakeholders','wallFootLabel','wallFootLinkLabel','wallFootLinkUrl','focusEyebrow','focusTitle','focusDescription','frictionPoints','pathwayEyebrow','pathwayTitle','pathwayDescription','journeyOutputLabel','journeyHint','journeyExitLabel','journey','comparisonEyebrow','comparisonTitle','comparisonDescription','comparisonLeftLabel','comparisonLeftTitle','comparisonLeftImage','comparisonLeftPoints','comparisonRightLabel','comparisonRightTitle','comparisonRightImage','comparisonRightPoints','comparisonLinkLabel','comparisonLinkUrl','anthemEyebrow','anthemTitle','anthemDescription','anthemVideoUrl','anthemPoster','anthemPlaceholderTitle','anthemPlaceholderText','featureEyebrow','featureTitle','featureText','featureImage','featureButtonLabel','featureButtonUrl','workEyebrow','workTitle','workDescription','workCards','blogEyebrow','blogTitle','blogDescription','blogLinkLabel','blogLinkUrl','messagesEyebrow','messagesTitle','messagesDescription','messagesLinkLabel','messagesLinkUrl','finalTitle','finalText','finalButtonLabel','finalButtonUrl','ctaEyebrow','ctaTitle','ctaText','ctaButtonLabel','ctaButtonUrl']},
    about:{title:'About page',description:'Edit the story, mission, vision, section labels, image holders, principles and institutional journey.',keys:['eyebrow','title','description','storyEyebrow','storyTitle','story','storyFootnote','storyImage','missionLabel','missionTitle','missionImage','mission','visionLabel','visionTitle','visionImage','vision','principlesEyebrow','principlesTitle','principles','journeyEyebrow','journeyTitle','journey']},
    impact:{title:'Impact page',description:'Maintain impact numbers, explanatory copy, section headings, supporting image and milestone records. Keep figures current and verifiable.',keys:['eyebrow','title','description','stats','statement','statementImage','milestonesEyebrow','milestonesTitle','milestones']},
    contact:{title:'Contact page',description:'Edit the contact image, contact panel, every enquiry step, field label, placeholder, privacy note, enquiry categories and goals.',keys:['eyebrow','title','description','contactImage','contactPanelEyebrow','contactPanelTitle','contactPanelText','formTitle','formIntro','step1Title','step1Note','step2Title','step2Note','step3Title','step3Note','nameLabel','emailLabel','subjectLabel','messageLabel','namePlaceholder','emailPlaceholder','subjectPlaceholder','messagePlaceholder','continueLabel','submitLabel','backLabel','privacyNote','reviewHint','locationLabel','emailDetailLabel','phoneDetailLabel','responseNote','directionsUrl','enquiryChoices','goals']},
    teamDirectory:{title:'People page & team-page content',description:'Edit the People page photograph and section copy, shared year-card defaults, roster defaults and member-card labels. Edit the People hero under Page introductions → people and the People closing section under Page closing panels → people. Each Academic-year team record separately controls its own card, hero visual, roster, photographs, member labels and closing panel.',keys:['groupPhotoImage','groupPhotoImageAlt','groupPhotoEyebrow','groupPhotoTitle','groupPhotoDescription','groupPhotoPlaceholderText','overviewEyebrow','overviewTitle','overviewDescription','emptyTeamsTitle','emptyTeamsDescription','cardEyebrow','cardButtonLabel','cardFallbackEyebrow','cardFallbackTitle','cardFallbackMeta','defaultRosterEyebrow','defaultRosterDescription','defaultBackButtonLabel','defaultBackButtonUrl','emptyRosterEyebrow','emptyRosterTitle','emptyRosterDescription','emptyRosterActionText','memberTagLabel','memberMetaFallback','memberPlaceholderLabel','memberLinkedInLabel','memberEmailLabel','missingTeamEyebrow','missingTeamTitle','missingTeamDescription','missingTeamBackLabel','missingTeamBackUrl']}
  };
  const teamDirectoryDefaults = {
    groupPhotoImage:'',
    groupPhotoImageAlt:'EDCKPRCAS students, leaders and collaborators together',
    groupPhotoEyebrow:'Leadership and community',
    groupPhotoTitle:'People behind the work.',
    groupPhotoDescription:'A shared photograph of the people who contribute to the EDCKPRCAS community.',
    groupPhotoPlaceholderText:'A shared photograph of the EDCKPRCAS community will appear here.',
    overviewEyebrow:'Student teams by academic year',
    overviewTitle:'Three academic years. One EDC community.',
    overviewDescription:'Choose an academic year to open its own roster page, with individual member photographs and profiles.',
    emptyTeamsTitle:'Student teams will appear here.',
    emptyTeamsDescription:'Academic-year team details will be displayed here when they are added in the Content Manager.',
    cardEyebrow:'TEAM',
    cardButtonLabel:'VIEW TEAM ROSTER',
    cardFallbackEyebrow:'EDC STUDENT TEAM',
    cardFallbackTitle:'Academic year',
    cardFallbackMeta:'MEMBERS · ROLES · ACTIVITIES',
    defaultRosterEyebrow:'Individual team members',
    defaultRosterDescription:'Each card contains one member photograph, name, role and concise profile details.',
    defaultBackButtonLabel:'All academic years',
    defaultBackButtonUrl:'people.html',
    emptyRosterEyebrow:'Academic-year team',
    emptyRosterTitle:'Team profiles will appear here.',
    emptyRosterDescription:'Student profiles for this academic year have not been added yet.',
    emptyRosterActionText:'',
    memberTagLabel:'People',
    memberMetaFallback:'Team',
    memberPlaceholderLabel:'EDC PROFILE',
    memberLinkedInLabel:'LinkedIn',
    memberEmailLabel:'Email',
    missingTeamEyebrow:'Student teams',
    missingTeamTitle:'Academic-year team not found.',
    missingTeamDescription:'Choose an academic year from the People page.',
    missingTeamBackLabel:'Back to People',
    missingTeamBackUrl:'people.html'
  };

  const moduleOrder = [
    {label:'OVERVIEW',items:[['dashboard','Dashboard','⌂']]},
    {label:'SITE CONTENT',items:[['site','Site identity','S'],['navigation','Navigation & footer','N'],['home','Home page','H'],['about','About page','A'],['impact','Impact page','I'],['contact','Contact page','C'],['teamDirectory','People & team page content','T']]},
    {label:'PUBLISH & MANAGE',items:[['people','People','P'],['teams','Academic-year teams','T'],['events','Events','E'],['startups','Startups','V'],['messages','Messages from heads','M'],['gallery','Gallery','G'],['blogs','Blogs','B'],['social','Social media','↗'],['mentors','Mentors','+'],['reports','Annual reports','R'],['opportunities','Opportunities','O'],['achievements','Achievements','A'],['pageIntros','Page introductions','I'],['pagePanels','Page closing panels','C'],['inquiries','Enquiry inbox','✉']]},
    {label:'ACCOUNT',items:[['security','Security','◇']]}
  ];

  async function api(url, options={}) {
    const response = await fetch(url,{credentials:'same-origin',...options,headers:{...(options.headers||{})}});
    let body={}; try{body=await response.json();}catch{}
    if (!response.ok) { if(response.status===401 && current!=='login') { showLogin(false,'Your session has expired. Please sign in again.'); } throw new Error(body.error || `Request failed (${response.status}).`); }
    return body;
  }
  function showToast(message, error=false) {
    let el=$('.toast'); if(!el){el=document.createElement('div');el.className='toast';document.body.appendChild(el);} 
    el.textContent=message; el.style.background=error?'#8f3535':'#102a56'; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3200);
  }

  const localAuthoring = ['localhost', '127.0.0.1'].includes(location.hostname);
  function authMarkup(setup=false, error='') {
    const title=setup?'Create your Content Manager account':'Welcome back';
    const desc=setup
      ? (localAuthoring ? 'Set the first Content Manager login for this local website.' : 'Create the first administrator account for the live EDCKPRCAS website. Your account and content will be stored in the private Cloudflare database.')
      : 'Sign in to manage the pages, media, stories and enquiries on your website.';
    const setupKeyField = setup && !localAuthoring
      ? '<div class="field"><label for="authSetupToken">One-time setup key</label><input id="authSetupToken" name="setupToken" type="password" required autocomplete="off" placeholder="Paste the one-time key supplied during deployment"><div class="field-hint">This is the CMS_SETUP_TOKEN secret configured in Cloudflare. Remove that secret after creating your first administrator account.</div></div>'
      : '';
    const foot = localAuthoring ? 'Private Content Manager · Local preview' : 'Private Content Manager · Secure hosted workspace';
    const setupTip = localAuthoring
      ? '<div class="auth-tip"><b>Important:</b> This local preview creates an administrator account on your computer. The live Cloudflare CMS has its own first-time setup and account.</div>'
      : '<div class="auth-tip"><b>Important:</b> Create a unique username and a strong password. Save them securely. After setup, remove the CMS_SETUP_TOKEN secret from Cloudflare so nobody can use the first-time setup route again.</div>';
    const loginTip = '<div class="auth-tip">Your session uses a secure, HttpOnly browser cookie. Sign out when you finish using a shared computer. You can change your password under Account security.</div>';
    return `<div class="auth-screen"><aside class="auth-art"><div class="auth-brand"><div class="brand-mark">EDC</div><div><b>EDCKPRCAS</b><span>Content Manager</span></div></div><div class="auth-message"><div class="eyebrow">Content management workspace</div><h1>Manage the EDC website.</h1><p>Update institutional pages, programmes, student ventures, people, reports and enquiries from this Content Manager workspace.</p></div><div class="auth-foot">${foot}</div></aside><section class="auth-form-wrap"><form class="auth-form" id="authForm"><div class="eyebrow">${setup?'First-time setup':'Secure sign in'}</div><h2>${title}</h2><p>${desc}</p><div class="field"><label for="authUser">Username</label><input id="authUser" name="username" required minlength="3" maxlength="32" autocomplete="username" placeholder="Choose a Content Manager username" value="${setup?'admin':''}"></div><div class="field"><label for="authPass">${setup?'Create password':'Password'}</label><input id="authPass" name="password" type="password" required ${setup?'minlength="10"':''} autocomplete="${setup?'new-password':'current-password'}" placeholder="${setup?'At least 10 characters':'Your password'}"></div>${setup?'<div class="field"><label for="authPass2">Confirm password</label><input id="authPass2" name="passwordConfirm" type="password" required minlength="10" autocomplete="new-password" placeholder="Re-enter password"></div>':''}${setupKeyField}<button class="primary-btn block" id="authSubmit" type="submit">${setup?'Create Content Manager':'Sign in'} <span>↗</span></button><div class="auth-error" id="authError">${esc(error)}</div>${setup?setupTip:loginTip}</form></section></div>`;
  }
  function showLogin(setup, error='') {
    current='login'; root.innerHTML=authMarkup(setup,error);
    $('#authForm')?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget; const fd=new FormData(form); const submit=$('#authSubmit'); const err=$('#authError');
      const user=String(fd.get('username')||'').trim(), pass=String(fd.get('password')||'');
      if(setup && pass!==String(fd.get('passwordConfirm')||'')){err.textContent='The passwords do not match.';return;}
      submit.disabled=true;submit.textContent=setup?'Creating account…':'Signing in…';err.textContent='';
      try{
        const result=await api(setup?'/api/admin/setup':'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:pass,setupToken:String(fd.get('setupToken')||'')})});
        username=result.username||user; await showApp();
      }catch(error){err.textContent=error.message;submit.disabled=false;submit.textContent=setup?'Create Content Manager ↗':'Sign in ↗';}
    });
  }

  function renderShell() {
    root.innerHTML=`<div class="admin-shell"><aside class="sidebar"><div class="side-brand"><div class="side-mark">KPR</div><div><b>CONTENT MANAGER</b><span>EDCKPRCAS</span></div></div><button class="mobile-menu-toggle" id="mobileMenuToggle" type="button" aria-expanded="false" aria-controls="adminNav">Browse CMS sections <span aria-hidden="true">⌄</span></button><div id="adminNav" class="admin-nav-wrap is-collapsed"></div><div class="side-bottom"><a href="../index.html" target="_blank" rel="noopener">↗ View public website</a><a href="../" target="_blank" rel="noopener">↗ Open home page</a><button id="logoutBtn" type="button">Sign out →</button></div></aside><main class="admin-main"><header class="admin-top"><div><h1 id="topTitle">Dashboard</h1><p>Website content management</p></div><div class="top-user"><span class="user-dot">${esc(username.slice(0,1).toUpperCase())}</span><span>${esc(username)}</span></div></header><div class="admin-content" id="adminContent"></div></main></div><div class="toast"></div>`;
    renderNav();
    $('#logoutBtn').addEventListener('click',logout);
    $('#mobileMenuToggle')?.addEventListener('click',()=>{
      const nav=$('#adminNav'); const button=$('#mobileMenuToggle');
      const open=nav?.classList.toggle('is-open');
      nav?.classList.toggle('is-collapsed',!open);
      button?.setAttribute('aria-expanded',String(Boolean(open)));
      if(button)button.querySelector('span').textContent=open?'⌃':'⌄';
    });
  }
  function renderNav() {
    $('#adminNav').innerHTML=moduleOrder.map(group=>`<div class="side-label">${group.label}</div><nav class="side-nav">${group.items.map(([key,label,icon])=>`<button type="button" data-module="${key}" class="${key===current?'active':''}"><span class="side-icon">${icon}</span>${label}</button>`).join('')}</nav>`).join('');
    $$('[data-module]').forEach(btn=>btn.addEventListener('click',()=>{
      current=btn.dataset.module;currentIndex=-1;
      const nav=$('#adminNav'); const toggle=$('#mobileMenuToggle');
      nav?.classList.remove('is-open'); nav?.classList.add('is-collapsed'); toggle?.setAttribute('aria-expanded','false');
      if(toggle)toggle.querySelector('span').textContent='⌄';
      renderNav();renderModule();
    }));
  }
  async function showApp() {
    try { content=await api('/api/admin/data'); inquiries=await api('/api/admin/inquiries'); }
    catch(error){ showLogin(false,error.message); return; }
    current='dashboard'; renderShell(); renderModule();
  }
  async function logout() { try{await api('/api/admin/logout',{method:'POST'});}catch{} content=null;showLogin(false,'You have signed out.'); }

  function renderDashboard() {
    const counts=Object.fromEntries(Object.keys(collections).map(key=>[key,(content[collections[key].collection]||[]).length]));
    const total=Object.values(counts).reduce((a,b)=>a+b,0);
    return `<div class="welcome-row"><div><h2>Welcome to your website workspace.</h2><p>Manage every public-facing section from one content hub.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="ghost-btn" id="exportData" type="button">Export backup ↓</button><button class="ghost-btn" id="importData" type="button">Import backup ↑</button><input type="file" id="importDataInput" accept="application/json,.json" hidden><a class="primary-btn" href="../index.html" target="_blank" rel="noopener">View live site ↗</a></div></div>
      <div class="notice"><b>Publishing checklist:</b> confirm the latest institutional figures and contact details, then upload approved event, leadership, venture and programme photographs before publishing.</div>
      <div class="stat-cards"><div class="dash-stat"><span>Content records</span><strong>${total}</strong></div><div class="dash-stat"><span>People profiles</span><strong>${counts.people}</strong></div><div class="dash-stat"><span>Events</span><strong>${counts.events}</strong></div><div class="dash-stat"><span>New enquiries</span><strong>${inquiries.filter(x=>x.status==='New').length}</strong></div></div>
      <div class="dash-grid"><section class="panel"><h3>Quick actions</h3><p>Jump straight to the content you need to update.</p><div class="quick-links">${[['events','Publish an event','Add a workshop, summit or programme'],['people','Update people','Edit leadership and team profiles'],['startups','Add a startup','Publish a new venture profile'],['gallery','Upload gallery photos','Curate approved event photography'],['reports','Add an annual report','Publish a report and its PDF'],['opportunities','Post an opportunity','Add calls, programmes and pathways'],['achievements','Publish an achievement','Add a verified recognition or result']].map(([key,title,desc])=>`<button class="quick-link" data-module="${key}"><b>${title} ↗</b><span>${desc}</span></button>`).join('')}</div></section>
      <section class="panel"><h3>Website status</h3><p>${localAuthoring?'Content is stored in local JSON files for preview.':'Content, administrator sessions, enquiries and uploaded media are stored in the private Cloudflare D1 database.'}</p><div class="record-row"><div class="record-name"><b>Public website</b><span>${localAuthoring?'Available on this local server':'Live Cloudflare Pages website'}</span></div><span class="card-tag">Ready</span></div><div class="record-row"><div class="record-name"><b>Content Manager security</b><span>${localAuthoring?'Local server session':'Secure hosted administrator session'}</span></div><span class="card-tag">Active</span></div><div class="record-row"><div class="record-name"><b>Media uploads</b><span>${localAuthoring?'Saved to local /uploads folder':'Stored in private database-backed media storage'}</span></div><span class="card-tag">Ready</span></div><div class="record-row"><div class="record-name"><b>Enquiry inbox</b><span>${localAuthoring?'Saved locally · email depends on local mail settings':'Saved online · email delivery status tracked here'}</span></div><span class="card-tag">Active</span></div></section></div>`;
  }
  function uploadPreview(value, type='image') {
    if (!value) return `<div class="upload-preview-empty">No file uploaded yet.</div>`;
    const filename = String(value).split('/').pop().split('?')[0] || 'Uploaded file';
    return type === 'pdf'
      ? `<div class="upload-preview-file">PDF uploaded: <b>${esc(filename)}</b></div>`
      : `<div class="upload-preview-image"><img src="${esc(value)}" alt="Current uploaded image"><span>${esc(filename)}</span></div>`;
  }
  function uploadFieldMarkup(key, value, type='image', prefix='') {
    const isPdf = type === 'pdf';
    const inputKey = `${prefix}${key}`;
    return `<div class="admin-field full upload-field"><label>${esc(prettyFieldName(key))}</label><input type="hidden" data-upload-value="${esc(key)}" ${prefix ? `data-array-key="${esc(key)}"` : `data-field="${esc(key)}" data-object-field="${esc(key)}"`} value="${esc(value||'')}"><div data-upload-preview>${uploadPreview(value, isPdf?'pdf':'image')}</div><div class="upload-line"><label class="file-pick">${isPdf?'Choose PDF':'Choose image'}<input type="file" data-upload-for="${esc(inputKey)}" ${prefix?'data-upload-for-array="'+esc(key)+'"':''} accept="${isPdf?'application/pdf':'image/png,image/jpeg,image/webp,image/gif'}"></label><span class="field-hint">${isPdf?'PDF up to 12 MB':'JPG, PNG, WEBP or GIF up to 12 MB'}</span></div></div>`;
  }
  function fieldInput(field, value, prefix='') {
    const [key,label,type] = field; const name=`${prefix}${key}`;
    if (type==='section') return `<div class="admin-field full admin-form-section"><h4>${esc(label)}</h4></div>`;
    const full = ['bio','summary','quote','caption','excerpt','body','eligibility','pages','mission','vision','story','description','introText','featureText','statement','responseNote','text'].includes(key) || type==='textarea' || type==='pages';
    if (type==='pages') return `<div class="admin-field full"><label for="${name}">${label}</label><textarea id="${name}" data-field="${key}" data-type="pages" placeholder="Separate each flipbook page using a line with ===PAGE===">${esc(Array.isArray(value)?value.join('\n\n===PAGE===\n\n'):value||'')}</textarea><div class="field-hint">Use ===PAGE=== on a separate line to split pages in the digital report reader.</div></div>`;
    if (type==='image' || type==='pdf') return uploadFieldMarkup(key,value,type);
    if (type==='teamYear') {
      const normalizeYear = raw => { const digits=String(raw||'').replace(/\D/g,''); return digits.length===8?`${digits.slice(0,4)}-${digits.slice(4)}`:String(raw||'').trim().toLowerCase(); };
      const teams=Array.isArray(content?.teams)?content.teams:[];
      const selected=normalizeYear(value);
      const options=teams.map(team=>({value:String(team.yearKey||normalizeYear(team.year)),label:String(team.year||team.title||team.yearKey||'Academic year')}));
      if(value && !options.some(option=>normalizeYear(option.value)===selected)) options.unshift({value:String(value),label:`${value} (existing value)`});
      return `<div class="admin-field"><label for="${name}">${label}</label><select id="${name}" data-field="${key}"><option value="">Not assigned to an academic year</option>${options.map(option=>`<option value="${esc(option.value)}" ${normalizeYear(option.value)===selected?'selected':''}>${esc(option.label)}</option>`).join('')}</select><div class="field-hint">Choose the matching Academic-year team record. This controls which roster page displays this student.</div></div>`;
    }
    if (type==='select') { const options=[...(field[3]||[])]; const needsChoice=key==='page'; if(needsChoice && value && !options.includes(String(value))) options.unshift(String(value)); return `<div class="admin-field"><label for="${name}">${label}</label><select id="${name}" data-field="${key}" ${needsChoice?'required':''}>${needsChoice?`<option value="" ${value?'':'selected'} disabled>Choose a page…</option>`:''}${options.map(option=>{const optionLabel=option==='team-year'?'Legacy shared team-year intro (individual pages now use Academic-year team records)':option.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase());return `<option value="${esc(option)}" ${String(value||'')===String(option)?'selected':''}>${esc(optionLabel)}</option>`;}).join('')}</select></div>`; }
    const tag = full ? 'textarea' : 'input'; const inputType = type==='date'?'date':type==='datetime-local'?'datetime-local':type==='url'?'url':type==='email'?'email':type==='number'?'number':'text';
    if(tag==='textarea') return `<div class="admin-field full"><label for="${name}">${label}</label><textarea id="${name}" data-field="${key}" placeholder="${esc(label)}">${esc(value||'')}</textarea></div>`;
    const hint = type==='datetime-local' ? '<div class="field-hint">Use your local time. A Scheduled article remains private until this date and time; the website publishes it automatically when the time arrives.</div>' : (key==='order' ? '<div class="field-hint">Enter a positive whole number (1, 2, 3…). Smaller numbers appear first. Use unique numbers for a clear sequence. Leave blank to retain the existing saved order after all numbered records.</div>' : '');
    const socialHint = current==='social' && (key==='link' || key==='videoUrl') ? '<div class="field-hint">Paste a public post or video URL. The Content Manager will try to fetch and save its thumbnail automatically. Some platforms restrict previews; upload an image manually if the platform blocks access.</div>' : '';
    let valueForInput = value || '';
    if (type==='datetime-local' && value) {
      const dateValue = new Date(value);
      if (!Number.isNaN(dateValue.getTime())) {
        const localDate = new Date(dateValue.getTime() - dateValue.getTimezoneOffset()*60000);
        valueForInput = localDate.toISOString().slice(0,16);
      } else valueForInput = String(value).slice(0,16);
    }
    const numericAttributes = type==='number' ? ' min="1" step="1" inputmode="numeric" autocomplete="off"' : '';
    return `<div class="admin-field"><label for="${name}">${label}</label><input id="${name}" data-field="${key}" type="${inputType}"${numericAttributes} value="${esc(valueForInput)}" placeholder="${esc(label)}">${hint}${socialHint}</div>`;
  }
  function renderCollection(key) {
    const config=collections[key]; const rows=content[config.collection]||[]; const selected=currentIndex>=0?rows[currentIndex]:null;
    const fields=config.fields.map(f=>{let value=selected?.[f[0]]??'';if(current==='teams' && selected && (f[0]==='cardImage'||f[0]==='rosterImage') && !value)value=selected.image||'';if(f[0]==='status')value=selected?(selected.status||'Published'):'Draft';return fieldInput(f,value);}).join('');
    const hasDisplayOrder=config.fields.some(field=>field[0]==='order');
    const moduleDescription=current==='teams'?'Each academic year is an independent page. Edit its hero, year card, photographs, roster headings, buttons, empty state and display order here.':current==='people'?'Each student is an independent profile. Edit every visible card field, upload the portrait, assign the academic year and set a manual display order to match the designation hierarchy.':hasDisplayOrder?'Add, edit or remove records. Assign a unique display number (1, 2, 3…) to control the public card sequence.':'Add, edit or remove records that appear on the public '+config.title.toLowerCase()+' page.';
    const formGuidance=current==='teams'?'Separate card, hero and roster photographs are supported. If the separate card or roster image is blank, the legacy shared photograph is used. Team-card and roster copy can be set independently.':hasDisplayOrder?'Enter a whole number such as 1, 2 or 3. Lower numbers appear first on the public page. Use unique numbers for a clear sequence. Records with blank numbers follow numbered records in their existing saved order.':'';
    return `<div class="content-head"><div><h2>${config.title}</h2><p>${esc(moduleDescription)}</p></div><button class="primary-btn" id="newRecord">+ Add ${config.singular}</button></div>
      <div class="editor-layout"><section class="list-panel"><div class="list-header"><h3>${rows.length} ${config.title.toLowerCase()}</h3><span class="small muted">Select to edit</span></div><div class="record-list">${rows.length?rows.map((row,i)=>`<div class="record-row ${i===currentIndex?'selected':''}"><div class="record-name"><b>${esc(row[config.primary]||'Untitled')}</b><span>${esc(row[config.secondary]||'No secondary detail')}${config.fields.some(field=>field[0]==='order') && row.order!==undefined && row.order!==null && String(row.order).trim()!=='' ? ` · Display order ${esc(row.order)}` : ''}</span></div><div class="record-actions"><button type="button" data-edit="${i}">Edit</button><button type="button" data-delete="${i}">×</button></div></div>`).join(''):'<div class="empty-state">No records yet. Use “Add” to create the first one.</div>'}</div></section>
      <section class="form-panel"><h3>${selected?'Edit':'Create'} ${config.singular}</h3><p>Fields marked by their purpose are shown on the public website. Leave optional fields blank when they do not apply.${current==='blogs'?' Set status to Scheduled and choose a date/time to publish automatically. Draft articles stay private.':''} ${esc(formGuidance)}</p><form id="recordForm"><div class="form-grid">${fields}</div><div class="form-actions"><button class="danger-btn" type="button" id="cancelEdit">Cancel</button><div class="form-actions-right"><button class="primary-btn" id="saveRecord" type="submit">Save ${config.singular} ↗</button></div></div><div class="save-status" id="formStatus"></div></form></section></div>`;
  }
  const arrayLongKeys = new Set(['text','description','body','summary','quote','bio','caption','excerpt']);
  function prettyFieldName(key) {
    const labels = {
      logoImage:'Official EDC-KPRCAS logo', brand:'Institution name', shortName:'Short brand name', established:'Year established',
      anthemVideoUrl:'Official EDC anthem YouTube URL', anthemPoster:'Anthem video poster image', heroImage:'Homepage diagram / hero image',
      featureImage:'Student participation image', comparisonLeftImage:'Early exploration image', comparisonRightImage:'EDC development image',
      ctaTitle:'Homepage closing heading', ctaText:'Homepage closing text', ctaButtonLabel:'Homepage closing button label', ctaButtonUrl:'Homepage closing button destination',
      primaryLabel:'Primary hero button label', primaryUrl:'Primary hero button destination', secondaryLabel:'Secondary hero button label', secondaryUrl:'Secondary hero button destination',
      title:'Heading / title', description:'Supporting paragraph', eyebrow:'Small section label', image:'Image',
      storyImage:'EDC story image', missionImage:'Mission image', visionImage:'Vision image', statementImage:'Impact statement image', contactImage:'Reach Us image',
      footerBrandLine:'Footer institutional description', megaNote:'Mega-menu description', megaTitle:'Mega-menu heading', megaFooterCtaUrl:'Mega-menu call-to-action destination',
      journeyHint:'Journey scroll instruction', journeyExitLabel:'Journey exit button label', journeyOutputLabel:'Journey output label', visualMode:'Pathway visual display', stakeholderEyebrow:'Stakeholders section label', stakeholderTitle:'Stakeholders heading', stakeholderDescription:'Stakeholders supporting text', stakeholders:'Stakeholder logos', topLineBrand:'Top strip brand label', homeLabel:'Breadcrumb Home label', groupPhotoImage:'People group photograph', groupPhotoImageAlt:'People group photograph alternative text', groupPhotoEyebrow:'People photograph section label', groupPhotoTitle:'People photograph section heading', groupPhotoDescription:'People photograph supporting text', groupPhotoPlaceholderText:'People photograph placeholder message', overviewEyebrow:'Academic-year overview section label', overviewTitle:'Academic-year overview heading', overviewDescription:'Academic-year overview supporting text', emptyTeamsTitle:'Empty academic-year list heading', emptyTeamsDescription:'Empty academic-year list supporting text', cardEyebrow:'Academic-year card label', cardButtonLabel:'Academic-year card button label', cardFallbackEyebrow:'Year-card image placeholder label', cardFallbackMeta:'Year-card image placeholder caption', defaultRosterEyebrow:'Default roster section label', defaultRosterDescription:'Default roster supporting text', defaultBackButtonLabel:'Default return button label', defaultBackButtonUrl:'Default return button destination', emptyRosterEyebrow:'Empty roster small label', emptyRosterTitle:'Empty roster heading', emptyRosterDescription:'Empty roster supporting text', emptyRosterActionText:'Extra empty-roster instruction', memberTagLabel:'Default member badge label', memberMetaFallback:'Default member affiliation', memberPlaceholderLabel:'Default missing member-photo label', memberLinkedInLabel:'Member LinkedIn link label', memberEmailLabel:'Member email link label', missingTeamEyebrow:'Missing-team page small label', missingTeamTitle:'Missing-team page heading', missingTeamDescription:'Missing-team page description', missingTeamBackLabel:'Missing-team back button label', missingTeamBackUrl:'Missing-team back button URL', pageEndEyebrow:'Team closing-panel small label', pageEndTitle:'Team closing-panel heading', pageEndText:'Team closing-panel paragraph', pageEndImage:'Team closing-panel photograph', pageEndImageAlt:'Team closing-panel image alternative text', pageEndButtonLabel:'Team closing-panel button label', pageEndButtonUrl:'Team closing-panel button URL', pageEndTone:'Team closing-panel colour theme', heroNumber:'Team-page hero index / number', heroEyebrow:'Team-page hero eyebrow label', heroTitle:'Team-page hero heading override', heroDescription:'Team-page hero description override', heroImage:'Team-page hero image', heroImageAlt:'Team-page hero image alternative text', heroArtMode:'Team-page hero visual display', cardTitle:'Year-card title override', cardDescription:'Year-card description override', cardImage:'Year-card photograph', cardImageAlt:'Year-card photograph alternative text', cardFallbackTitle:'Year-card placeholder title', order:'Display order', rosterEyebrow:'Roster section eyebrow label', rosterTitle:'Roster section heading', rosterDescription:'Roster section supporting text', rosterImage:'Roster group photograph', rosterImageAlt:'Roster group photograph alternative text', memberTagLabel:'Member-card badge label', backButtonLabel:'Return button label', backButtonUrl:'Return button destination', emptyRosterEyebrow:'Empty roster small label', emptyRosterTitle:'Empty roster heading', emptyRosterDescription:'Empty roster supporting text', emptyRosterActionText:'Extra empty-roster instruction', buttonLabel:'Year-card button label', cardTag:'Member-card badge label', imageAlt:'Portrait alternative text'
    };
    return labels[key] || String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
  }
  // Explicit upload-field schemas prevent text keys such as groupPhotoTitle,
  // groupPhotoDescription and imageAlt from being incorrectly rendered as uploads.
  const objectImageFields = new Set([
    'logoImage','heroImage','comparisonLeftImage','comparisonRightImage','anthemPoster','featureImage',
    'storyImage','missionImage','visionImage','statementImage','contactImage','groupPhotoImage'
  ]);
  const objectPdfFields = new Set([]);
  const arrayImageFields = {
    ecosystemWall:['image'], stakeholders:['logo'], frictionPoints:['image'], journey:['image'],
    principles:['image'], milestones:['image'], workCards:['image']
  };
  const arrayPdfFields = {};

  function renderArrayRow(keys, values={}, index=0, arrayFieldKey='') {
    const fields = keys.map(key => {
      const value = values?.[key] ?? '';
      const isVisualMode = key === 'visualMode';
      const selectedVisualMode = String(value || 'orb');
      const isImage = (arrayImageFields[arrayFieldKey] || []).includes(key);
      const isPdf = (arrayPdfFields[arrayFieldKey] || []).includes(key);
      const control = isVisualMode
        ? `<select data-array-key="visualMode"><option value="orb" ${selectedVisualMode === 'orb' ? 'selected' : ''}>Original rings + step number</option><option value="image" ${selectedVisualMode === 'image' ? 'selected' : ''}>Uploaded image</option></select><div class="field-hint">Recommended: keep the original orbital rings and numbered centre. Choose Uploaded image only when you want the uploaded file to replace that graphic.</div>`
        : isImage || isPdf
          ? uploadFieldMarkup(key,value,isPdf?'pdf':'image','array-')
          : arrayLongKeys.has(key.toLowerCase())
            ? `<textarea data-array-key="${esc(key)}" placeholder="${esc(prettyFieldName(key))}">${esc(value)}</textarea>`
            : `<input data-array-key="${esc(key)}" type="${key==='url'?'url':key==='email'?'email':'text'}" value="${esc(value)}" placeholder="${esc(prettyFieldName(key))}">${arrayFieldKey==='workCards' && (key==='url'||key==='buttonLabel') ? `<div class="field-hint">Optional action. Leave its label or destination blank to hide the card link on the homepage.</div>` : ''}`;
      return `<div class="admin-field ${arrayLongKeys.has(key.toLowerCase())||isImage||isPdf?'full':''}">${isImage||isPdf?'':`<label>${esc(prettyFieldName(key))}</label>`}${control}</div>`;
    }).join('');
    return `<div class="array-record"><div class="array-record-head"><b>Entry ${index+1}</b><button type="button" class="danger-btn" data-array-remove>Remove entry</button></div><div class="form-grid">${fields}</div></div>`;
  }
  function renderArrayEditor(fieldKey, value) {
    const rows = Array.isArray(value) ? value : [];
    const defaults = {
      stats:['value','label'], ecosystemWall:['label','sub','mark','image'], stakeholders:['name','logo'], frictionPoints:['title','text','symbol','image'],
      journey:['phase','title','text','output','image'], principles:['title','text','image'], milestones:['year','title','text','image'], workCards:['number','eyebrow','category','title','text','buttonLabel','url','image'],
      comparisonLeftPoints:['text'], comparisonRightPoints:['text'], enquiryChoices:['label','description'], goals:['label','description'],
      megaLinks:['group','groupNote','label','url'], footerGroups:['heading','label','url']
    };
    let keys = Object.keys(rows[0] || {}).length ? Object.keys(rows[0]) : (defaults[fieldKey] || ['title','text']);
    if (fieldKey === 'journey') {
      // Add the visual selector to existing D1 records too; missing values default to the original rings.
      keys = [...keys.filter(key => key !== 'visualMode' && key !== 'image'), 'visualMode', 'image'];
    }
    const records = rows.map((row,i)=>renderArrayRow(keys,row,i,fieldKey)).join('') || renderArrayRow(keys,{},0,fieldKey);
    return `<div class="admin-field full array-editor" data-array-editor="${esc(fieldKey)}" data-array-keys="${esc(JSON.stringify(keys))}"><div class="array-editor-head"><div><label>${esc(prettyFieldName(fieldKey))}</label><span class="field-hint">Add, edit or remove individual entries below.</span></div><button class="ghost-btn" type="button" data-array-add>+ Add entry</button></div><div class="array-records">${records}</div></div>`;
  }
  const objectSectionGroups = {
    site:[['Institution identity',['brand','name','shortName','established','logoImage']],['Contact details',['email','phone','address','website']],['Social media profiles',['linkedin','instagram','youtube','facebook']]],
    navigation:[['Top navigation',['topLinePrefix','topLineBrand','mainAbout','mainPeople','mainProgrammes','mainVentures','mainImpact','exploreLabel','reachOutLabel','reachOutUrl']],['Explore menu',['megaTitle','megaNote','megaLinks','megaFooterLine','megaFooterCta','megaFooterCtaUrl']],['Footer content',['footerBrandLine','footerGroups','copyrightPrefix','copyrightSuffix']]],
    home:[['Homepage hero',['eyebrow','title','description','primaryLabel','primaryUrl','secondaryLabel','secondaryUrl','heroImage']],['EDC ecosystem diagram',['diagramEyebrow','diagramTitle','diagramText','diagramLinkLabel','diagramLinkUrl']],['Impact statistics',['statsTitle','statsDescription','stats']],['EDC ecosystem cards',['ecosystemEyebrow','ecosystemTitle','ecosystemDescription','ecosystemWall','wallFootLabel','wallFootLinkLabel','wallFootLinkUrl']],['Our stakeholders',['stakeholderEyebrow','stakeholderTitle','stakeholderDescription','stakeholders']],['Focus cards',['focusEyebrow','focusTitle','focusDescription','frictionPoints']],['Entrepreneurial pathway',['pathwayEyebrow','pathwayTitle','pathwayDescription','journeyOutputLabel','journeyHint','journeyExitLabel','journey']],['Comparison section',['comparisonEyebrow','comparisonTitle','comparisonDescription','comparisonLeftLabel','comparisonLeftTitle','comparisonLeftImage','comparisonLeftPoints','comparisonRightLabel','comparisonRightTitle','comparisonRightImage','comparisonRightPoints','comparisonLinkLabel','comparisonLinkUrl']],['EDC anthem video',['anthemEyebrow','anthemTitle','anthemDescription','anthemVideoUrl','anthemPoster','anthemPlaceholderTitle','anthemPlaceholderText']],['Featured EDC activity',['featureEyebrow','featureTitle','featureText','featureImage','featureButtonLabel','featureButtonUrl']],['Explore activity cards',['workEyebrow','workTitle','workDescription','workCards']],['EDC articles',['blogEyebrow','blogTitle','blogDescription','blogLinkLabel','blogLinkUrl']],['Leadership messages',['messagesEyebrow','messagesTitle','messagesDescription','messagesLinkLabel','messagesLinkUrl']],['Homepage closing section',['finalTitle','finalText','finalButtonLabel','finalButtonUrl','ctaEyebrow','ctaTitle','ctaText','ctaButtonLabel','ctaButtonUrl']]],
    about:[['Page introduction',['eyebrow','title','description']],['Institutional story',['storyEyebrow','storyTitle','story','storyFootnote','storyImage']],['Mission and vision',['missionLabel','missionTitle','missionImage','mission','visionLabel','visionTitle','visionImage','vision']],['Guiding principles',['principlesEyebrow','principlesTitle','principles']],['Institutional journey',['journeyEyebrow','journeyTitle','journey']]],
    impact:[['Page introduction',['eyebrow','title','description']],['Impact statistics',['stats']],['Impact statement',['statement','statementImage']],['Milestones',['milestonesEyebrow','milestonesTitle','milestones']]],
    contact:[['Page introduction',['eyebrow','title','description']],['Contact information panel',['contactImage','contactPanelEyebrow','contactPanelTitle','contactPanelText','locationLabel','emailDetailLabel','phoneDetailLabel','responseNote','directionsUrl']],['Enquiry form introduction',['formTitle','formIntro','privacyNote','reviewHint']],['Step 1 – Enquiry type',['step1Title','step1Note','enquiryChoices']],['Step 2 – Enquiry goal',['step2Title','step2Note','goals']],['Step 3 – Contact details',['step3Title','step3Note','nameLabel','emailLabel','subjectLabel','messageLabel','namePlaceholder','emailPlaceholder','subjectPlaceholder','messagePlaceholder','continueLabel','submitLabel','backLabel']]],
    teamDirectory:[['People photograph section',['groupPhotoImage','groupPhotoImageAlt','groupPhotoEyebrow','groupPhotoTitle','groupPhotoDescription','groupPhotoPlaceholderText']],['Academic-year overview on the People page',['overviewEyebrow','overviewTitle','overviewDescription','emptyTeamsTitle','emptyTeamsDescription','cardEyebrow','cardButtonLabel','cardFallbackEyebrow','cardFallbackTitle','cardFallbackMeta']],['Shared roster and member-card defaults',['defaultRosterEyebrow','defaultRosterDescription','defaultBackButtonLabel','defaultBackButtonUrl','emptyRosterEyebrow','emptyRosterTitle','emptyRosterDescription','emptyRosterActionText','memberTagLabel','memberMetaFallback','memberPlaceholderLabel','memberLinkedInLabel','memberEmailLabel']],['Invalid or missing academic-year page',['missingTeamEyebrow','missingTeamTitle','missingTeamDescription','missingTeamBackLabel','missingTeamBackUrl']]]
  };
  const objectArrayFields = new Set(['stats','ecosystemWall','stakeholders','frictionPoints','journey','comparisonLeftPoints','comparisonRightPoints','principles','milestones','workCards','megaLinks','footerGroups','enquiryChoices','goals']);
  const objectLongTextFields = new Set(['description','story','mission','vision','responseNote','contactPanelText','groupPhotoDescription','groupPhotoPlaceholderText','overviewDescription','emptyTeamsDescription','defaultRosterDescription','emptyRosterDescription','emptyRosterActionText','missingTeamDescription','pageEndText','heroDescription','cardDescription','rosterDescription','megaNote','megaFooterLine','footerBrandLine','statement','finalText','ctaText','formIntro','privacyNote','reviewHint','step1Note','step2Note','step3Note']);
  function objectFieldMarkup(fieldKey, obj) {
    const value=obj[fieldKey]; const isArray=Array.isArray(value); const isKnownArray=objectArrayFields.has(fieldKey); const isJson=value && typeof value==='object' && !isArray;
    const isPdf=objectPdfFields.has(fieldKey); const isImage=objectImageFields.has(fieldKey);
    const long=objectLongTextFields.has(fieldKey) || (typeof value==='string' && value.length>100);
    if(isArray || isKnownArray) return renderArrayEditor(fieldKey,isArray?value:[]);
    if(isJson) return `<div class="admin-field full"><label for="obj-${fieldKey}">${esc(prettyFieldName(fieldKey))}</label><textarea class="json-editor" id="obj-${fieldKey}" data-object-field="${fieldKey}" data-json="true">${esc(pretty(value))}</textarea><div class="field-hint">Structured content. Keep the JSON format valid when editing this field.</div></div>`;
    if(isImage||isPdf) return uploadFieldMarkup(fieldKey,value,isPdf?'pdf':'image');
    if(fieldKey==='website') return `<div class="admin-field"><label for="obj-${fieldKey}">${esc(prettyFieldName(fieldKey))}</label><input id="obj-${fieldKey}" type="url" value="${esc(value||'')}" readonly aria-readonly="true"><div class="field-hint">Managed automatically from the active Cloudflare Pages domain so canonical URLs remain correct. Other contact and identity fields in this section are editable.</div></div>`;
    if(long) return `<div class="admin-field full"><label for="obj-${fieldKey}">${esc(prettyFieldName(fieldKey))}</label><textarea id="obj-${fieldKey}" data-object-field="${fieldKey}">${esc(value||'')}</textarea></div>`;
    const externalUrl=['website','linkedin','instagram','youtube','facebook','videoUrl','reachOutUrl','megaFooterCtaUrl'].includes(fieldKey);
    const type=externalUrl?'url':fieldKey==='email'?'email':'text';
    const placeholder=externalUrl?'https://…':fieldKey.toLowerCase().includes('url')?'about.html, contact.html or another relative page path':prettyFieldName(fieldKey);
    const optionalActionLabels=new Set(['primaryLabel','secondaryLabel','diagramLinkLabel','wallFootLinkLabel','comparisonLinkLabel','featureButtonLabel','blogLinkLabel','messagesLinkLabel','finalButtonLabel','ctaButtonLabel','reachOutLabel','megaFooterCta']);
    const optionalActionUrls=new Set(['primaryUrl','secondaryUrl','diagramLinkUrl','wallFootLinkUrl','comparisonLinkUrl','featureButtonUrl','blogLinkUrl','messagesLinkUrl','finalButtonUrl','ctaButtonUrl','reachOutUrl','megaFooterCtaUrl']);
    const actionHint=optionalActionLabels.has(fieldKey) ? 'Optional button/link label. Clear this label or its matching destination to hide the action on the website.' : optionalActionUrls.has(fieldKey) ? 'Optional destination. If this URL is blank or invalid, the matching button/link will not be displayed.' : '';
    const regularHint=externalUrl?'Use the full https:// address for an external profile or video.':'Use a relative page path for internal navigation; it will work on localhost and after deployment.';
    return `<div class="admin-field"><label for="obj-${fieldKey}">${esc(prettyFieldName(fieldKey))}</label><input id="obj-${fieldKey}" type="${type}" data-object-field="${fieldKey}" value="${esc(value||'')}" placeholder="${esc(placeholder)}"><div class="field-hint">${actionHint || regularHint}</div></div>`;
  }

  const peopleIntroFields = [
    ['eyebrow','People page hero small label','text'],['title','People page hero heading','text'],
    ['description','People page hero supporting text','textarea'],['number','People page hero index / number','text'],
    ['image','People page hero photograph','image'],['imageAlt','People page hero photograph alternative text','text']
  ];
  const peoplePanelFields = [
    ['eyebrow','People page closing-section small label','text'],['title','People page closing-section heading','text'],
    ['text','People page closing-section supporting text','textarea'],['image','People page closing-section photograph','image'],
    ['imageAlt','People page closing photograph alternative text','text'],['buttonLabel','People page closing button label','text'],
    ['buttonUrl','People page closing button destination','url']
  ];
  const peopleCardFieldKeys = ['order','cardEyebrow','cardTitle','cardDescription','cardImage','cardImageAlt','buttonLabel','cardFallbackEyebrow','cardFallbackTitle','cardFallbackMeta'];
  const teamPageFieldKeys = [
    'title','description','heroEyebrow','heroTitle','heroDescription','heroNumber','heroImage','heroImageAlt','heroArtMode',
    'rosterEyebrow','rosterTitle','rosterDescription','rosterImage','rosterImageAlt','backButtonLabel','backButtonUrl',
    'memberTagLabel','memberLinkedInLabel','memberEmailLabel','emptyRosterEyebrow','emptyRosterTitle','emptyRosterDescription','emptyRosterActionText',
    'pageEndEyebrow','pageEndTitle','pageEndText','pageEndImage','pageEndImageAlt','pageEndButtonLabel','pageEndButtonUrl','pageEndTone'
  ];
  function renderLinkedPageRecord(title, description, collectionKey, pageKey, fields, prefix) {
    const rows = Array.isArray(content?.[collectionKey]) ? content[collectionKey] : [];
    const found = rows.find(item => String(item.page||'').trim() === pageKey) || {};
    const defaults = collectionKey==='pageIntros' && pageKey==='people'
      ? {eyebrow:'People and student teams',title:'The people who contribute to EDC activity.',description:'Meet the people, student teams and collaborators who build the KPRCAS entrepreneurship ecosystem.',number:'02',image:'',imageAlt:'People and student teams at EDCKPRCAS'}
      : collectionKey==='pagePanels' && pageKey==='people'
        ? {eyebrow:'PEOPLE & TEAMS',title:'Meet the student teams',text:'Explore the EDC teams across the academic years and the people who contribute to their work.',image:'',imageAlt:'',buttonLabel:'View team years',buttonUrl:'team.html?year=2026-2027'}
        : {};
    const existing = {...defaults,...found,page:pageKey};
    const rendered = fields.map(field => fieldInput(field, existing?.[field[0]] ?? '', `${prefix}-`)).join('');
    return `<section class="object-section-card"><form data-linked-page-record data-linked-collection="${esc(collectionKey)}" data-linked-page="${esc(pageKey)}" data-linked-fields="${esc(JSON.stringify(fields))}"><div class="object-section-head"><div><h3>${esc(title)}</h3><p>${esc(description)}</p></div><button class="primary-btn" type="submit">Save section ↗</button></div><div class="form-grid">${rendered}</div><div class="save-status" aria-live="polite"></div></form></section>`;
  }
  function resolvedTeamEditorValues(team, index, scope) {
    const directory = {...teamDirectoryDefaults,...(content?.teamDirectory || {})};
    const year = String(team.year || team.yearKey || `Academic year ${index+1}`);
    const fallbackTitle = team.title || `EDC Student Team ${year}`;
    const fallbackDescription = team.description || 'Meet the student members, roles and activities for this academic year.';
    const sharedPanel = (Array.isArray(content?.pagePanels)?content.pagePanels:[]).find(item=>item.page==='people') || {};
    const values = {...team};
    if (scope==='card') {
      values.order = team.order ?? index + 1;
      values.cardEyebrow = team.cardEyebrow || directory.cardEyebrow || 'TEAM';
      values.cardTitle = team.cardTitle || team.title || fallbackTitle;
      values.cardDescription = team.cardDescription || team.description || fallbackDescription;
      values.cardImage = team.cardImage || team.image || '';
      values.cardImageAlt = team.cardImageAlt || `${year} student team photograph`;
      values.buttonLabel = team.buttonLabel === undefined ? (directory.cardButtonLabel || 'VIEW TEAM ROSTER') : String(team.buttonLabel || '');
      values.cardFallbackEyebrow = team.cardFallbackEyebrow || directory.cardFallbackEyebrow || 'EDC STUDENT TEAM';
      values.cardFallbackTitle = team.cardFallbackTitle || team.year || year;
      values.cardFallbackMeta = team.cardFallbackMeta || directory.cardFallbackMeta || 'MEMBERS · ROLES · ACTIVITIES';
      return values;
    }
    values.title = team.title || fallbackTitle;
    values.description = team.description || fallbackDescription;
    values.heroEyebrow = team.heroEyebrow || team.year || year;
    values.heroTitle = team.heroTitle || fallbackTitle;
    values.heroDescription = team.heroDescription || fallbackDescription;
    values.heroNumber = team.heroNumber || '03';
    values.heroImageAlt = team.heroImageAlt || values.heroTitle;
    values.heroArtMode = team.heroArtMode || 'both';
    values.rosterEyebrow = team.rosterEyebrow || directory.defaultRosterEyebrow || 'Individual team members';
    values.rosterTitle = team.rosterTitle || `EDC student team · ${year}`;
    values.rosterDescription = team.rosterDescription || directory.defaultRosterDescription || 'Each card contains one member photograph, name, role and concise profile details.';
    values.rosterImage = team.rosterImage || team.image || '';
    values.rosterImageAlt = team.rosterImageAlt || `${year} EDC student team group photograph`;
    values.backButtonLabel = team.backButtonLabel === undefined ? (directory.defaultBackButtonLabel || 'All academic years') : String(team.backButtonLabel || '');
    values.backButtonUrl = team.backButtonUrl === undefined ? (directory.defaultBackButtonUrl || 'people.html') : String(team.backButtonUrl || '');
    values.memberTagLabel = team.memberTagLabel || directory.memberTagLabel || 'People';
    values.memberLinkedInLabel = team.memberLinkedInLabel || directory.memberLinkedInLabel || 'LinkedIn';
    values.memberEmailLabel = team.memberEmailLabel || directory.memberEmailLabel || 'Email';
    values.emptyRosterEyebrow = team.emptyRosterEyebrow || directory.emptyRosterEyebrow || year;
    values.emptyRosterTitle = team.emptyRosterTitle || directory.emptyRosterTitle || 'Team profiles will appear here.';
    values.emptyRosterDescription = team.emptyRosterDescription || directory.emptyRosterDescription || 'Student profiles for this academic year have not been added yet.';
    values.emptyRosterActionText = team.emptyRosterActionText || directory.emptyRosterActionText || '';
    values.pageEndEyebrow = team.pageEndEyebrow || sharedPanel.eyebrow || 'PEOPLE & TEAMS';
    values.pageEndTitle = team.pageEndTitle || sharedPanel.title || 'Meet the student teams';
    values.pageEndText = team.pageEndText || sharedPanel.text || 'Explore the EDC teams across the academic years and the people who contribute to their work.';
    values.pageEndImage = team.pageEndImage || sharedPanel.image || '';
    values.pageEndImageAlt = team.pageEndImageAlt || sharedPanel.imageAlt || values.pageEndTitle;
    values.pageEndButtonLabel = team.pageEndButtonLabel || sharedPanel.buttonLabel || 'View team years';
    values.pageEndButtonUrl = team.pageEndButtonUrl || sharedPanel.buttonUrl || 'team.html?year=2026-2027';
    values.pageEndTone = team.pageEndTone || 'navy';
    return values;
  }
  function renderTeamSubsection(team, index, title, description, fieldKeys, prefix) {
    const definitions = collections.teams.fields.filter(field => field[2] !== 'section' && fieldKeys.includes(field[0]));
    const scope = prefix.startsWith('people-card-') ? 'card' : 'page';
    const values = resolvedTeamEditorValues(team,index,scope);
    const rendered = definitions.map(field => fieldInput(field, values?.[field[0]] ?? '', `${prefix}-`)).join('');
    const yearKey = String(team.yearKey || team.year || '');
    return `<section class="object-section-card"><form data-team-subsection data-team-year="${esc(yearKey)}" data-team-fields="${esc(JSON.stringify(definitions))}"><div class="object-section-head"><div><h3>${esc(title)}</h3><p>${esc(description)}</p></div><button class="primary-btn" type="submit">Save section ↗</button></div><div class="form-grid">${rendered}</div><div class="save-status" aria-live="polite"></div></form></section>`;
  }
  function renderPeopleTeamExtensions() {
    const teams = Array.isArray(content?.teams) ? content.teams : [];
    const teamCards = teams.length ? teams.map((team,index)=>renderTeamSubsection(
      team,index,`${team.year || team.title || `Academic year ${index+1}`} — People-page card`,
      'Edit this year card only. The other year cards and the individual team page remain unchanged.',
      peopleCardFieldKeys,`people-card-${index}`
    )).join('') : '<div class="notice">No academic-year records exist yet. Add the first year under Publish & Manage → Academic-year teams.</div>';
    const yearPages = teams.length ? teams.map((team,index)=>renderTeamSubsection(
      team,index,`${team.year || team.title || `Academic year ${index+1}`} — individual team page`,
      'Every visible heading, paragraph, image, label, button, empty state and closing-panel field on this year page is editable here.',
      teamPageFieldKeys,`year-page-${index}`
    )).join('') : '';
    return `
      <div class="content-head"><div><h2>People page hero and closing section</h2><p>These fields are stored in the same Page introductions and Page closing panels records, but are also editable here for convenience.</p></div></div>
      ${renderLinkedPageRecord('People page hero','Edit the People page top label, heading, supporting copy, page index and optional hero image.','pageIntros','people',peopleIntroFields,'people-intro')}
      ${renderLinkedPageRecord('People page closing section','Edit the closing section independently, including its image, alternative text and button.','pagePanels','people',peoplePanelFields,'people-panel')}
      <div class="content-head"><div><h2>Three academic-year cards — edit individually</h2><p>Each card has its own image, alternative text, eyebrow, title, description, button, fallback artwork and display order.</p></div></div>
      ${teamCards}
      <div class="content-head"><div><h2>Individual academic-year pages — complete content</h2><p>These controls edit the actual year page, not just its card on the People page. All three years have independent content and images.</p></div></div>
      ${yearPages}
      <section class="object-section-card"><div class="object-section-head"><div><h3>Individual student profiles</h3><p>Names, designations, affiliation, portrait, photo alternative text, biography, badge, email and LinkedIn are edited as individual People records.</p></div><button class="primary-btn" type="button" data-module="people">Manage student profiles ↗</button></div></section>`;
  }

  function renderObject(key) {
    const config = objects[key];
    if (!config || !Array.isArray(config.keys)) {
      console.error('[EDCKPRCAS CMS] Unknown site-content module:', key);
      return `<div class="content-head"><div><h2>Section unavailable</h2><p>This CMS section is not configured. Refresh the Content Manager or contact the site administrator.</p></div></div>`;
    }
    const source = content && typeof content[key] === 'object' && !Array.isArray(content[key]) ? content[key] : {};
    const peopleIntroFallback = (Array.isArray(content?.pageIntros)?content.pageIntros:[]).find(item=>item.page==='people') || {};
    const obj=key==='teamDirectory'
      ? {...teamDirectoryDefaults,...source,groupPhotoImage:source.groupPhotoImage || peopleIntroFallback.image || ''}
      : key==='navigation'
        ? {reachOutLabel:'Reach out',reachOutUrl:'contact.html',...source}
        : source;
    const groups=objectSectionGroups[key] || [['Website content',config.keys]];
    const used=new Set(groups.flatMap(g=>g[1]));
    const extras=config.keys.filter(k=>!used.has(k));
    const all=extras.length?[...groups,['Additional settings',extras]]:groups;
    const forms=all.map(([title,keys],i)=>{
      const actual=keys.filter(fieldKey=>config.keys.includes(fieldKey));
      if(!actual.length)return '';
      const fields=actual.map(fieldKey=>objectFieldMarkup(fieldKey,obj)).join('');
      return `<section class="object-section-card"><form data-object-section="${esc(key)}" data-section-title="${esc(title)}"><div class="object-section-head"><div><h3>${esc(title)}</h3><p>Save this section independently. Other sections remain unchanged.</p></div><button class="primary-btn" type="submit">Save section ↗</button></div><div class="form-grid">${fields}</div><div class="save-status" aria-live="polite"></div></form></section>`;
    }).join('');
    const peopleTeamExtensions = key==='teamDirectory' ? renderPeopleTeamExtensions() : '';
    return `<div class="content-head"><div><h2>${config.title}</h2><p>${config.description}</p></div></div><div class="object-sections">${forms}</div>${peopleTeamExtensions}`;
  }
  function renderInquiries() {
    return `<div class="content-head"><div><h2>Enquiry inbox</h2><p>Messages submitted through the public Reach Us form are stored in the secure online database. Email delivery to edc@kprcas.ac.in is recorded here; failed email attempts remain visible for follow-up.</p></div><button class="ghost-btn" id="refreshInquiries">Refresh inbox ↻</button></div><div class="inquiry-list">${inquiries.length?inquiries.map(item=>`<article class="inquiry-card" data-inquiry="${esc(item.id)}"><div class="inquiry-top"><div><b>${esc(item.name)}</b><div class="small muted">${esc(item.email)} ${item.subject?' · '+esc(item.subject):''}</div></div><span>${new Date(item.receivedAt).toLocaleString()}</span></div><p>${esc(item.message)}</p><div class="inquiry-actions"><select data-inquiry-status="${esc(item.id)}"><option ${item.status==='New'?'selected':''}>New</option><option ${item.status==='In progress'?'selected':''}>In progress</option><option ${item.status==='Resolved'?'selected':''}>Resolved</option></select><a class="ghost-btn" href="mailto:${esc(item.email)}?subject=${encodeURIComponent('Re: '+(item.subject||'Your enquiry'))}">Reply by email ↗</a><span class="small muted">Status: ${esc(item.status)} · Mail: ${item.emailSent?'sent to EDC':'not delivered'}</span>${item.emailError?`<span class="small muted">${esc(item.emailError)}</span>`:''}</div></article>`).join(''):'<div class="empty-state">No enquiries have been received yet.</div>'}</div>`;
  }
  function renderSecurity() {
    return `<div class="content-head"><div><h2>Account security</h2><p>Change the Content Manager password used to sign in to this content management workspace.</p></div></div><div class="security-layout"><section class="form-panel"><form id="passwordForm"><div class="field"><label for="currentPassword">Current password</label><input id="currentPassword" name="currentPassword" type="password" required autocomplete="current-password"></div><div class="field"><label for="newPassword">New password</label><input id="newPassword" name="newPassword" type="password" minlength="10" required autocomplete="new-password"><div class="field-hint">Use at least 10 characters. A passphrase is recommended.</div></div><div class="field"><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" name="confirmPassword" type="password" minlength="10" required autocomplete="new-password"></div><button class="primary-btn" type="submit">Update password ↗</button><div class="save-status" id="formStatus"></div></form></section><div class="notice" style="margin-top:14px"><b>Deployment note:</b> for a public production website, use HTTPS, a protected hosting environment, regular backups and a proper mail or CRM service for enquiries.</div></div>`;
  }
  function renderModule() {
    const title=collections[current]?.title||objects[current]?.title||({dashboard:'Dashboard',inquiries:'Enquiry inbox',security:'Account security'}[current]||'Content Manager');
    $('#topTitle').textContent=title;
    const target=$('#adminContent');
    try {
      if(current==='dashboard') target.innerHTML=renderDashboard();
      else if(collections[current]) target.innerHTML=renderCollection(current);
      else if(objects[current]) target.innerHTML=renderObject(current);
      else if(current==='inquiries') target.innerHTML=renderInquiries();
      else if(current==='security') target.innerHTML=renderSecurity();
      else target.innerHTML=`<div class="content-head"><div><h2>Section not found</h2><p>The selected Content Manager section is not registered.</p></div></div>`;
    } catch(error) {
      console.error('[EDCKPRCAS CMS] Could not render section:', current, error);
      target.innerHTML=`<div class="content-head"><div><h2>${esc(title)} could not be opened</h2><p>The editor encountered an error. Reload this page; if the issue continues, share the browser console error with the site administrator.</p><p class="field-hint">${esc(error?.message || 'Unknown editor error')}</p></div></div>`;
    }
    wireModule();
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(content,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href=url; a.download='edc-kprcas-content-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('Website content backup exported. Keep it in a secure location.');
  }
  async function importBackup(event) {
    const file=event.target.files?.[0]; if(!file)return;
    try {
      const parsed=JSON.parse(await file.text());
      if(!parsed || typeof parsed!=='object' || !parsed.site || typeof parsed.site!=='object') throw new Error('This file does not look like a website content backup.');
      if(!confirm('Import this content backup and replace the current website content? Export a backup first if you may need the current version.')) return;
      content=parsed; await saveData(); renderModule(); showToast('Website content backup imported successfully.');
    } catch(error) { showToast(error.message || 'Unable to import this JSON file.',true); }
    finally { event.target.value=''; }
  }

  async function saveData() {
    const result=await api('/api/admin/data',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(content)});
    return result;
  }
  function wireModule() {
    $$('#adminContent [data-module]').forEach(btn=>btn.addEventListener('click',()=>{current=btn.dataset.module;currentIndex=-1;renderNav();renderModule();}));
    $('#newRecord')?.addEventListener('click',()=>{currentIndex=-1;renderModule();});
    $('#exportData')?.addEventListener('click',exportBackup);
    $('#importData')?.addEventListener('click',()=>$('#importDataInput')?.click());
    $('#importDataInput')?.addEventListener('change',importBackup);
    $$('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>{currentIndex=Number(btn.dataset.edit);renderModule();}));
    $$('[data-delete]').forEach(btn=>btn.addEventListener('click',async()=>{
      const index=Number(btn.dataset.delete); const config=collections[current]; const record=content[config.collection][index];
      if(!confirm(`Delete “${record?.[config.primary]||'this record'}”? This cannot be undone.`)) return;
      content[config.collection].splice(index,1); currentIndex=-1;
      try{await saveData();renderModule();showToast('Record deleted and website content saved.');}catch(e){showToast(e.message,true);}
    }));
    $('#cancelEdit')?.addEventListener('click',()=>{currentIndex=-1;renderModule();});
    $('#recordForm')?.addEventListener('submit',saveRecord);
    if(current==='social') {
      const recordForm=$('#recordForm');
      const fetchSocialPreview=async input=>{
        const value=String(input?.value||'').trim(); if(!value) return;
        const imageTarget=recordForm?.querySelector('[data-field=\"image\"]');
        const imagePreview=recordForm?.querySelector('[data-field=\"image\"]')?.closest('.upload-field')?.querySelector('[data-upload-preview]');
        const status=recordForm?.querySelector('[data-field=\"image\"]')?.closest('.upload-field')?.querySelector('.field-hint');
        if(!imageTarget || !imagePreview) return;
        if(status) status.textContent='Fetching a public thumbnail…';
        try{
          const result=await api('/api/admin/social-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:value})});
          imageTarget.value=result.url; imagePreview.innerHTML=uploadPreview(result.url,'image');
          if(status) status.textContent=`Thumbnail saved locally: ${result.filename}. Save the social post to publish it.`;
          showToast('Social thumbnail fetched and stored in uploads.');
        }catch(error){if(status)status.textContent='This platform did not expose a public thumbnail. Choose an image file manually.';showToast(error.message,true);}
      };
      recordForm?.querySelectorAll('[data-field=\"link\"],[data-field=\"videoUrl\"]').forEach(input=>{
        input.addEventListener('change',()=>fetchSocialPreview(input));
      });
    }
    $$('form[data-linked-page-record]').forEach(form=>form.addEventListener('submit',saveLinkedPageRecord));
    $$('form[data-team-subsection]').forEach(form=>form.addEventListener('submit',saveTeamSubsection));
    $$('form[data-object-section]').forEach(form=>{ form.addEventListener('submit',saveObject); form.addEventListener('click',event=>{
      const add=event.target.closest('[data-array-add]');
      const remove=event.target.closest('[data-array-remove]');
      if(remove){
        const row=remove.closest('.array-record'); const parent=row?.parentElement;
        if(row) row.remove();
        if(parent&&!parent.querySelector('.array-record')){
          const editor=parent.closest('[data-array-editor]');
          const keys=JSON.parse(editor?.dataset.arrayKeys||'[]');
          parent.innerHTML=renderArrayRow(keys,{},0,editor?.dataset.arrayEditor||'');
        }
        return;
      }
      if(add){
        const editor=add.closest('[data-array-editor]'); const holder=editor?.querySelector('.array-records');
        if(!holder) return;
        const keys=JSON.parse(editor.dataset.arrayKeys||'[]');
        holder.insertAdjacentHTML('beforeend',renderArrayRow(keys,{},holder.querySelectorAll('.array-record').length,editor.dataset.arrayEditor||''));
      }
    }); });
    const adminRoot=$('#adminContent'); if(adminRoot) adminRoot.onchange=event=>{ const input=event.target.closest('[data-upload-for]'); if(input) uploadFile(input); };
    $('#refreshInquiries')?.addEventListener('click',async()=>{try{inquiries=await api('/api/admin/inquiries');renderModule();showToast('Enquiry inbox refreshed.');}catch(e){showToast(e.message,true);}});
    $$('[data-inquiry-status]').forEach(select=>select.addEventListener('change',async()=>{
      try{await api('/api/admin/inquiries/'+encodeURIComponent(select.dataset.inquiryStatus),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value})});const item=inquiries.find(x=>x.id===select.dataset.inquiryStatus);if(item)item.status=select.value;showToast('Enquiry status updated.');}catch(e){showToast(e.message,true);}
    }));
    $('#passwordForm')?.addEventListener('submit',changePassword);
  }
  async function saveRecord(e) {
    e.preventDefault();
    const config=collections[current];
    const form=e.currentTarget;
    const collectionKey=config.collection;
    const rows=Array.isArray(content[collectionKey])?content[collectionKey]:[];
    const beforeRows=rows.map(item=>({...item}));
    const originalIndex=currentIndex;
    const existing=originalIndex>=0?(rows[originalIndex]||{}):{};
    // Preserve fields written by previous CMS versions or future modules.
    const record={...existing};

    for(const field of config.fields){
      const [key,,type]=field;
      if(type==='section') continue;
      const input=form.querySelector(`[data-field="${key}"]`);
      let value=input?.value??'';
      if(type==='pages') value=value.split(/\n\s*===PAGE===\s*\n/g).map(x=>x.trim()).filter(Boolean);
      if(type==='number') value=String(value).trim()===''?'':Number(value);
      if(current==='blogs' && key==='publishAt' && value){
        const publicationDate=new Date(value);
        if(Number.isNaN(publicationDate.getTime())){showToast('Choose a valid publication date and time.',true);input?.focus();return;}
        value=publicationDate.toISOString();
      }
      if(current==='blogs' && key==='status' && String(value).toLowerCase()==='scheduled' && !form.querySelector('[data-field="publishAt"]')?.value){showToast('Choose a publication date and time for a scheduled article.',true);form.querySelector('[data-field="publishAt"]')?.focus();return;}
      record[key]=typeof value==='string'?value.trim():value;
    }

    // A single page-intro / closing-panel record per page keeps public lookup deterministic.
    if(current==='pageIntros' || current==='pagePanels'){
      const pageValue=String(record.page||'').trim();
      const duplicateIndex=rows.findIndex((item,index)=>index!==originalIndex && String(item.page||'').trim()===pageValue);
      if(duplicateIndex>=0){
        showToast(`A ${current==='pageIntros'?'page introduction':'closing panel'} for “${pageValue}” already exists. Select that record and edit it instead of creating a duplicate.`,true);
        return;
      }
    }

    // Prevent two team records from sharing the same route key.
    if(current==='teams'){
      const normalizeYear=value=>String(value||'').replace(/[^0-9]/g,'');
      const nextKey=normalizeYear(record.yearKey||record.year);
      const duplicateIndex=rows.findIndex((item,index)=>index!==originalIndex && normalizeYear(item.yearKey||item.year)===nextKey);
      if(!nextKey || nextKey.length!==8){showToast('Enter a valid academic year and URL year key, such as 2024-2025.',true);form.querySelector('[data-field="yearKey"]')?.focus();return;}
      if(duplicateIndex>=0){showToast('A team page already exists for this academic year. Edit the existing record instead.',true);return;}
    }

    if(config.fields.some(field=>field[0]==='order') && record.order!=='' && record.order!==null && record.order!==undefined && (!Number.isInteger(Number(record.order)) || Number(record.order)<1)){showToast('Display order must be a whole number greater than zero (1, 2, 3…).',true);form.querySelector('[data-field="order"]')?.focus();return;}
    record.id=existing.id || `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
    const nextRows=[...rows];
    if(originalIndex>=0) nextRows[originalIndex]=record;
    else nextRows.unshift(record);
    content[collectionKey]=nextRows;
    currentIndex=originalIndex>=0?originalIndex:0;

    const save=$('#saveRecord');
    if(save){save.disabled=true;save.textContent='Saving…';}
    try{
      await saveData();
      renderModule();
      showToast(`${config.singular[0].toUpperCase()+config.singular.slice(1)} saved successfully.`);
    }catch(error){
      content[collectionKey]=beforeRows;
      currentIndex=originalIndex;
      renderModule();
      showToast(error.message,true);
    }
  }
  async function saveObject(e) {
    e.preventDefault();
    const form=e.currentTarget; const objectKey=form.dataset.objectSection;
    const previousObject={...(content[objectKey]||{})};
    const updated=objectKey==='teamDirectory'?{...teamDirectoryDefaults,...previousObject}:{...previousObject};
    const button=form.querySelector('button[type="submit"]'); const status=$('.save-status',form); const original=button?.textContent||'Save section ↗';
    try{
      $$('[data-object-field]',form).forEach(input=>{
        const key=input.dataset.objectField;
        if(input.dataset.json==='true') updated[key]=JSON.parse(input.value);
        else updated[key]=input.value.trim();
      });
      $$('[data-array-editor]',form).forEach(editor=>{
        const key=editor.dataset.arrayEditor;
        updated[key]=[...editor.querySelectorAll('.array-record')].map(row=>{
          const item={}; row.querySelectorAll('[data-array-key]').forEach(control=>{item[control.dataset.arrayKey]=control.value.trim();});
          return item;
        }).filter(item=>Object.values(item).some(value=>value!==''));
      });
      content[objectKey]=updated; if(button){button.disabled=true;button.textContent='Saving…';}
      await saveData(); if(status)status.textContent=`${form.dataset.sectionTitle} saved successfully.`;
      showToast(`${form.dataset.sectionTitle} saved successfully.`);
    }catch(error){
      content[objectKey]=previousObject;
      showToast(error instanceof SyntaxError?'One of the JSON fields is not valid. Please correct the JSON and save again.':error.message,true);
      if(status)status.textContent=error.message;
    }finally{if(button){button.disabled=false;button.textContent=original;}}
  }

  async function saveLinkedPageRecord(e) {
    e.preventDefault();
    const form=e.currentTarget;
    const collectionKey=form.dataset.linkedCollection;
    const pageKey=form.dataset.linkedPage;
    const definitions=JSON.parse(form.dataset.linkedFields||'[]');
    const previous=Array.isArray(content[collectionKey])?content[collectionKey]:[];
    const backup=previous.map(item=>({...item}));
    const index=previous.findIndex(item=>String(item.page||'').trim()===pageKey);
    const existing=index>=0?previous[index]:{};
    const updated={...existing,page:pageKey,id:existing.id||`item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`};
    for(const field of definitions){
      const [key,,type]=field;
      const input=form.querySelector(`[data-field="${key}"]`);
      let value=input?.value??'';
      if(type==='number') value=String(value).trim()===''?'':Number(value);
      else value=String(value).trim();
      updated[key]=value;
    }
    const next=[...previous];
    if(index>=0) next[index]=updated; else next.unshift(updated);
    content[collectionKey]=next;
    const button=form.querySelector('button[type="submit"]');
    const status=form.querySelector('.save-status');
    const original=button?.textContent||'Save section ↗';
    try{
      if(button){button.disabled=true;button.textContent='Saving…';}
      await saveData();
      if(status)status.textContent='People page section saved successfully.';
      showToast('People page section saved successfully.');
    }catch(error){
      content[collectionKey]=backup;
      if(status)status.textContent=error.message;
      showToast(error.message,true);
    }finally{if(button){button.disabled=false;button.textContent=original;}}
  }
  async function saveTeamSubsection(e) {
    e.preventDefault();
    const form=e.currentTarget;
    const key=String(form.dataset.teamYear||'').replace(/[^0-9]/g,'');
    const rows=Array.isArray(content.teams)?content.teams:[];
    const index=rows.findIndex(team=>String(team.yearKey||team.year||'').replace(/[^0-9]/g,'')===key);
    if(index<0){showToast('This academic-year record no longer exists. Refresh the Content Manager and try again.',true);return;}
    const backup=rows.map(item=>({...item}));
    const updated={...rows[index]};
    const definitions=JSON.parse(form.dataset.teamFields||'[]');
    for(const field of definitions){
      const [fieldKey,,type]=field;
      const input=form.querySelector(`[data-field="${fieldKey}"]`);
      let value=input?.value??'';
      if(type==='number') value=String(value).trim()===''?'':Number(value);
      else value=String(value).trim();
      updated[fieldKey]=value;
    }
    content.teams=[...rows];
    content.teams[index]=updated;
    const button=form.querySelector('button[type="submit"]');
    const status=form.querySelector('.save-status');
    const original=button?.textContent||'Save section ↗';
    try{
      if(button){button.disabled=true;button.textContent='Saving…';}
      await saveData();
      if(status)status.textContent=`${updated.year || 'Academic-year'} section saved successfully.`;
      showToast(`${updated.year || 'Academic-year'} section saved successfully.`);
    }catch(error){
      content.teams=backup;
      if(status)status.textContent=error.message;
      showToast(error.message,true);
    }finally{if(button){button.disabled=false;button.textContent=original;}}
  }

  async function uploadFile(input) {
    const file=input.files?.[0]; if(!file)return;
    if(file.size>12*1024*1024){showToast('The file is larger than 12 MB.',true);input.value='';return;}
    const isPdf=file.type==='application/pdf';
    if(!isPdf && !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){showToast('Choose a JPG, PNG, WEBP, GIF or PDF file.',true);input.value='';return;}
    const key=input.dataset.uploadForArray || input.dataset.uploadFor;
    const row=input.closest('.array-record');
    const form=input.closest('form');
    const target=input.dataset.uploadForArray
      ? row?.querySelector(`[data-array-key="${key}"]`)
      : form?.querySelector(`[data-field="${key}"], [data-object-field="${key}"]`);
    if(!target){showToast('The upload field could not be located. Save the page and try again.',true);return;}
    const line=input.closest('.upload-field'); const status=$('.field-hint',line); const preview=$('[data-upload-preview]',line);
    const original=status?.textContent||''; if(status)status.textContent='Uploading file…';
    try{
      const result=await api('/api/admin/upload?filename='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':file.type},body:file});
      target.value=result.url;
      if(preview)preview.innerHTML=isPdf?uploadPreview(result.url,'pdf'):uploadPreview(result.url,'image');
      if(status)status.textContent=`Uploaded: ${result.filename}. Save this section or record to publish it.`;
      showToast('File uploaded. Save this section to publish the change.');
    }catch(error){if(status)status.textContent=original;showToast(error.message,true);}
    finally{input.value='';}
  }
  async function changePassword(e) {
    e.preventDefault();const fd=new FormData(e.currentTarget);const currentPassword=String(fd.get('currentPassword')||'');const newPassword=String(fd.get('newPassword')||'');const confirm=String(fd.get('confirmPassword')||'');
    if(newPassword!==confirm){showToast('The new passwords do not match.',true);return;}
    const button=e.currentTarget.querySelector('button');button.disabled=true;
    try{await api('/api/admin/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});e.currentTarget.reset();showToast('Content Manager password updated.');}
    catch(error){showToast(error.message,true);}finally{button.disabled=false;}
  }

  async function init() {
    try {
      const status=await api('/api/auth/status');
      if(status.authenticated){const record=await api('/api/admin/data');content=record;inquiries=await api('/api/admin/inquiries');const auth=await api('/api/admin/whoami').catch(()=>null);if(auth?.username)username=auth.username;renderShell();renderModule();}
      else showLogin(status.setupRequired);
    } catch(error) { showLogin(true,error.message); }
  }
  init();
})();
