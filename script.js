'use strict';
/* mmrsiq ta2 — статическая демоверсия. Токен Telegram НИКОГДА не размещайте в этом файле.
   Настоящую отправку позже подключим через защищённый Cloudflare Worker. */
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
const workList = Array.isArray(window.MMR_WORKS) ? window.MMR_WORKS : [];
const reviewRaw = Array.isArray(window.MMR_REVIEWS) ? window.MMR_REVIEWS : [];
const preferredReviews = ['1652','1653','1654','1655','1656','1657','1658','1659','1662','1663','1664','1665','1649','1650','1651'];
const reviewList = [...reviewRaw].sort((a,b) => preferredReviews.findIndex(id=>a.includes(id+'.webp')) - preferredReviews.findIndex(id=>b.includes(id+'.webp')));
const featuredIds = ['1594','1602','1622','1596','1618','1601','1630','1609'];
const findWork = id => workList.find(item => item.id.endsWith(id));
const featured = featuredIds.map(findWork).filter(Boolean);
const unfeatured = workList.filter(item => !featured.includes(item));
let visibleAll = false;
let currentLightboxIndex = 0;
let currentLightboxImages = [];
let previousFocus = null;
let selectedFiles = [];
let thumbUrls = [];
let toastTimeout;

// Header and navigation
const header = $('.header');
const progress = $('#progressBar');
const menuBtn = $('#menuToggle');
const nav = $('#mainNav');
const setMenuOpen = (open) => {
  nav.classList.toggle('open', open);
  menuBtn.classList.toggle('active', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  document.body.classList.toggle('menu-open', open);
};
menuBtn.addEventListener('click', () => {
  const open = !nav.classList.contains('open');
  setMenuOpen(open);
});
$$('.nav a, .header-cta').forEach(a => a.addEventListener('click', () => setMenuOpen(false)));
// Deterministic scroll-spy: one position => one active section.
// Unlike IntersectionObserver this is stable when a section is short,
// in-between sections, or when wheel scrolling jumps across multiple sections.
const navLinks = $$('.nav a[data-nav]');
const navSections = navLinks.map(link => ({link, section: document.getElementById(link.dataset.nav)})).filter(entry => entry.section);
let currentSectionId = '';
let scrollRafPending = false;
function getActiveSectionId() {
  const currentY = window.scrollY;
  // A visitor looking at the beginning of a section already sees its heading.
  // Sample about one quarter down the viewport, always below the fixed header.
  const headerBottom = header.getBoundingClientRect().height;
  const probe = currentY + Math.max(headerBottom + 32, Math.min(window.innerHeight * 0.30, 240));
  let active = '';
  for (const {section} of navSections) {
    if (section.getBoundingClientRect().top + currentY <= probe + 1) active = section.id;
    else break;
  }
  const bookingSection = document.getElementById('booking');
  if (bookingSection && bookingSection.getBoundingClientRect().top + currentY <= probe) return '';
  return active;
}
function setActiveSection(id) {
  if (currentSectionId === id) return;
  currentSectionId = id;
  navLinks.forEach(link => {
    const selected = link.dataset.nav === id;
    link.classList.toggle('is-current', selected);
    if (selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
function updateScrollState() {
  header.classList.toggle('scrolled', window.scrollY > 35);
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  progress.style.width = `${Math.min(100, window.scrollY / max * 100)}%`;
  setActiveSection(getActiveSectionId());
}
function scheduleScrollState() {
  if (scrollRafPending) return;
  scrollRafPending = true;
  requestAnimationFrame(() => {
    scrollRafPending = false;
    updateScrollState();
  });
}
window.addEventListener('scroll', scheduleScrollState, {passive:true});
window.addEventListener('resize', () => {
  if (window.innerWidth > 980) setMenuOpen(false);
  scheduleScrollState();
}, {passive:true});
window.addEventListener('load', scheduleScrollState);
window.addEventListener('hashchange', () => requestAnimationFrame(scheduleScrollState));
navLinks.forEach(link => link.addEventListener('click', () => {
  // The visible scroll position remains the authority after smooth scrolling.
  scheduleScrollState();
}));
updateScrollState();

// Seamless ticker. Fill any viewport with repeated identical runs of text;
// move exactly one run to keep the transition frame-perfect at the loop boundary.
const marqueeStrip = $('.marquee-strip');
const marqueeTrack = $('.marquee-track', marqueeStrip);
const marqueeItem = marqueeTrack.firstElementChild;
function sizeMarquee(){
  if(!marqueeItem)return;
  const unit=marqueeItem.getBoundingClientRect().width;
  if(unit<=0)return;
  const needed=marqueeStrip.clientWidth+unit*2;
  const copies=Math.max(5,Math.ceil(needed/unit));
  while(marqueeTrack.children.length<copies){
    const clone=marqueeItem.cloneNode(true);
    clone.setAttribute('aria-hidden','true');
    marqueeTrack.append(clone);
  }
  // Whole copies are identical; a loop restart therefore has no visible jump.
  marqueeTrack.style.setProperty('--marquee-distance',`${unit}px`);
  marqueeTrack.style.setProperty('--marquee-duration',`${Math.max(11,unit/72).toFixed(2)}s`);
}
sizeMarquee();
if(document.fonts?.ready)document.fonts.ready.then(sizeMarquee);
let marqueeResizeRaf=0;
window.addEventListener('resize',()=>{
  cancelAnimationFrame(marqueeResizeRaf);
  marqueeResizeRaf=requestAnimationFrame(sizeMarquee);
},{passive:true});

// Gallery categories describe visible motifs in the supplied photos.
// They do NOT claim work was a cover-up or another specialty without confirmation.
const visualGroups = {
  fine: new Set(['1595','1601','1603','1604','1605','1606','1607','1612','1614','1615','1619','1620','1625','1628','1632','1633','1635','1639','1641','1642','1643']),
  graphic: new Set(['1594','1596','1602','1608','1609','1611','1613','1616','1618','1621','1622','1623','1626','1627','1629','1630','1634','1636','1638']),
  ornament: new Set(['1594','1602','1609','1611','1618','1622','1627','1630','1635','1636','1642']),
  lettering: new Set(['1597','1598','1603','1607','1620','1633','1638'])
};
const categoryNames = {fine:'Тонкие линии',graphic:'Графика',ornament:'Орнамент',lettering:'Надписи'};
const gallery = $('#worksGrid');
let entranceObserver = null;
const moreBtn = $('#moreWorks');
const counter = $('#galleryCounter');
const filters = $$('.portfolio-filter');
let activeFilter = 'featured';
function imageCategory(item) {
  const id=item.id.slice(-4);
  return Object.keys(categoryNames).find(key=>visualGroups[key].has(id)) || null;
}
// A photograph can appear in more than one curated collection. Its displayed
// title and lightbox description should ALWAYS match the currently open filter,
// rather than the first category assigned to the photograph.
function categoryForView(item, filter=activeFilter) {
  const category = categoryNames[filter] ? filter : imageCategory(item);
  return categoryNames[category] || 'Авторская работа';
}
function getVisibleWorks() {
  const ordered = featured.concat(unfeatured);
  if (activeFilter === 'featured') return featured;
  if (activeFilter === 'all') return ordered;
  return ordered.filter(w => visualGroups[activeFilter]?.has(w.id.slice(-4)));
}
function workCard(item, index, list) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'work-item';
  const label = categoryForView(item);
  b.setAttribute('aria-label', `Открыть фотографию: ${label}, ${index + 1}`);
  const im = document.createElement('img');
  im.src = item.src;
  im.alt = `Работа Алины — ${label.toLowerCase()}`;
  im.loading = index < 6 ? 'eager' : 'lazy';
  im.decoding = 'async';
  const meta = document.createElement('span');
  meta.className = 'work-meta';
  const category = document.createElement('small'); category.textContent = 'MMRSIQ / PORTFOLIO';
  const name = document.createElement('b'); name.textContent = label;
  const indexTag = document.createElement('span'); indexTag.className='work-index';indexTag.textContent = String(index+1).padStart(2,'0') + ' / ' + String(list.length).padStart(2,'0');
  meta.append(category,name);
  const zoom = document.createElement('span'); zoom.className='work-zoom icon-arrow icon-arrow-light';zoom.setAttribute('aria-hidden','true');
  b.append(im,indexTag,meta,zoom);
  b.addEventListener('click', () => openLightbox(list.map(w => ({src:w.src,alt:`Татуировка Алины — ${categoryForView(w, activeFilter)}`})),index));
  return b;
}
function selectFilter(filter) {
  if (!['featured','all',...Object.keys(categoryNames)].includes(filter)) return;
  activeFilter=filter;
  const list = getVisibleWorks();
  gallery.replaceChildren(...list.map((item,i)=>workCard(item,i,list)));
  if (entranceObserver) {
    [...gallery.children].forEach((item,i)=>{
      item.classList.add('motion-photo');
      item.style.setProperty('--enter-delay', `${Math.min(i % 8, 5) * 75}ms`);
      entranceObserver.observe(item);
    });
  }
  gallery.classList.toggle('expanded',filter !== 'featured');
  filters.forEach(button => {
    const selected = button.dataset.filter === filter;
    button.classList.toggle('is-active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  moreBtn.hidden = filter === 'all';
  moreBtn.innerHTML = 'Посмотреть все 46 работ <span class="icon-arrow icon-arrow-light" aria-hidden="true"></span>'; 
  counter.textContent = `${list.length} из ${workList.length} работ`;
  scheduleScrollState(); // gallery height may have changed the section positions
}
filters.forEach(button=>button.addEventListener('click',()=>selectFilter(button.dataset.filter)));
moreBtn.addEventListener('click',()=>{
  selectFilter('all');
  // Keep selected filter visible after changing collection dimensions.
  $('#portfolioFilters').scrollIntoView({behavior:'smooth',block:'start'});
});
selectFilter('featured');

// 2GIS, 19 entries as of October 2026. Original text only where supplied in
// the client's screenshots; online-only entries are transparently paraphrased.
const reviewListText = [{"name":"Антон Новиков","date":"5 октября 2026","rating":5,"text":"Алина прекрасный мастер! Всё прошло быстро и комфортно. Приятно поболтали и время прошло незаметно. В следующий раз обязательно обращусь к ней!","kind":"review"},{"name":"Miss Angie","date":"4 сентября 2026","rating":5,"text":"Безумно довольна своей новой татуировкой. Алина настоящий профессионал своего дела. Всё прошло максимально комфортно, аккуратно и с заботой о каждой детали.","kind":"excerpt"},{"name":"лизуся","date":"28 августа 2026","rating":5,"text":"Мастер Алина очень приятная девушка, сеанс прошел отлично, профи своего дела, уютная студия в удобном расположении, цены волшебные, очень советую Алину…","kind":"excerpt"},{"name":"Анастасия Исхакова","date":"16 сентября 2026","rating":5,"text":"Мастер профессионал своего дела, ходили с братом делать парные тату и остались очень довольны, записались к этому мастеру еще раз. Советую сходить не пожалеете.","kind":"review"},{"name":"Данил Латышев","date":"4 сентября 2026","rating":5,"text":"Отличный мастер и настоящий профессионал своего дела. Всё выполнено чётко, аккуратно и качественно, все мои пожелания учтены. Результатом полностью доволен, рекомендую!","kind":"review"},{"name":"Екатерина Медведева","date":"4 сентября 2026","rating":5,"text":"Очень понравилось! Алина всё сделала аккуратно и красиво, результатом довольна. Спасибо большое, обязательно приду ещё!","kind":"review"},{"name":"Дарья Андреевна","date":"4 сентября 2026","rating":5,"text":"Очень довольна татуировкой 🥰 Алина всё сделала аккуратно, получилось именно так, как я хотела. В студии приятная атмосфера, сама Алина очень комфортная в общении. Спасибо большое, обязательно приду ещё ❤️","kind":"review"},{"name":"Данил Евгеньевич","date":null,"rating":null,"text":"Отмечает, что Алина работает качественно и быстро, и собирается вернуться, чтобы продолжить татуировку на другой руке.","kind":"summary"},{"name":"Ольга Мурзина","date":null,"rating":null,"text":"Очень довольна результатом: мастер работала аккуратно, а готовая татуировка получилась такой, как она хотела.","kind":"summary"},{"name":"Алёна Голубцова","date":null,"rating":null,"text":"Благодарит Алину: результат понравился даже больше, чем представляла, и она планирует вернуться.","kind":"summary"},{"name":"Mila Dvurehenskaya","date":"3 сентября 2026","rating":5,"text":"Хочу оставить огромную благодарность Алине 🖤 Очень понравилось абсолютно всё: начиная от общения и консультации и заканчивая самой работой. Алина очень аккуратная, внимательная и видно, что действительно любит своё дело. Я сразу чувствовала себя спокойно и комфортно, хотя немного переживала перед сеансом. Татуировка получилась даже лучше, чем я представляла. Всё ровно, аккуратно и очень красиво 😍 Алина учла все мои пожелания и помогла сделать эскиз именно таким, как я хотела. Отдельно хочу отметить атмосферу во время сеанса. Было легко и приятно, совсем не чувствовала себя неловко. Однозначно буду обращаться ещё и уже советую Алину всем, кто думает о тату ❤️","kind":"review"},{"name":"Иван Гриних","date":null,"rating":null,"text":"Описывает Алину как доброго и приятного человека; сеанс прошёл быстро и комфортно. Хочет прийти ещё.","kind":"summary"},{"name":"Ярослав Жолудев","date":null,"rating":null,"text":"Короткий положительный отзыв о работе мастера.","kind":"summary"},{"name":"Юлия Музыка","date":null,"rating":null,"text":"Называет Алину любимым мастером, отмечает качество татуировок, атмосферу сеансов и профессиональный подход.","kind":"summary"},{"name":"полина","date":null,"rating":null,"text":"Очень короткий восторженный отзыв: клиентке всё понравилось.","kind":"summary"},{"name":"Данил Соколов","date":null,"rating":null,"text":"Короткая похвала мастеру.","kind":"summary"},{"name":"Андрей Ковальчук","date":null,"rating":null,"text":"Очень короткий положительный отзыв о тату-мастере.","kind":"summary"},{"name":"Городской житель","date":null,"rating":null,"text":"Отмечает уютную атмосферу студии и рекомендует её посетителям.","kind":"summary"},{"name":"Антошка Соколов","date":null,"rating":null,"text":"Высоко оценивает Алину и как тату-мастера, и как человека.","kind":"summary"}];
const reviewSourceUrl = 'https://2gis.ru/novosibirsk/firm/70000001117308990/tab/reviews';
const reviewsTrack = $('#reviewsTrack');
reviewListText.forEach((review) => {
  const article = document.createElement('article');
  article.className = 'review-slide review-quote';
  const top = document.createElement('div'); top.className = 'review-quote-top';
  const quotation = document.createElement('span'); quotation.className = 'review-mark'; quotation.textContent = '“';
  top.append(quotation);
  if (review.rating) {
    const stars = document.createElement('span');stars.className='review-stars';
    stars.setAttribute('aria-label', `${review.rating} из 5 звёзд`);
    stars.textContent = '★'.repeat(review.rating); top.append(stars);
  } else {
    const noScore = document.createElement('span');noScore.className='review-no-rating';
    noScore.textContent = 'ОТЗЫВ ИЗ 2ГИС';top.append(noScore);
  }
  // Identical card height for every review; long text scrolls inside its own panel.
  const textFrame = document.createElement('div'); textFrame.className = 'review-text-frame';
  const quote = document.createElement('blockquote'); quote.textContent = review.text;
  quote.tabIndex = 0;
  quote.setAttribute('aria-label', `Текст отзыва ${review.name}. Если текст длинный, прокрутите внутри карточки.`);
  const scrollCue = document.createElement('span');scrollCue.className='review-scroll-cue';
  scrollCue.textContent='↓  Листай текст';scrollCue.setAttribute('aria-hidden','true');
  textFrame.append(quote,scrollCue);
  quote.addEventListener('scroll',()=>{
    textFrame.classList.toggle('at-end', quote.scrollTop >= quote.scrollHeight - quote.clientHeight - 4);
  }, {passive:true});
  const meta = document.createElement('div');meta.className='review-quote-meta';
  meta.textContent = review.kind === 'summary' ? 'КРАТКИЙ ПЕРЕСКАЗ' : review.kind === 'excerpt' ? 'ФРАГМЕНТ ОТЗЫВА' : 'ТЕКСТ ОТЗЫВА';
  const bottom = document.createElement('div');bottom.className='review-byline';
  const identity = document.createElement('div');
  const name=document.createElement('strong');name.textContent=review.name;identity.append(name);
  if (review.date) {
    const date=document.createElement('time');date.textContent=review.date;identity.append(date);
  }
  const source=document.createElement('a');source.className='review-source';source.href=reviewSourceUrl;
  source.target='_blank';source.rel='noopener noreferrer';source.innerHTML='2ГИС <span class="icon-arrow icon-arrow-light" aria-hidden="true"></span>'; 
  source.setAttribute('aria-label', `Посмотреть оригинальный отзыв на 2ГИС: ${review.name}`);
  bottom.append(identity,source);
  article.append(top,textFrame,meta,bottom);
  reviewsTrack.append(article);
});
// Detect text overflow after layout and on resizing; only truly long reviews show the cue.
function refreshReviewScrollCues(){
  $$('.review-text-frame', reviewsTrack).forEach(frame=>{
    const text=frame.querySelector('blockquote');
    const overflows=text.scrollHeight > text.clientHeight + 4;
    frame.classList.toggle('can-scroll',overflows);
    frame.classList.toggle('at-end',!overflows || text.scrollTop >= text.scrollHeight - text.clientHeight - 4);
  });
}
requestAnimationFrame(refreshReviewScrollCues);
window.addEventListener('resize',()=>requestAnimationFrame(refreshReviewScrollCues),{passive:true});
if(document.fonts?.ready)document.fonts.ready.then(refreshReviewScrollCues);
// Reviews: one card per arrow click; dynamic measurements also support small screens.
// The right-side inner padding leaves the final review completely in view.
let reviewTargetIndex = 0;
function reviewStep() {
  const card = reviewsTrack.querySelector('.review-slide');
  if (!card) return 0;
  return card.getBoundingClientRect().width + (parseFloat(getComputedStyle(reviewsTrack).columnGap) || 0);
}
function moveReviews(direction) {
  const step = reviewStep();
  if (!step) return;
  // Track requested position instead of the intermediate animated scroll position.
  // Fast repeated clicks should still move exactly one card each time.
  reviewTargetIndex = Math.max(0, Math.min(reviewListText.length - 1, reviewTargetIndex + direction));
  reviewsTrack.scrollTo({left: reviewTargetIndex * step, behavior: 'smooth'});
}
// Re-sync after manual swiping or dragging the carousel.
reviewsTrack.addEventListener('scrollend', () => {
  const step = reviewStep();
  if (!step) return;
  const maxScroll = reviewsTrack.scrollWidth - reviewsTrack.clientWidth;
  // The last item cannot always snap to the left edge on wide screens.
  if (maxScroll - reviewsTrack.scrollLeft < 12) reviewTargetIndex = reviewListText.length - 1;
  else reviewTargetIndex = Math.max(0, Math.min(reviewListText.length - 1, Math.round(reviewsTrack.scrollLeft / step)));
});
$('#reviewPrev').addEventListener('click', () => moveReviews(-1));
$('#reviewNext').addEventListener('click', () => moveReviews(1));

// A small curated sequence for the first impression, not all 46 photos.
// Preload next image before fading to avoid empty frames or a flashed alt.
const heroMain=$('.hero-image-main img');
const heroSmall=$('.hero-image-small img');
const heroNow=$('#heroSlideNow');
const heroTotal=$('#heroSlideTotal');
const heroImages=featured.map(w=>w.src);
let heroIndex=0,heroTimer=0,heroChanging=false;
function loadHeroImage(src){
  return new Promise(resolve => {
    const im=new Image(); im.onload=()=>resolve(true);im.onerror=()=>resolve(false);im.src=src;
  });
}
async function showNextHero(){
  if(heroChanging || document.hidden || heroImages.length<2)return;
  heroChanging=true;
  const nextIndex=(heroIndex+1)%heroImages.length;
  const nextSmall=(nextIndex+1)%heroImages.length;
  const loaded=await Promise.all([loadHeroImage(heroImages[nextIndex]),loadHeroImage(heroImages[nextSmall])]);
  if(!loaded[0]){heroChanging=false;return}
  heroMain.classList.add('is-transitioning');
  heroSmall.classList.add('is-transitioning');
  window.setTimeout(()=>{
    heroIndex=nextIndex;
    heroMain.src=heroImages[nextIndex];
    heroMain.alt=`Избранная работа Алины, ${nextIndex+1} из ${heroImages.length}`;
    if(loaded[1])heroSmall.src=heroImages[nextSmall];
    heroNow.textContent=String(nextIndex+1).padStart(2,'0');
    heroMain.classList.remove('is-transitioning');
    heroSmall.classList.remove('is-transitioning');
    heroChanging=false;
  }, 270);
}
if(heroMain && heroSmall && heroImages.length>1){
  heroTotal.textContent=String(heroImages.length).padStart(2,'0');
  heroMain.src=heroImages[0];heroSmall.src=heroImages[1];
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    heroTimer=window.setInterval(showNextHero,4200);
  }
}

// Lightbox for portfolio and reviews
const lightbox=$('#lightbox');
function openLightbox(images,index){
  previousFocus=document.activeElement;
  currentLightboxImages=images;
  currentLightboxIndex=index;
  lightbox.hidden=false;
  document.body.style.overflow='hidden';
  paintLightbox();
  $('#closeLightbox').focus();
}
function paintLightbox(){
  const i=currentLightboxImages[currentLightboxIndex];if(!i) return;
  const img=$('#lightboxImage');img.src=i.src;img.alt=i.alt;
  $('#lightboxCounter').textContent=`${String(currentLightboxIndex+1).padStart(2,'0')} / ${String(currentLightboxImages.length).padStart(2,'0')}`;
  $('#lightboxMeter').style.width=`${(currentLightboxIndex+1)/currentLightboxImages.length*100}%`;
}
function cycleLightbox(dir){currentLightboxIndex=(currentLightboxIndex+dir+currentLightboxImages.length)%currentLightboxImages.length;paintLightbox()}
function closeLightbox(){lightbox.hidden=true;document.body.style.overflow='';$('#lightboxImage').removeAttribute('src');previousFocus?.focus()}
$('#closeLightbox').addEventListener('click',closeLightbox);
$('#lightboxPrev').addEventListener('click',()=>cycleLightbox(-1));
$('#lightboxNext').addEventListener('click',()=>cycleLightbox(1));
lightbox.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox()});
let swipeStartX=0;
lightbox.addEventListener('touchstart',e=>{swipeStartX=e.changedTouches[0]?.screenX||0},{passive:true});
lightbox.addEventListener('touchend',e=>{const delta=(e.changedTouches[0]?.screenX||0)-swipeStartX;if(Math.abs(delta)>55)cycleLightbox(delta<0?1:-1)},{passive:true});

// Booking form: local preview only. No outbound request and no persistent storage.
const booking=$('#bookingForm');
const dateInput=$('#desiredDate');
function localToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
dateInput.min=localToday();
function setError(id,message){
  const node=$('#'+id);
  const error=$(`[data-error-for="${id}"]`);
  if(error)error.textContent=message;
  if(node)node.setAttribute('aria-invalid',message?'true':'false');
}
['clientName','clientContact','desiredDate','tattooSize','tattooIdea'].forEach(id=>{
  const node=$('#'+id);node.addEventListener(node.tagName==='SELECT'?'change':'input',()=>setError(id,''));
});
const uploadInput=$('#tattooFiles');
const uploadBox=$('#uploadBox');
function uploadProblem(msg){$('#filesError').textContent=msg;uploadBox.classList.toggle('has-error',!!msg)}
function formatMB(bytes){return (bytes/1024/1024).toFixed(1)}
function addFiles(incoming){
  const items=Array.from(incoming);
  for(const file of items){
    if(selectedFiles.length>=5){uploadProblem('Можно прикрепить не больше 5 файлов.');break}
    if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)){uploadProblem('Поддерживаются только изображения JPG, PNG, WEBP и HEIC.');continue}
    if(file.size>8*1024*1024){uploadProblem(`Файл ${file.name} больше 8 МБ.`);continue}
    if(selectedFiles.some(f=>f.name===file.name && f.size===file.size))continue;
    selectedFiles.push(file);uploadProblem('');
  }
  renderFilePreviews();
  uploadInput.value='';
}
function renderFilePreviews(){
  thumbUrls.forEach(URL.revokeObjectURL);thumbUrls=[];
  const chips=selectedFiles.map((file,index)=>{
    const chip=document.createElement('div');chip.className='file-chip';
    const img=document.createElement('img');
    const u=URL.createObjectURL(file);thumbUrls.push(u);
    img.src=u;img.alt='';
    const name=document.createElement('span');name.textContent=`${file.name} (${formatMB(file.size)} МБ)`;
    const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Удалить ${file.name}`);
    remove.addEventListener('click',()=>{selectedFiles.splice(index,1);renderFilePreviews()});
    chip.append(img,name,remove);return chip;
  });
  $('#filePreviews').replaceChildren(...chips);
}
uploadInput.addEventListener('change',e=>addFiles(e.target.files));
['dragenter','dragover'].forEach(event=>uploadBox.addEventListener(event,e=>{e.preventDefault();uploadBox.classList.add('dragover')}));
['dragleave','drop'].forEach(event=>uploadBox.addEventListener(event,e=>{e.preventDefault();uploadBox.classList.remove('dragover')}));
uploadBox.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
function formCheck(){
  let pass=true;
  const rules=[
    ['clientName',$('#clientName').value.trim().length>=2,'Укажи имя (минимум 2 символа).'],
    ['clientContact',$('#clientContact').value.trim().length>=4,'Оставь телефон или Telegram для связи.'],
    ['desiredDate',Boolean(dateInput.value)&&dateInput.value>=dateInput.min,'Выбери желаемую дату, не раньше сегодняшней.'],
    ['tattooSize',Boolean($('#tattooSize').value),'Выбери примерный размер.'],
    ['tattooIdea',$('#tattooIdea').value.trim().length>=5,'Опиши свою идею хотя бы в нескольких словах.']
  ];
  for(const [id,valid,error] of rules){setError(id,valid?'':error);if(!valid)pass=false}
  const agreed=$('#consent').checked;
  $('#consentError').textContent=agreed?'':'Пожалуйста, подтверди условия.';
  if(!agreed)pass=false;
  if(!pass){const first=$('[aria-invalid="true"]') || $('#consent');first?.focus();}
  return pass;
}
const previewOverlay=$('#previewOverlay');
function openPreview(){
  const lines=[
    ['Имя',$('#clientName').value.trim()],
    ['Контакт',$('#clientContact').value.trim()],
    ['Желаемая дата',new Intl.DateTimeFormat('ru-RU',{dateStyle:'long'}).format(new Date(dateInput.value+'T12:00:00'))],
    ['Время',$('#desiredTime').value || 'Не указано'],
    ['Размер',$('#tattooSize').value],
    ['Место',$('#tattooPlace').value.trim() || 'Не указано'],
    ['Идея',$('#tattooIdea').value.trim()],
    ['Эскизы',selectedFiles.length ? selectedFiles.map(f=>f.name).join(', ') : 'Не прикреплены']
  ];
  const details=lines.map(([label,value])=>{
    const row=document.createElement('div');row.className='preview-detail';
    const a=document.createElement('b');a.textContent=label;
    const b=document.createElement('span');b.textContent=value;
    row.append(a,b);return row;
  });
  $('#previewDetails').replaceChildren(...details);
  previousFocus=document.activeElement;
  previewOverlay.hidden=false;
  document.body.style.overflow='hidden';
  $('#previewClose').focus();
}
function closePreview(){previewOverlay.hidden=true;document.body.style.overflow='';previousFocus?.focus()}
booking.addEventListener('submit',e=>{e.preventDefault();if(formCheck())openPreview()});
$('#previewClose').addEventListener('click',closePreview);
$('#previewDone').addEventListener('click',closePreview);
previewOverlay.addEventListener('click',e=>{if(e.target===previewOverlay)closePreview()});

// Keyboard accessibility
window.addEventListener('keydown',e=>{
  if(!lightbox.hidden){if(e.key==='Escape')closeLightbox();if(e.key==='ArrowLeft')cycleLightbox(-1);if(e.key==='ArrowRight')cycleLightbox(1);return}
  if(!previewOverlay.hidden){if(e.key==='Escape')closePreview();return}
  if(e.key==='Escape'&&nav.classList.contains('open')){setMenuOpen(false);menuBtn.focus()}
});

// Copy number to clipboard. MAX link-by-phone format is not guessed.
function toast(message){const item=$('#toast');item.textContent=message;item.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>item.classList.remove('show'),2500)}
$('#copyMax').addEventListener('click',async()=>{
  const value='89994696962';
  try{await navigator.clipboard.writeText(value);toast('Номер скопирован')}catch{
    const tmp=document.createElement('textarea');tmp.value=value;tmp.style.position='fixed';tmp.style.opacity='0';document.body.append(tmp);tmp.select();
    const success=document.execCommand('copy');tmp.remove();toast(success?'Номер скопирован':'Номер: 8 (999) 469-69-62');
  }
});


// Editorial motion: different entrances for type, image and information blocks.
// CSS animation styles activate ONLY if this observer is running. Accessibility:
// no motion for people who request reduced animation; no hidden content without JS.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('IntersectionObserver' in window && !reduceMotion) {
  const groups = [
    ['.section-head, .faq-intro', 'motion-header'],
    ['.about-copy, .booking-intro, .contact-layout>div:first-child', 'motion-editorial'],
    ['.style-card, .price-card, .step, .prep-card, .faq-item', 'motion-card'],
    ['.studio-video-wrap, .works-section .work-item', 'motion-photo']
  ];
  // Mark classes before turning animation on to avoid flashing at load.
  for (const [selector, effect] of groups) {
    document.querySelectorAll(selector).forEach((el,index)=>{
      el.classList.add(effect);
      const delay = effect==='motion-photo' ? (index%8)*65 : (index%5)*70;
      el.style.setProperty('--enter-delay',`${Math.min(delay,315)}ms`);
    });
  }
  entranceObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      entry.target.classList.add('motion-shown');
      entranceObserver.unobserve(entry.target);
    });
  },{threshold:0.1,rootMargin:'0px 0px 70px 0px'});
  document.documentElement.classList.add('motion-ready');
  document.querySelectorAll('.motion-header,.motion-editorial,.motion-card,.motion-photo')
    .forEach(el=>entranceObserver.observe(el));
}

// Filter discovery: arrows and indicator for touch screens; keep scroll and active tab in sync.
const filterScroller = $('#portfolioFilters');
const filterPrev = $('#filterPrev');
const filterNext = $('#filterNext');
function syncFilterArrows(){
  if(!filterScroller || !filterPrev || !filterNext) return;
  const limit=Math.max(0, filterScroller.scrollWidth-filterScroller.clientWidth);
  filterPrev.disabled=filterScroller.scrollLeft<5;
  filterNext.disabled=filterScroller.scrollLeft>=limit-5;
}
function advanceFilter(direction){
  const buttons = [...filterScroller.querySelectorAll('.portfolio-filter')];
  if(!buttons.length)return;
  // Choose the first tab at or after current viewport edge; move exactly one tab.
  const left=filterScroller.scrollLeft;
  let current=buttons.reduce((best,el,i)=>Math.abs(el.offsetLeft-filterScroller.offsetLeft-left)<Math.abs(buttons[best].offsetLeft-filterScroller.offsetLeft-left)?i:best,0);
  current=Math.min(buttons.length-1,Math.max(0,current+direction));
  filterScroller.scrollTo({left:buttons[current].offsetLeft-filterScroller.offsetLeft-18,behavior:'smooth'});
}
filterPrev?.addEventListener('click',()=>advanceFilter(-1));
filterNext?.addEventListener('click',()=>advanceFilter(1));
filterScroller?.addEventListener('scroll',syncFilterArrows,{passive:true});
window.addEventListener('resize',syncFilterArrows,{passive:true});
requestAnimationFrame(syncFilterArrows);
