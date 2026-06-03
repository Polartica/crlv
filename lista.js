document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const setorParam = urlParams.get('setor');

    const loadingEl = document.getElementById('loading');
    const gridEl = document.getElementById('grid-veiculos');
    const errorEl = document.getElementById('error-msg');
    const setorNomeEl = document.getElementById('setor-nome');

    if (!setorParam) {
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorEl.innerText = "Setor não especificado na URL.";
        return;
    }

    try {
        // Tenta pegar a variavel carregada via tag <script> em data.js
        const data = window.crlvData;

        if (!data) {
            throw new Error('Banco de dados JS não encontrado. Arquivo data.js falhou.');
        }

        const setorData = data[setorParam];

        if (!setorData) {
            throw new Error('Setor não reconhecido no Banco de Dados.');
        }

        setorNomeEl.innerText = setorData.titulo;

        if (setorData.itens.length === 0) {
            loadingEl.innerText = "Nenhum documento cadastrado neste setor.";
            return;
        }

        loadingEl.classList.add('hidden');
        gridEl.classList.remove('hidden');

        // Renderiza cards
        setorData.itens.forEach(item => {
            const card = document.createElement('div');
            card.classList.add('card');

            // Header omitido pois as imagens não são mais necessárias

            // Body
            const body = document.createElement('div');
            body.classList.add('card-body');

            const title = document.createElement('h3');
            title.classList.add('card-title');
            title.innerText = item.id;

            const desc = document.createElement('p');
            desc.classList.add('card-text');
            desc.innerText = item.descricao;

            const actions = document.createElement('div');
            actions.classList.add('card-actions');

            const btn = document.createElement('a');
            btn.classList.add('btn');
            btn.href = item.pdf;
            btn.target = "_blank"; // abre em nova aba
            btn.innerText = "📄 Ver Documento";

            actions.appendChild(btn);
            body.appendChild(title);
            body.appendChild(desc);
            body.appendChild(actions);

            card.appendChild(body);
            gridEl.appendChild(card);
        });

    } catch (err) {
        console.error("Erro ao carregar dados:", err);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorEl.innerText = "Falha ao carregar informações da frota: " + err.message;
    }
});
