document.addEventListener('DOMContentLoaded', async () => {
    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
    }

    const N8N_BASE_URL = 'https://handsomely-thrilled-curassow.cloudpub.ru/webhook'; // Убедитесь, что это ваш актуальный URL
    const loader = document.getElementById('loader');
    const productListContainer = document.getElementById('product-list');

    // Функция для "перемешивания" времени
    function scrambleTimestamp() {
        const timestampStr = Math.floor(Date.now() / 1000).toString();
        let scrambled = '';
        let left = 0;
        let right = timestampStr.length - 1;
        while (left <= right) {
            if (left === right) {
                scrambled += timestampStr[left];
            } else {
                scrambled += timestampStr[left];
                scrambled += timestampStr[right];
            }
            left++;
            right--;
        }
        return scrambled;
    }

    async function fetchWithScrambledTime(url) {
        const scrambledTime = scrambleTimestamp();
        const response = await fetch(`${url}?t=${scrambledTime}`, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    }

    async function loadCatalog() {
        try {
            const response = await fetchWithScrambledTime(`${N8N_BASE_URL}/models`);
            const data = await response.json();

            // --- НОВЫЙ, БОЛЕЕ НАДЕЖНЫЙ БЛОК ПРОВЕРКИ ---
            // Проверяем, что данные от n8n пришли в ожидаемом формате: [{ json: { stdout: "..." } }]
            if (!Array.isArray(data) || data.length === 0 || !data[0].json || typeof data[0].json.stdout === 'undefined') {
                console.error('Получены некорректные данные от n8n:', JSON.stringify(data));
                loader.textContent = 'Ошибка: сервер вернул данные в неожиданном формате.';
                if (tg) {
                    tg.showAlert('Произошла внутренняя ошибка при загрузке каталога. Обратитесь в поддержку и покажите им ошибку в консоли браузера.');
                }
                return; // Прерываем выполнение функции
            }
            // --- КОНЕЦ НОВОГО БЛОКА ---

            const productNames = data[0].json.stdout.split('\n').filter(name => name);

            if (productNames.length === 0) {
                loader.textContent = 'В каталоге пока нет товаров.';
                return;
            }

            loader.style.display = 'none';
            productListContainer.innerHTML = '';

            for (const name of productNames) {
                const previewUrl = `${N8N_BASE_URL}/models/${name}/preview.png`;
                const descriptionUrl = `${N8N_BASE_URL}/models/${name}/description.txt`;

                try {
                    const [previewResponse, descriptionResponse] = await Promise.all([
                        fetchWithScrambledTime(previewUrl),
                        fetchWithScrambledTime(descriptionUrl)
                    ]);
                    
                    const previewBlob = await previewResponse.blob();
                    const previewSrc = URL.createObjectURL(previewBlob);
                    
                    const descriptionText = await descriptionResponse.text();
                    const [title, description, price] = descriptionText.split('\n');

                    const card = document.createElement('div');
                    card.className = 'product-card';
                    card.innerHTML = `
                        <img src="${previewSrc}" alt="${title || name}">
                        <div class="product-info">
                            <h3>${title || 'Без названия'}</h3>
                            <p class="price">${price || 'Цена не указана'}</p>
                            <p class="description">${description || 'Описание отсутствует.'}</p>
                            <div class="actions">
                                <button class="more-button">Больше</button>
                                <button class="ar-button" data-product="${name}">Посмотреть в AR</button>
                            </div>
                        </div>
                    `;
                    productListContainer.appendChild(card);
                } catch (productError) {
                     console.error(`Не удалось загрузить данные для товара "${name}":`, productError);
                }
            }
        } catch (error) {
            console.error('Критическая ошибка при загрузке каталога:', error);
            loader.textContent = 'Не удалось загрузить каталог. Попробуйте обновить страницу.';
        }
    }

    productListContainer.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.classList.contains('more-button')) {
            const descriptionEl = target.closest('.product-card').querySelector('.description');
            const isVisible = descriptionEl.style.display === 'block';
            descriptionEl.style.display = isVisible ? 'none' : 'block';
            target.textContent = isVisible ? 'Больше' : 'Скрыть';
        }

        if (target.classList.contains('ar-button')) {
            const productName = target.dataset.product;
            const scrambledTime = scrambleTimestamp();
            const modelUrlGlb = `${N8N_BASE_URL}/models/${productName}/model.glb?t=${scrambledTime}`;
            const modelUrlUsdz = `${N8N_BASE_URL}/models/${productName}/model.usdz?t=${scrambledTime}`;
            
            const arViewer = document.getElementById('ar-viewer');
            arViewer.src = modelUrlGlb;
            arViewer.iosSrc = modelUrlUsdz;
            
            try {
                await arViewer.activateAR();
            } catch (arError) {
                console.error('AR activation failed', arError);
                if (tg) tg.showAlert('Не удалось запустить AR. Убедитесь, что ваше устройство поддерживает эту функцию.');
            }
        }
    });

    loadCatalog();
});
