document.addEventListener('DOMContentLoaded', async () => {
    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
    }

    const N8N_BASE_URL = 'https://handsomely-thrilled-curassow.cloudpub.ru/webhook'; 
    const loader = document.getElementById('loader');
    const productListContainer = document.getElementById('product-list');

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

    function createProductFileUrl(productName, fileName) {
        const scrambledTime = scrambleTimestamp();
        return `${N8N_BASE_URL}/models?p=${encodeURIComponent(productName)}&f=${encodeURIComponent(fileName)}&t=${scrambledTime}`;
    }


    async function fetchWithUrl(url) {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    }

    async function loadCatalog() {
        try {
            const listUrl = `${N8N_BASE_URL}/models?t=${scrambleTimestamp()}`; 
            const response = await fetchWithUrl(listUrl);
            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0 || !data[0].json || typeof data[0].json.stdout === 'undefined') {
                console.error('Получены некорректные данные от n8n:', JSON.stringify(data));
                loader.textContent = 'Ошибка: сервер вернул данные в неожиданном формате.';
                return;
            }

            const productNames = data[0].json.stdout.split('\n').filter(name => name);

            if (productNames.length === 0) {
                loader.textContent = 'В каталоге пока нет товаров.';
                return;
            }

            loader.style.display = 'none';
            productListContainer.innerHTML = '';

            for (const name of productNames) {
                const previewUrl = createProductFileUrl(name, 'preview.png');
                const descriptionUrl = createProductFileUrl(name, 'description.txt');

                try {
                    const [previewResponse, descriptionResponse] = await Promise.all([
                        fetchWithUrl(previewUrl),
                        fetchWithUrl(descriptionUrl)
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
            const modelUrlGlb = createProductFileUrl(productName, 'model.glb');
            const modelUrlUsdz = createProductFileUrl(productName, 'model.usdz');
            
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
