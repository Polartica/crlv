document.addEventListener('DOMContentLoaded', () => {
    let token = localStorage.getItem('gh_token') || '';
    let repo = localStorage.getItem('gh_repo') || 'Polartica/crlv';
    let branch = 'main';

    let currentData = null;
    let dataSha = null;

    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const loginError = document.getElementById('login-error');

    // form elements
    const repoInput = document.getElementById('repo-input');
    const tokenInput = document.getElementById('token-input');
    
    repoInput.value = repo;
    if(token) tokenInput.value = token;

    async function loadDataFromGithub() {
        loginError.innerText = "Carregando banco de dados...";
        loginError.classList.remove('hidden');
        loginError.style.color = "var(--primary)";

        try {
            const response = await fetch(`https://api.github.com/repos/${repo}/contents/data.json?ref=${branch}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) throw new Error("Arquivo data.json não encontrado no repositório.");
                if (response.status === 401) throw new Error("Acesso Negado: Token inválido ou expirado.");
                throw new Error("Erro ao acessar repositório: " + response.statusText);
            }

            const refData = await response.json();
            dataSha = refData.sha;
            
            // Decodes b64 content using pure JS (handles unicode safely)
            const decodedStr = decodeURIComponent(escape(atob(refData.content)));
            currentData = JSON.parse(decodedStr);

            loginError.classList.add('hidden');
            loginView.classList.add('hidden');
            adminView.classList.remove('hidden');
            btnLogout.classList.remove('hidden');

            renderTable('adm'); // default
        } catch (error) {
            console.error(error);
            loginError.style.color = "red";
            loginError.innerText = error.message;
        }
    }

    // Attempt auto login
    if (token && repo) {
        loadDataFromGithub();
    }

    btnLogin.addEventListener('click', () => {
        repo = repoInput.value.trim();
        token = tokenInput.value.trim();
        
        if (!repo || !token) {
            loginError.innerText = "Preencha ambos os campos.";
            loginError.classList.remove('hidden');
            return;
        }

        localStorage.setItem('gh_repo', repo);
        localStorage.setItem('gh_token', token);
        loadDataFromGithub();
    });

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('gh_token');
        location.reload();
    });

    // --- Admin Funcs ---
    
    const filterSetor = document.getElementById('filter-setor');
    const tableBody = document.getElementById('table-body');
    
    filterSetor.addEventListener('change', (e) => {
        renderTable(e.target.value);
    });

    function renderTable(setorKey) {
        tableBody.innerHTML = '';
        if (!currentData || !currentData[setorKey]) return;

        const itens = currentData[setorKey].itens;
        
        itens.forEach((item, index) => {
            const tr = document.createElement('tr');
            
            const pdfLink = item.pdf ? `<a href="${item.pdf}" target="_blank">Ver</a>` : '-';
            const imgPreview = item.imagem ? `<img src="${item.imagem}" style="max-height:30px">` : '-';

            tr.innerHTML = `
                <td><strong>${item.id}</strong></td>
                <td>${item.descricao}</td>
                <td>${pdfLink}</td>
                <td>${imgPreview}</td>
                <td class="admin-actions">
                    <button class="btn btn-secondary" onclick="editItem('${setorKey}', ${index})" style="color:var(--primary)">✏️</button>
                    <button class="btn btn-danger" onclick="deleteItem('${setorKey}', ${index})">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Make global for inline
    window.editItem = (setorKey, index) => {
        const item = currentData[setorKey].itens[index];
        document.getElementById('form-setor').value = setorKey;
        document.getElementById('form-id').value = item.id;
        document.getElementById('form-desc').value = item.descricao;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.deleteItem = async (setorKey, index) => {
        if(!confirm("Atenção: Ao excluir, ele é removido do data.json (o arquivo em si não é exlcuído do Github, apenas da lista central). Confirmar?")) return;
        
        const deleteStatus = document.getElementById('delete-status');
        deleteStatus.innerText = "Removendo do banco de dados...";
        
        currentData[setorKey].itens.splice(index, 1);
        
        try {
            await commitDataJson();
            renderTable(filterSetor.value);
            deleteStatus.innerText = "Removido com sucesso.";
            setTimeout(() => deleteStatus.innerText="", 3000);
        } catch (err) {
            deleteStatus.innerText = "Erro ao excluir: " + err.message;
        }
    };

    // -- Upload Logic --
    
    const btnSave = document.getElementById('btn-save');
    const saveStatus = document.getElementById('save-status');
    const formSetor = document.getElementById('form-setor');
    const formId = document.getElementById('form-id');
    const formDesc = document.getElementById('form-desc');
    const formPdf = document.getElementById('form-pdf');
    const formImg = document.getElementById('form-img');

    // Convert to base64
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    async function uplaodFileToGitHub(path, base64Content) {
        // check if file exists to get SHA
        let fileSha = null;
        try {
            const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            if (getRes.ok) {
                const existingInfo = await getRes.json();
                fileSha = existingInfo.sha;
            }
        } catch (e) {} // ignore 404

        const payload = {
            message: `Auto-upload CMS: ${path}`,
            content: base64Content,
            branch: branch
        };
        if (fileSha) payload.sha = fileSha;

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Falha ao pular ${path}`);
    }

    async function commitDataJson() {
        // encode keeping utf8 support
        const jsonStr = JSON.stringify(currentData, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));
        
        const payload = {
            message: `Admin update CMS data`,
            content: base64Content,
            branch: branch,
            sha: dataSha
        };

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/data.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Falha ao comitar data.json");
        const json = await res.json();
        dataSha = json.content.sha; // update SHA for next commits
    }

    btnSave.addEventListener('click', async () => {
        const setor = formSetor.value;
        const id = formId.value.trim().toUpperCase();
        const desc = formDesc.value.trim();
        const pdfFile = formPdf.files[0];
        const imgFile = formImg.files[0];

        if (!id || !desc) return alert("ID e Descrição são obrigatórios.");

        btnSave.disabled = true;
        saveStatus.style.color = "var(--primary)";
        
        try {
            // Find if item exists
            let itemIndex = currentData[setor].itens.findIndex(i => i.id === id);
            let item = itemIndex !== -1 ? currentData[setor].itens[itemIndex] : { id, descricao: desc, imagem: "", pdf: "" };

            item.descricao = desc;
            
            // Upload PDF if present
            if (pdfFile) {
                saveStatus.innerText = "Fazendo upload do PDF (-/+) ...";
                let pdfPath = `${getFolderPrefix(setor)}${id}.pdf`;
                const b64 = await toBase64(pdfFile);
                await uplaodFileToGitHub(pdfPath, b64);
                item.pdf = pdfPath;
            } else if (!item.pdf) { // fallback rule
                item.pdf = `${getFolderPrefix(setor)}${id}.pdf`;
            }

            // Upload Imagem if present
            if (imgFile) {
                saveStatus.innerText = "Fazendo upload da Imagem (-/+) ...";
                const ext = imgFile.name.split('.').pop();
                let imgPath = `assets/img_autos/${setor}_${id}.${ext}`;
                const b64 = await toBase64(imgFile);
                await uplaodFileToGitHub(imgPath, b64);
                item.imagem = imgPath;
            }

            saveStatus.innerText = "Atualizando o banco de dados principal (data.json)...";
            
            if (itemIndex !== -1) {
                currentData[setor].itens[itemIndex] = item;
            } else {
                currentData[setor].itens.push(item);
            }

            await commitDataJson();

            saveStatus.style.color = "green";
            saveStatus.innerText = "✅ Salvo com Sucesso! Aguarde alguns minutos para o site online atualizar.";
            
            // clear form
            formId.value = '';
            formDesc.value = '';
            formPdf.value = '';
            formImg.value = '';
            
            renderTable(filterSetor.value);

            setTimeout(()=> { saveStatus.innerText = ""; btnSave.disabled = false; }, 4000);

        } catch (err) {
            saveStatus.style.color = "red";
            saveStatus.innerText = "Erro: " + err.message;
            btnSave.disabled = false;
        }
    });

    function getFolderPrefix(setor) {
        if(setor === 'adm') return "./ADM/";
        if(setor === 'entrega') return "./Entrega/";
        if(setor === 'puxada') return "./Puxada/";
        if(setor === 'vendas_carros') return "./Vendas/Carros/";
        if(setor === 'vendas_motos') return "./Vendas/Motos/";
        return "./";
    }

});
