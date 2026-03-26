document.addEventListener('DOMContentLoaded', async () => {
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
        // Usa timestamp pra evitar cache caso atualizem o github!
        const response = await fetch(`./data.json?t=${new Date().getTime()}`);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();
        
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

            // Header - Imagem do carro (ou default)
            const imgContainer = document.createElement('div');
            if (item.imagem) {
                const img = document.createElement('img');
                img.src = item.imagem;
                img.classList.add('card-img');
                img.alt = item.descricao;
                // Exibe imagem com fallback para icone placeholder caso quebre
                img.onerror = function() {
                    this.parentElement.innerHTML = `<div class="card-img-placeholder">🚗</div>`;
                }
                imgContainer.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.classList.add('card-img-placeholder');
                // Adiciona um ícone baseando no tipo se quisermos, vou usar um veiculo padrao
                placeholder.innerHTML = '🚗';
                imgContainer.appendChild(placeholder);
            }

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
            btn.innerText = "📄 Imprimir Documento";

            actions.appendChild(btn);
            body.appendChild(title);
            body.appendChild(desc);
            body.appendChild(actions);

            card.appendChild(imgContainer);
            card.appendChild(body);
            gridEl.appendChild(card);
        });

    } catch (err) {
        console.error("Erro ao carregar dados:", err);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorEl.innerText = "Falha ao carregar informações da frota.";
    }
});
