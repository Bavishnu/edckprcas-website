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
    people:{title:'People', singular:'profile', collection:'people', primary:'name', secondary:'role', fields:[['name','Full name','text'],['role','Designation / role','text'],['team','Team / department','text'],['teamYear','Academic year (2024-2025, 2025-2026 or 2026-2027)','text'],['bio','Biography','textarea'],['image','Profile image','image'],['linkedin','LinkedIn URL','url'],['email','Email address','email']]},
    events:{title:'Events',singular:'event',collection:'events',primary:'title',secondary:'date',fields:[['title','Event title','text'],['date','Event date','date'],['category','Category','text'],['status','Status','text'],['location','Venue / location','text'],['summary','Description','textarea'],['image','Event image','image'],['link','Registration / event URL','url']]},
    startups:{title:'Startups',singular:'startup',collection:'startups',primary:'name',secondary:'sector',fields:[['name','Venture name','text'],['sector','Sector','text'],['stage','Stage / status','text'],['founders','Founder names','text'],['year','Year','text'],['summary','Venture overview','textarea'],['image','Venture image','image'],['website','Website URL','url']]},
    messages:{title:'Messages from heads',singular:'message',collection:'messages',primary:'name',secondary:'designation',fields:[['name','Name','text'],['designation','Designation','text'],['heading','Message heading','text'],['quote','Message / quote','textarea'],['image','Portrait image','image'],['order','Display order','text']]},
    gallery:{title:'Gallery',singular:'photo',collection:'gallery',primary:'title',secondary:'category',fields:[['title','Photo title','text'],['category','Category','text'],['date','Year / date','text'],['caption','Caption','textarea'],['image','Photo image','image']]},
    blogs:{title:'Blogs',singular:'blog article',collection:'blogs',primary:'title',secondary:'author',fields:[['title','Article title','text'],['category','Category','text'],['author','Author','text'],['date','Display date','date'],['status','Publication status','select',['Draft','Scheduled','Published']],['publishAt','Schedule publish date and time','datetime-local'],['readTime','Reading time','text'],['excerpt','Short summary','textarea'],['image','Cover image','image'],['body','Article body','textarea']]},
    social:{title:'Social media',singular:'social post',collection:'social',primary:'platform',secondary:'date',fields:[['platform','Platform','text'],['date','Post date','date'],['caption','Post caption','textarea'],['image','Post image / thumbnail (upload file)','image'],['videoUrl','Video URL (YouTube or public video post)','url'],['link','Original post URL','url']]},
    mentors:{title:'Mentors',singular:'mentor',collection:'mentors',primary:'name',secondary:'expertise',fields:[['name','Mentor name','text'],['expertise','Area of expertise','text'],['organization','Organisation','text'],['bio','Biography','textarea'],['image','Portrait image','image'],['linkedin','LinkedIn URL','url']]},
    reports:{title:'Annual reports',singular:'annual report',collection:'reports',primary:'title',secondary:'year',fields:[['title','Report title','text'],['year','Report year','text'],['summary','Report summary','textarea'],['cover','Cover image','image'],['pdfUrl','Annual report PDF (upload file)','pdf'],['pages','Flipbook preview pages','pages']]},
    opportunities:{title:'Opportunities',singular:'opportunity',collection:'opportunities',primary:'title',secondary:'type',fields:[['title','Opportunity title','text'],['type','Opportunity type','text'],['deadline','Deadline / timeline','text'],['status','Status','text'],['summary','Description','textarea'],['eligibility','Who can participate','textarea'],['image','Opportunity image','image'],['link','Application / information URL','url']]},
    achievements:{title:'Achievements',singular:'achievement',collection:'achievements',primary:'title',secondary:'year',fields:[['title','Achievement title','text'],['year','Year','text'],['category','Category / competition','text'],['distinction','Position / recognition','text'],['description','Achievement description','textarea'],['image','Achievement photograph','image']]},
    pageIntros:{title:'Page introductions',singular:'page introduction',collection:'pageIntros',primary:'title',secondary:'page',fields:[['page','Page key (about, people, events, startups, impact, messages, gallery, blogs, social, mentors, reports, contact, opportunities, achievements)','text'],['eyebrow','Small label','text'],['title','Page heading','text'],['description','Supporting paragraph','textarea'],['number','Page number','text'],['image','Page introduction image','image']]},
    pagePanels:{title:'Page closing panels',singular:'page panel',collection:'pagePanels',primary:'title',secondary:'page',fields:[['page','Page key (about, people, events, startups, impact, messages, gallery, blogs, social-media, mentors, annual-reports, contact, opportunities, achievements)','text'],['eyebrow','Small label','text'],['title','Heading','text'],['text','Supporting paragraph','textarea'],['image','Image','image'],['buttonLabel','Button label (leave blank to hide)','text'],['buttonUrl','Button destination (must lead to a different page)','text']]},
    teams:{title:'Academic-year teams',singular:'team year',collection:'teams',primary:'title',secondary:'year',fields:[['year','Academic year','text'],['yearKey','URL year key (e.g. 2024-2025)','text'],['title','Team page title','text'],['description','Team year description','textarea'],['image','Team photograph','image']]}
  };
  const objects = {
    site:{title:'Site identity',description:'Update the EDC name, official logo, establishment year, contact details and social links.',keys:['brand','name','shortName','established','logoImage','email','phone','address','website','linkedin','instagram','youtube','facebook']},
    navigation:{title:'Navigation & footer copy',description:'Edit the centred establishment strip, main navigation, mega-menu links, footer columns and small navigation labels shown throughout the website.',keys:['topLinePrefix','topLineBrand','mainAbout','mainPeople','mainProgrammes','mainVentures','mainImpact','mainSocial','mainGallery','exploreLabel','reachOutLabel','megaTitle','megaNote','megaLinks','megaFooterLine','megaFooterCta','footerBrandLine','footerGroups','copyrightPrefix','copyrightSuffix']},
    home:{title:'Home page',description:'Edit homepage headings, supporting copy, every image slot, the anthem video, ecosystem tiles, focus cards, six practical steps, comparison content, activity cards, blog and leadership labels, page CTA and small interface labels.',keys:['eyebrow','title','description','primaryLabel','primaryUrl','secondaryLabel','secondaryUrl','heroImage','diagramEyebrow','diagramTitle','diagramText','diagramLinkLabel','diagramLinkUrl','statsTitle','statsDescription','stats','ecosystemEyebrow','ecosystemTitle','ecosystemDescription','ecosystemWall','stakeholderEyebrow','stakeholderTitle','stakeholderDescription','stakeholders','wallFootLabel','wallFootLinkLabel','wallFootLinkUrl','focusEyebrow','focusTitle','focusDescription','frictionPoints','pathwayEyebrow','pathwayTitle','pathwayDescription','journeyOutputLabel','journeyHint','journeyExitLabel','journey','comparisonEyebrow','comparisonTitle','comparisonDescription','comparisonLeftLabel','comparisonLeftTitle','comparisonLeftImage','comparisonLeftPoints','comparisonRightLabel','comparisonRightTitle','comparisonRightImage','comparisonRightPoints','comparisonLinkLabel','comparisonLinkUrl','anthemEyebrow','anthemTitle','anthemDescription','anthemVideoUrl','anthemPoster','anthemPlaceholderTitle','anthemPlaceholderText','featureEyebrow','featureTitle','featureText','featureImage','featureButtonLabel','featureButtonUrl','workEyebrow','workTitle','workDescription','workCards','blogEyebrow','blogTitle','blogDescription','blogLinkLabel','blogLinkUrl','messagesEyebrow','messagesTitle','messagesDescription','messagesLinkLabel','messagesLinkUrl','finalTitle','finalText','finalButtonLabel','finalButtonUrl','ctaEyebrow','ctaTitle','ctaText','ctaButtonLabel','ctaButtonUrl']},
    about:{title:'About page',description:'Edit the story, mission, vision, section labels, image holders, principles and institutional journey.',keys:['eyebrow','title','description','storyEyebrow','storyTitle','story','storyFootnote','storyImage','missionLabel','missionTitle','missionImage','mission','visionLabel','visionTitle','visionImage','vision','principlesEyebrow','principlesTitle','principles','journeyEyebrow','journeyTitle','journey']},
    impact:{title:'Impact page',description:'Maintain impact numbers, explanatory copy, section headings, supporting image and milestone records. Keep figures current and verifiable.',keys:['eyebrow','title','description','stats','statement','statementImage','milestonesEyebrow','milestonesTitle','milestones']},
    contact:{title:'Contact page',description:'Edit the contact image, contact panel, every enquiry step, field label, placeholder, privacy note, enquiry categories and goals.',keys:['eyebrow','title','description','contactImage','contactPanelEyebrow','contactPanelTitle','contactPanelText','formTitle','formIntro','step1Title','step1Note','step2Title','step2Note','step3Title','step3Note','nameLabel','emailLabel','subjectLabel','messageLabel','namePlaceholder','emailPlaceholder','subjectPlaceholder','messagePlaceholder','continueLabel','submitLabel','backLabel','privacyNote','reviewHint','locationLabel','emailDetailLabel','phoneDetailLabel','responseNote','directionsUrl','enquiryChoices','goals']}
  };
  const moduleOrder = [
    {label:'OVERVIEW',items:[['dashboard','Dashboard','⌂']]},
    {label:'SITE CONTENT',items:[['site','Site identity','S'],['navigation','Navigation & footer','N'],['home','Home page','H'],['about','About page','A'],['impact','Impact page','I'],['contact','Contact page','C']]},
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
    const full = ['bio','summary','quote','caption','excerpt','body','eligibility','pages','mission','vision','story','description','introText','featureText','statement','responseNote','text'].includes(key) || type==='textarea' || type==='pages';
    if (type==='pages') return `<div class="admin-field full"><label for="${name}">${label}</label><textarea id="${name}" data-field="${key}" data-type="pages" placeholder="Separate each flipbook page using a line with ===PAGE===">${esc(Array.isArray(value)?value.join('\n\n===PAGE===\n\n'):value||'')}</textarea><div class="field-hint">Use ===PAGE=== on a separate line to split pages in the digital report reader.</div></div>`;
    if (type==='image' || type==='pdf') return uploadFieldMarkup(key,value,type);
    if (type==='select') { const options=field[3]||[]; return `<div class="admin-field"><label for="${name}">${label}</label><select id="${name}" data-field="${key}">${options.map(option=>`<option value="${esc(option)}" ${String(value||'')===String(option)?'selected':''}>${esc(option)}</option>`).join('')}</select></div>`; }
    const tag = full ? 'textarea' : 'input'; const inputType = type==='date'?'date':type==='datetime-local'?'datetime-local':type==='url'?'url':type==='email'?'email':'text';
    if(tag==='textarea') return `<div class="admin-field full"><label for="${name}">${label}</label><textarea id="${name}" data-field="${key}" placeholder="${esc(label)}">${esc(value||'')}</textarea></div>`;
    const hint = type==='datetime-local' ? '<div class="field-hint">Use your local time. A Scheduled article remains private until this date and time; the website publishes it automatically when the time arrives.</div>' : '';
    const socialHint = current==='social' && (key==='link' || key==='videoUrl') ? '<div class="field-hint">Paste a public post or video URL. The Content Manager will try to fetch and save its thumbnail automatically. Some platforms restrict previews; upload an image manually if the platform blocks access.</div>' : '';
    let valueForInput = value || '';
    if (type==='datetime-local' && value) {
      const dateValue = new Date(value);
      if (!Number.isNaN(dateValue.getTime())) {
        const localDate = new Date(dateValue.getTime() - dateValue.getTimezoneOffset()*60000);
        valueForInput = localDate.toISOString().slice(0,16);
      } else valueForInput = String(value).slice(0,16);
    }
    return `<div class="admin-field"><label for="${name}">${label}</label><input id="${name}" data-field="${key}" type="${inputType}" value="${esc(valueForInput)}" placeholder="${esc(label)}">${hint}${socialHint}</div>`;
  }
  function renderCollection(key) {
    const config=collections[key]; const rows=content[config.collection]||[]; const selected=currentIndex>=0?rows[currentIndex]:null;
    const fields=config.fields.map(f=>fieldInput(f, f[0]==='status' ? (selected ? (selected.status||'Published') : 'Draft') : (selected?.[f[0]]||''))).join('');
    return `<div class="content-head"><div><h2>${config.title}</h2><p>Add, edit or remove records that appear on the public ${config.title.toLowerCase()} page.</p></div><button class="primary-btn" id="newRecord">+ Add ${config.singular}</button></div>
      <div class="editor-layout"><section class="list-panel"><div class="list-header"><h3>${rows.length} ${config.title.toLowerCase()}</h3><span class="small muted">Select to edit</span></div><div class="record-list">${rows.length?rows.map((row,i)=>`<div class="record-row ${i===currentIndex?'selected':''}"><div class="record-name"><b>${esc(row[config.primary]||'Untitled')}</b><span>${esc(row[config.secondary]||'No secondary detail')}</span></div><div class="record-actions"><button type="button" data-edit="${i}">Edit</button><button type="button" data-delete="${i}">×</button></div></div>`).join(''):'<div class="empty-state">No records yet. Use “Add” to create the first one.</div>'}</div></section>
      <section class="form-panel"><h3>${selected?'Edit':'Create'} ${config.singular}</h3><p>Fields marked by their purpose are shown on the public website. Leave optional fields blank when they do not apply.${current==='blogs'?' Set status to Scheduled and choose a date/time to publish automatically. Draft articles stay private.':''}</p><form id="recordForm"><div class="form-grid">${fields}</div><div class="form-actions"><button class="danger-btn" type="button" id="cancelEdit">Cancel</button><div class="form-actions-right"><button class="primary-btn" id="saveRecord" type="submit">Save ${config.singular} ↗</button></div></div><div class="save-status" id="formStatus"></div></form></section></div>`;
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
      footerBrandLine:'Footer institutional description', megaNote:'Mega-menu description', megaTitle:'Mega-menu heading',
      journeyHint:'Journey scroll instruction', journeyExitLabel:'Journey exit button label', journeyOutputLabel:'Journey output label', stakeholderEyebrow:'Stakeholders section label', stakeholderTitle:'Stakeholders heading', stakeholderDescription:'Stakeholders supporting text', stakeholders:'Stakeholder logos', topLineBrand:'Top strip brand label'
    };
    return labels[key] || String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
  }
  function renderArrayRow(keys, values={}, index=0) {
    const fields = keys.map(key => {
      const value = values?.[key] ?? '';
      const isImage = /image|photo|cover|poster|logo|thumbnail/i.test(key);
      const isPdf = /pdf|document|file/i.test(key) && !isImage;
      const control = isImage || isPdf
        ? uploadFieldMarkup(key,value,isPdf?'pdf':'image','array-')
        : arrayLongKeys.has(key.toLowerCase())
          ? `<textarea data-array-key="${esc(key)}" placeholder="${esc(prettyFieldName(key))}">${esc(value)}</textarea>`
          : `<input data-array-key="${esc(key)}" type="text" value="${esc(value)}" placeholder="${esc(prettyFieldName(key))}">`;
      return `<div class="admin-field ${arrayLongKeys.has(key.toLowerCase())||isImage||isPdf?'full':''}">${isImage||isPdf?'':`<label>${esc(prettyFieldName(key))}</label>`}${control}</div>`;
    }).join('');
    return `<div class="array-record"><div class="array-record-head"><b>Entry ${index+1}</b><button type="button" class="danger-btn" data-array-remove>Remove entry</button></div><div class="form-grid">${fields}</div></div>`;
  }
  function renderArrayEditor(fieldKey, value) {
    const rows = Array.isArray(value) ? value : [];
    const defaults = {
      stats:['value','label'], ecosystemWall:['label','sub','mark','image'], stakeholders:['name','logo'], frictionPoints:['title','text','symbol','image'],
      journey:['phase','title','text','output','image'], principles:['title','text','image'], milestones:['year','title','text','image'], workCards:['number','eyebrow','category','title','text','buttonLabel','url','image'],
      comparisonLeftPoints:['text'], comparisonRightPoints:['text'], enquiryChoices:['label','description'], goals:['label','description']
    };
    const keys = Object.keys(rows[0] || {}).length ? Object.keys(rows[0]) : (defaults[fieldKey] || ['title','text']);
    const records = rows.map((row,i)=>renderArrayRow(keys,row,i)).join('') || renderArrayRow(keys,{},0);
    return `<div class="admin-field full array-editor" data-array-editor="${esc(fieldKey)}" data-array-keys="${esc(JSON.stringify(keys))}"><div class="array-editor-head"><div><label>${esc(prettyFieldName(fieldKey))}</label><span class="field-hint">Add, edit or remove individual entries below.</span></div><button class="ghost-btn" type="button" data-array-add>+ Add entry</button></div><div class="array-records">${records}</div></div>`;
  }
  const objectSectionGroups = {
    site:[['Institution identity',['brand','name','shortName','established','logoImage']],['Contact details',['email','phone','address','website']],['Social media profiles',['linkedin','instagram','youtube','facebook']]],
    navigation:[['Top navigation',['topLinePrefix','topLineBrand','mainAbout','mainPeople','mainProgrammes','mainVentures','mainImpact','exploreLabel','reachOutLabel']],['Explore menu',['megaTitle','megaNote','megaLinks','megaFooterLine','megaFooterCta']],['Footer content',['footerBrandLine','footerGroups','copyrightPrefix','copyrightSuffix']]],
    home:[['Homepage hero',['eyebrow','title','description','primaryLabel','primaryUrl','secondaryLabel','secondaryUrl','heroImage']],['EDC ecosystem diagram',['diagramEyebrow','diagramTitle','diagramText','diagramLinkLabel','diagramLinkUrl']],['Impact statistics',['statsTitle','statsDescription','stats']],['EDC ecosystem cards',['ecosystemEyebrow','ecosystemTitle','ecosystemDescription','ecosystemWall','wallFootLabel','wallFootLinkLabel','wallFootLinkUrl']],['Our stakeholders',['stakeholderEyebrow','stakeholderTitle','stakeholderDescription','stakeholders']],['Focus cards',['focusEyebrow','focusTitle','focusDescription','frictionPoints']],['Entrepreneurial pathway',['pathwayEyebrow','pathwayTitle','pathwayDescription','journeyOutputLabel','journeyHint','journeyExitLabel','journey']],['Comparison section',['comparisonEyebrow','comparisonTitle','comparisonDescription','comparisonLeftLabel','comparisonLeftTitle','comparisonLeftImage','comparisonLeftPoints','comparisonRightLabel','comparisonRightTitle','comparisonRightImage','comparisonRightPoints','comparisonLinkLabel','comparisonLinkUrl']],['EDC anthem video',['anthemEyebrow','anthemTitle','anthemDescription','anthemVideoUrl','anthemPoster','anthemPlaceholderTitle','anthemPlaceholderText']],['Featured EDC activity',['featureEyebrow','featureTitle','featureText','featureImage','featureButtonLabel','featureButtonUrl']],['Explore activity cards',['workEyebrow','workTitle','workDescription','workCards']],['EDC articles',['blogEyebrow','blogTitle','blogDescription','blogLinkLabel','blogLinkUrl']],['Leadership messages',['messagesEyebrow','messagesTitle','messagesDescription','messagesLinkLabel','messagesLinkUrl']],['Homepage closing section',['finalTitle','finalText','finalButtonLabel','finalButtonUrl','ctaEyebrow','ctaTitle','ctaText','ctaButtonLabel','ctaButtonUrl']]],
    about:[['Page introduction',['eyebrow','title','description']],['Institutional story',['storyEyebrow','storyTitle','story','storyFootnote','storyImage']],['Mission and vision',['missionLabel','missionTitle','missionImage','mission','visionLabel','visionTitle','visionImage','vision']],['Guiding principles',['principlesEyebrow','principlesTitle','principles']],['Institutional journey',['journeyEyebrow','journeyTitle','journey']]],
    impact:[['Page introduction',['eyebrow','title','description']],['Impact statistics',['stats']],['Impact statement',['statement','statementImage']],['Milestones',['milestonesEyebrow','milestonesTitle','milestones']]],
    contact:[['Page introduction',['eyebrow','title','description']],['Contact information panel',['contactImage','contactPanelEyebrow','contactPanelTitle','contactPanelText','locationLabel','emailDetailLabel','phoneDetailLabel','responseNote','directionsUrl']],['Enquiry form introduction',['formTitle','formIntro','privacyNote','reviewHint']],['Step 1 – Enquiry type',['step1Title','step1Note','enquiryChoices']],['Step 2 – Enquiry goal',['step2Title','step2Note','goals']],['Step 3 – Contact details',['step3Title','step3Note','nameLabel','emailLabel','subjectLabel','messageLabel','namePlaceholder','emailPlaceholder','subjectPlaceholder','messagePlaceholder','continueLabel','submitLabel','backLabel']]]
  };
  function objectFieldMarkup(fieldKey, obj) {
    const value=obj[fieldKey]; const isArray=Array.isArray(value); const isJson=value && typeof value==='object' && !isArray;
    const isPdf=/pdf|document/i.test(fieldKey); const isImage=/image|poster|photo|cover|logo/i.test(fieldKey);
    const long=typeof value==='string' && (value.length>100 || ['description','story','mission','vision','responseNote','contactPanelText'].includes(fieldKey));
    if(isArray) return renderArrayEditor(fieldKey,value);
    if(isJson) return `<div class="admin-field full"><label for="obj-${fieldKey}">${esc(prettyFieldName(fieldKey))}</label><textarea class="json-editor" id="obj-${fieldKey}" data-object-field="${fieldKey}" data-json="true">${esc(pretty(value))}</textarea><div class="field-hint">Structured content. Keep the JSON format valid when editing this field.</div></div>`;
    if(isImage||isPdf) return uploadFieldMarkup(fieldKey,value,isPdf?'pdf':'image');
    if(long) return `<div class="admin-field full"><label for="obj-${fieldKey}">${esc(prettyFieldName(fieldKey))}</label><textarea id="obj-${fieldKey}" data-object-field="${fieldKey}">${esc(value||'')}</textarea></div>`;
    const externalUrl=['website','linkedin','instagram','youtube','facebook','videoUrl'].includes(fieldKey);
    const type=externalUrl?'url':fieldKey==='email'?'email':'text';
    const placeholder=externalUrl?'https://…':fieldKey.toLowerCase().includes('url')?'about.html, contact.html or another relative page path':prettyFieldName(fieldKey);
    return `<div class="admin-field"><label for="obj-${fieldKey}">${esc(prettyFieldName(fieldKey))}</label><input id="obj-${fieldKey}" type="${type}" data-object-field="${fieldKey}" value="${esc(value||'')}" placeholder="${esc(placeholder)}"><div class="field-hint">${externalUrl?'Use the full https:// address for an external profile or video.':'Use a relative page path for internal navigation; it will work on localhost and after deployment.'}</div></div>`;
  }
  function renderObject(key) {
    const config=objects[key]; const obj=content[key]||{};
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
    return `<div class="content-head"><div><h2>${config.title}</h2><p>${config.description}</p></div></div><div class="object-sections">${forms}</div>`;
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
    if(current==='dashboard') target.innerHTML=renderDashboard();
    else if(collections[current]) target.innerHTML=renderCollection(current);
    else if(objects[current]) target.innerHTML=renderObject(current);
    else if(current==='inquiries') target.innerHTML=renderInquiries();
    else if(current==='security') target.innerHTML=renderSecurity();
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
    $$('form[data-object-section]').forEach(form=>{ form.addEventListener('submit',saveObject); form.addEventListener('click',event=>{
      const add=event.target.closest('[data-array-add]');
      const remove=event.target.closest('[data-array-remove]');
      if(remove){
        const row=remove.closest('.array-record'); const parent=row?.parentElement;
        if(row) row.remove();
        if(parent&&!parent.querySelector('.array-record')){
          const editor=parent.closest('[data-array-editor]');
          const keys=JSON.parse(editor?.dataset.arrayKeys||'[]');
          parent.innerHTML=renderArrayRow(keys,{},0);
        }
        return;
      }
      if(add){
        const editor=add.closest('[data-array-editor]'); const holder=editor?.querySelector('.array-records');
        if(!holder) return;
        const keys=JSON.parse(editor.dataset.arrayKeys||'[]');
        holder.insertAdjacentHTML('beforeend',renderArrayRow(keys,{},holder.querySelectorAll('.array-record').length));
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
    e.preventDefault(); const config=collections[current]; const form=e.currentTarget; const record={};
    for(const field of config.fields){
      const [key,,type]=field; const input=form.querySelector(`[data-field="${key}"]`); let value=input?.value??'';
      if(type==='pages') value=value.split(/\n\s*===PAGE===\s*\n/g).map(x=>x.trim()).filter(Boolean);
      if(current==='blogs' && key==='publishAt' && value){
        const publicationDate = new Date(value);
        if(Number.isNaN(publicationDate.getTime())){showToast('Choose a valid publication date and time.',true);input?.focus();return;}
        value=publicationDate.toISOString();
      }
      if(current==='blogs' && key==='status' && String(value).toLowerCase()==='scheduled' && !form.querySelector('[data-field="publishAt"]')?.value){showToast('Choose a publication date and time for a scheduled article.',true);form.querySelector('[data-field="publishAt"]')?.focus();return;}
      record[key]=value.trim?value.trim():value;
    }
    if(currentIndex>=0) { record.id=content[config.collection][currentIndex].id; content[config.collection][currentIndex]=record; }
    else { record.id='item-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7); content[config.collection]=content[config.collection]||[];content[config.collection].unshift(record);currentIndex=0; }
    const save=$('#saveRecord');save.disabled=true;save.textContent='Saving…';
    try{await saveData();renderModule();showToast(`${config.singular[0].toUpperCase()+config.singular.slice(1)} saved successfully.`);}catch(error){save.disabled=false;save.textContent=`Save ${config.singular} ↗`;showToast(error.message,true);}
  }
  async function saveObject(e) {
    e.preventDefault();
    const form=e.currentTarget; const objectKey=form.dataset.objectSection; const updated={...(content[objectKey]||{})};
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
      showToast(error instanceof SyntaxError?'One of the JSON fields is not valid. Please correct the JSON and save again.':error.message,true);
      if(status)status.textContent=error.message;
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
