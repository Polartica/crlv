function pegarValor(id, caminho) {
    var e = document.getElementById(id)
    var valor = e.value;

    console.log(valor)

    documento = document.createElement('a');

    documento.classList.add("button-27")

    documento.innerHTML = "Documento - Clique AQUI"

    link = `${caminho}${valor} `

    documento.setAttribute('href', link);
    documento.setAttribute('title', valor);

    document.body.appendChild(documento)


}