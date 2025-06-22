document.addEventListener('DOMContentLoaded', async () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const N8N_BASE_URL = 'https://your-n8n-instance.com/webhook'; // ВАЖНО: Укажите ваш URL
    const SECRET_KEY = 'your_super_secret_key_change_me'; // ВАЖНО: Тот же ключ, что и в n8n

    const loader = document.getElementById('loader');
    const productListContainer = document.getElementById('product-list');

    // Функция для генерации токена на клиенте (логика идентична серверной)
    async function generateToken() {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const hash = CryptoJS.HmacSHA256(timestamp, SECRET_KEY);
        return hash.toString(CryptoJS.enc.Hex).substring(0, 32);
    }

    async function fetchWithToken(url) {
        const token = await generateToken();
        const response = await fetch(`${url}?t=${token}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    }

    async function loadCatalog() {
        try {
            const response = await fetchWithToken(`${N8N_BASE_URL}/models`);
            const data = await response.json();
            const productNames = data.products;

            loader.style.display = 'none';
            productListContainer.innerHTML = ''; // Очищаем контейнер

            for (const name of productNames) {
                // Параллельно запрашиваем превью и описание
                const previewUrl = `${N8N_BASE_URL}/models/${name}/preview.png`;
                const descriptionUrl = `${N8N_BASE_URL}/models/${name}/description.txt`;

                const [previewResponse, descriptionResponse] = await Promise.all([
                    fetchWithToken(previewUrl),
                    fetchWithToken(descriptionUrl)
                ]);
                
                const previewBlob = await previewResponse.blob();
                const previewSrc = URL.createObjectURL(previewBlob);
                
                const descriptionText = await descriptionResponse.text();
                const [title, description, price] = descriptionText.split('\n');

                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <img src="${previewSrc}" alt="${title}">
                    <div class="product-info">
                        <h3>${title}</h3>
                        <p class="price">${price}</p>
                        <p class="description">${description}</p>
                        <div class="actions">
                            <button class="more-button" data-product="${name}">Больше</button>
                            <button class="ar-button" data-product="${name}">Посмотреть в AR</button>
                        </div>
                    </div>
                `;
                productListContainer.appendChild(card);
            }
        } catch (error) {
            loader.textContent = 'Не удалось загрузить каталог. Попробуйте обновить.';
            console.error(error);
        }
    }

    // Обработчики событий для кнопок
    productListContainer.addEventListener('click', async (event) => {
        const target = event.target;
        const productName = target.dataset.product;

        if (target.classList.contains('more-button')) {
            const descriptionEl = target.closest('.product-card').querySelector('.description');
            const isVisible = descriptionEl.style.display === 'block';
            descriptionEl.style.display = isVisible ? 'none' : 'block';
            target.textContent = isVisible ? 'Больше' : 'Скрыть';
        }

        if (target.classList.contains('ar-button')) {
            const token = await generateToken();
            const modelUrlGlb = `${N8N_BASE_URL}/models/${productName}/model.glb?t=${token}`;
            const modelUrlUsdz = `${N8N_BASE_URL}/models/${productName}/model.usdz?t=${token}`; // Для iOS
            
            const arViewer = document.getElementById('ar-viewer');
            arViewer.src = modelUrlGlb;
            arViewer.iosSrc = modelUrlUsdz;
            
            try {
                await arViewer.activateAR();
            } catch (error) {
                console.error('AR activation failed', error);
                tg.showAlert('Не удалось запустить AR. Убедитесь, что ваше устройство поддерживает эту функцию.');
            }
        }
    });

    loadCatalog();
});