// Создаётся sentinel элемент после #news-list.
// IntersectionObserver наблюдает за sentinel и при приближении подгружает следующий батч (BATCH_SIZE).
// INITIAL_K загружает первые статьи при старте.
// rootMargin = '400px' начинает загрузку заранее, чтобы не было задержки при прокрутке.
// URL-адреса страниц с новостями (или API)
const newsSources = [
    '/blog/binding_type.html',
    '/blog/binding_tune.html',
    '/blog/binding_angles.html',
    '/blog/stance_calculator.html',
    '/blog/slope_rating.html',
    '/blog/snowboard_inside.html',
    '/blog/snowboard_cambers.html',
    '/blog/snowboard_flex.html',
    '/blog/snowboard_riding_styles.html',
    '/blog/boots_choose.html',
];

// Парсер sitemap
async function fetchUrlsFromSitemap(sitemapPath = '/sitemap.xml') {
    try {
        const resp = await fetch(sitemapPath);
        if (!resp.ok) return [];
        const xmlText = await resp.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');
        const locNodes = Array.from(xml.querySelectorAll('loc'));
        const urls = locNodes.map(n => {
            const txt = (n.textContent || '').trim();
            try {
                const u = new URL(txt);
                if (u.hostname === location.hostname) return u.pathname + u.search + u.hash;
            } catch (e) { }
            return txt;
        }).filter(Boolean);
        return urls;
    } catch (err) {
        console.error('Ошибка при парсинге sitemap:', err);
        return [];
    }
}

// Получаем контейнер при старте
let newsContainer;

// Загрузка и парсинг страницы
async function fetchNewsFromPage(url) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const title = doc.querySelector(`meta[property="og:title"]`)?.content ||
                      doc.querySelector('title')?.textContent ||
                      'Без заголовка';
        const description = doc.querySelector(`meta[property="og:description"]`)?.content ||
                            doc.querySelector('meta[name="description"]')?.content ||
                            'Без описания';
        const image = doc.querySelector(`meta[property="og:image"]`)?.content ||
                      doc.querySelector(`meta[name="image"]`)?.content ||
                      '';
        // Если в мета нет поля url — используем переданный url
        const link = doc.querySelector(`meta[name="url"]`)?.content || url;

        return [{
            title,
            description,
            link,
            image
        }];
    } catch (error) {
        console.error(`Ошибка загрузки данных с ${url}:`, error);
        return [];
    }
}

// Получение из API (если нужно)
async function fetchNewsFromAPI(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.map(news => ({
            title: news.title || 'Без заголовка',
            description: news.description || 'Без описания',
            link: news.link || '#',
            image: news.image || ''
        }));
    } catch (error) {
        console.error(`Ошибка загрузки данных из API ${url}:`, error);
        return [];
    }
}

// Генерация HTML
function generateNewsHTML(news) {
    const imgSrc = news.image && news.image !== 'Без изображения' ? news.image : '/images/default-article.png';
    return `
        <div class="mt-5 mt-lg-16 col-lg-8 col-md-10 col-12" data-aos="fade-up" data-aos-delay="100">
            <a href="${news.link}">
                <div class="class-thumb"> <img src="${imgSrc}" class="img-fluid" alt="Class">
                    <div class="class-info">
                        <h4 class="mb-1">${news.title}</h4>
                        <p class="mt-3">${news.description}</p><br>
                        <span class="class-price">читать >>></span>
                    </div>
                </div>
            </a>
        </div>
    `;
}

// Параметры загрузки
const INITIAL_K = 5;   // сколько загрузить сразу
const BATCH_SIZE = 5;  // сколько подгружать за раз при прокрутке

// Загружает батч исходников и возвращает массив постов
async function loadBatch(sources, startIndex, count) {
    const slice = sources.slice(startIndex, startIndex + count);
    const promises = slice.map(async (source) => {
        if (source.startsWith('http')) return await fetchNewsFromAPI(source);
        return await fetchNewsFromPage(source);
    });
    const results = await Promise.all(promises);
    return results.flat().filter(Boolean);
}

// Добавляет элементы в DOM
function appendNewsToDOM(newsItems) {
    newsItems.forEach(news => {
        const html = generateNewsHTML(news);
        newsContainer.insertAdjacentHTML('beforeend', html);
    });
}

// Основная функция с бесконечной прокруткой (IntersectionObserver)
async function loadNewsFeed() {
    newsContainer = document.getElementById('news-list');
    if (!newsContainer) return;

    // Получаем список URL-ов
    const sitemapUrls = await fetchUrlsFromSitemap('/sitemap.xml');
    const combinedSources = Array.from(new Set([
        ...newsSources,
        ...sitemapUrls.filter(u => u.includes('/blog/'))
    ]));

    let currentIndex = 0;
    let isLoading = false;

    // Сентинел, за которым наблюдаем
    let sentinel = document.getElementById('news-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'news-sentinel';
        sentinel.style.padding = '20px 0';
        newsContainer.parentNode.insertBefore(sentinel, newsContainer.nextSibling);
    }

    // Загрузим первоначальный блок
    const initial = await loadBatch(combinedSources, currentIndex, INITIAL_K);
    appendNewsToDOM(initial);
    currentIndex += initial.length;

    // Если всё уже загружено — удаляем sentinel и выходим
    if (currentIndex >= combinedSources.length) {
        sentinel.remove();
        return;
    }

    // IntersectionObserver callback
    const onIntersect = async (entries, observer) => {
        if (entries.some(e => e.isIntersecting) && !isLoading) {
            isLoading = true;
            // Опционально показываем индикатор в sentinel
            const prevHTML = sentinel.innerHTML;
            sentinel.innerHTML = '<div class="text-center">Загрузка...</div>';

            const next = await loadBatch(combinedSources, currentIndex, BATCH_SIZE);
            appendNewsToDOM(next);
            currentIndex += next.length;

            if (currentIndex >= combinedSources.length) {
                observer.disconnect();
                sentinel.remove(); // больше не нужен
            } else {
                sentinel.innerHTML = prevHTML; // убрать индикатор
            }
            isLoading = false;
        }
    };

    const observer = new IntersectionObserver(onIntersect, {
        root: null,
        rootMargin: '400px', // начать подгрузку заранее
        threshold: 0.01
    });

    observer.observe(sentinel);
}

// Запуск после готовности DOM
document.addEventListener('DOMContentLoaded', () => {
    loadNewsFeed();
});