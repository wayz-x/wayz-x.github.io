        // URL-адреса страниц с новостями (или API)
        const newsSources = [
            '/blog/binding_type.html',  // Локальная страница
            '/blog/binding_tune.html',  // Добавьте другие страницы
            '/blog/binding_angles.html',
            '/blog/stance_calculator.html',
            '/blog/slope_rating.html',
            '/blog/snowboard_inside.html',
            '/blog/snowboard_cambers.html',
            '/blog/snowboard_flex.html',
            '/blog/snowboard_riding_styles.html',           

        ];

        // Контейнер для вставки новостей
        const newsContainer = document.getElementById('news-list');

        // Функция для извлечения значения мета-тега по имени
        function getMetaContentByName(name, doc) {
            const metaTag = doc.querySelector(`meta[name="${name}"]`);
            return metaTag ? metaTag.content : null;
        }

        // Функция для извлечения значения мета-тега по свойству (property)
        function getMetaContentByProperty(property, doc) {
            const metaTag = doc.querySelector(`meta[property="${property}"]`);
            return metaTag ? metaTag.content : null;
}

        // Функция для загрузки HTML страницы и извлечения новостей
        async function fetchNewsFromPage(url) {
            try {
                const response = await fetch(url);
                const text = await response.text();

                // Создание временного DOM для парсинга данных
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const metaTags = doc.querySelectorAll("meta");
                const item = [{
                    title: doc.querySelector(`meta[property="og:title"]`)?.content || 'Без заголовка',
                    description: doc.querySelector(`meta[property="og:description"]`)?.content || 'Без описания',
                    link: doc.querySelector(`meta[name="url"]`)?.content || '#',
                    image: doc.querySelector(`meta[name="image"]`)?.content ||  'Без изображения',
                }
            ];
            return item;

                
            } catch (error) {
                console.error(`Ошибка загрузки данных с ${url}:`, error);
                return [];
            }
        }

        // Функция для получения данных из API
        async function fetchNewsFromAPI(url) {
            try {
                const response = await fetch(url);
                const data = await response.json();
                

                // Предполагаем, что API возвращает массив объектов с ключами title, description и link
                return data.map(news => ({
                    title: news.title || 'Без заголовка',
                    description: news.description || 'Без описания',
                    link: news.link || '#'
                }));
            } catch (error) {
                console.error(`Ошибка загрузки данных из API ${url}:`, error);
                return [];
            }
        }

        // Функция для генерации HTML новости
        function generateNewsHTML(news) {
            const newsHTML = `
                <div class="mt-5 mt-lg-16 col-lg-8 col-md-10 col-12" data-aos="fade-up" data-aos-delay="100">
                    <a href="${news.link}">
                        <div class="class-thumb"> <img src="${news.image}" class="img-fluid" alt="Class">
                            <div class="class-info">
                                <h4 class="mb-1">${news.title}</h4>
                                <p class="mt-3">${news.description}</p><br>
                                <span class="class-price">читать >>></span>
                            </div>
                        </div>
                    </a>
                </div>
            `;
            return newsHTML;
        }

        // Основная функция для загрузки и отображения новостей
        async function loadNewsFeed() {
            const allNews = [];

            // Перебираем все источники
            for (const source of newsSources) {
                if (source.startsWith('http')) {
                    // Если это API
                    const apiNews = await fetchNewsFromAPI(source);
                    allNews.push(...apiNews);
                } else {
                    // Если это HTML-страница
                    const pageNews = await fetchNewsFromPage(source);
                    allNews.push(...pageNews);
                }
            }

            // Генерация HTML для всех новостей
            allNews.forEach(news => {
                const newsHTML = generateNewsHTML(news);
                newsContainer.insertAdjacentHTML('beforeend', newsHTML);
            });
        }

        // Запускаем процесс загрузки
        loadNewsFeed();