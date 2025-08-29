/*
 * Script principal para el cotizador de FirmaVB.
 * Lee los datos de precios, permite buscar productos y manejarlos en un carrito.
 */

// Lista de productos cargada desde price_list.json
let products = [];
// Carrito representado como un objeto {codigo: {item, cantidad}}
let cart = {};

// Cotización generada (clon del carrito con opciones de edición y equivalentes)
let quote = {};

// Índice invertido de palabras clave en descripciones para búsqueda por descripción
let descIndex = {};

// Inicializa la aplicación
async function init() {
  // Cargar datos de productos
  try {
    const res = await fetch('price_list.json');
    products = await res.json();
  } catch (err) {
    console.error('Error al cargar la lista de precios:', err);
  }

  // Construir índice de descripciones después de cargar los productos
  buildDescIndex();
  // Actualizar año en el footer
  document.getElementById('year').textContent = new Date().getFullYear();

  // Configurar búsqueda
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (query.length === 0) {
      clearSearchResults();
    } else {
      const results = searchProducts(query);
      displayResults(results);
    }
  });

  // Configurar carga de archivos
  const fileInput = document.getElementById('fileUpload');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
  }
}

// Devuelve una lista de productos que coinciden con la consulta
function searchProducts(query) {
  // Filtrar en memoria (podría optimizarse con índices)
  return products
    .filter((item) => {
      return (
        item.codigo.toLowerCase().includes(query) ||
        item.descripcion.toLowerCase().includes(query) ||
        item.marca.toLowerCase().includes(query) ||
        item.categoria.toLowerCase().includes(query)
      );
    })
    .slice(0, 20); // Limitar resultados para no saturar la pantalla
}

// Muestra los resultados de la búsqueda en el DOM
function displayResults(results) {
  const container = document.getElementById('searchResults');
  container.innerHTML = '';
  if (results.length === 0) {
    const noRes = document.createElement('p');
    noRes.textContent = 'No se encontraron productos.';
    container.appendChild(noRes);
    return;
  }
  results.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'product-item';
    const title = document.createElement('div');
    title.className = 'product-title';
    title.textContent = `${item.descripcion}`;
    const details = document.createElement('div');
    details.textContent = `Código: ${item.codigo} | Marca: ${item.marca} | Categoría: ${item.categoria}`;
    const price = document.createElement('div');
    price.textContent = `Precio: ${formatCurrency(item.precio)}`;
    const button = document.createElement('button');
    button.className = 'add-button';
    button.textContent = 'Agregar al carrito';
    button.addEventListener('click', () => {
      addToCart(item);
    });
    div.appendChild(title);
    div.appendChild(details);
    div.appendChild(price);
    div.appendChild(button);
    container.appendChild(div);
  });
}

// Limpia los resultados de búsqueda
function clearSearchResults() {
  document.getElementById('searchResults').innerHTML = '';
}

// Añade un producto al carrito
function addToCart(item) {
  const code = item.codigo;
  if (cart[code]) {
    cart[code].cantidad += 1;
  } else {
    cart[code] = { item: item, cantidad: 1 };
  }
  updateCartDisplay();
}

// Actualiza la representación del carrito en el DOM
function updateCartDisplay() {
  const tbody = document.getElementById('cartBody');
  tbody.innerHTML = '';
  let total = 0;
  Object.values(cart).forEach(({ item, cantidad }) => {
    const subtotal = item.precio * cantidad;
    total += subtotal;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.descripcion}</td>
      <td>${item.marca}</td>
      <td>${item.categoria}</td>
      <td><input type="number" min="1" value="${cantidad}" data-code="${item.codigo}" /></td>
      <td>${formatCurrency(item.precio)}</td>
      <td>${formatCurrency(subtotal)}</td>
      <td><button class="remove-button" data-code="${item.codigo}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('totalAmount').textContent = formatCurrency(total);
  // Añadir listeners a inputs y botones de eliminar
  tbody.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const code = e.target.getAttribute('data-code');
      const qty = parseInt(e.target.value);
      if (qty > 0) {
        cart[code].cantidad = qty;
      }
      updateCartDisplay();
    });
  });
  tbody.querySelectorAll('.remove-button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const code = e.target.getAttribute('data-code');
      delete cart[code];
      updateCartDisplay();
    });
  });
}

// Formatea un número como moneda chilena
function formatCurrency(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Ejecutar init al cargar
window.addEventListener('DOMContentLoaded', init);

/**
 * Construye un índice invertido de palabras clave a productos a partir de la
 * descripción de cada producto. El índice se utiliza para sugerir
 * coincidencias basadas en descripciones cuando no hay coincidencia exacta
 * por código. Solo se indexan palabras de al menos 4 caracteres para
 * reducir ruido.
 */
function buildDescIndex() {
  descIndex = {};
  products.forEach((prod) => {
    // Normalizar la descripción: minúsculas y solo letras y números
    const text = prod.descripcion
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ');
    const tokens = new Set(
      text
        .split(/\s+/)
        .filter((w) => w.length >= 4) // solo palabras con longitud >=4
    );
    tokens.forEach((tok) => {
      if (!descIndex[tok]) {
        descIndex[tok] = [];
      }
      descIndex[tok].push(prod);
    });
  });
}

// Configura el botón para generar la cotización al cargar
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('generateQuote');
  if (btn) {
    btn.addEventListener('click', generateQuote);
  }
});

// Genera la cotización a partir de los elementos del carrito
function generateQuote() {
  // Si no hay productos en el carrito, no hacer nada
  if (Object.keys(cart).length === 0) {
    alert('El carrito está vacío. Agregue productos antes de generar la cotización.');
    return;
  }
  // Reiniciar la cotización
  quote = {};
  // Clonar elementos del carrito
  Object.keys(cart).forEach((code) => {
    const { item, cantidad, match } = cart[code];
    // Convertir el tipo de coincidencia del carrito al formato de cotización
    let matchType;
    if (match === undefined) {
      matchType = 'exact';
    } else if (match === true) {
      matchType = 'exact';
    } else if (match === false) {
      matchType = 'unmatched';
    } else {
      matchType = match;
    }
    quote[code] = {
      item: item,
      cantidad: cantidad,
      match: matchType,
    };
  });
  // Mostrar la sección de cotización
  document.getElementById('quoteSection').style.display = 'block';
  updateQuoteDisplay();
}

// Actualiza la sección de cotización en el DOM
function updateQuoteDisplay() {
  const tbody = document.getElementById('quoteBody');
  tbody.innerHTML = '';
  let total = 0;
  Object.keys(quote).forEach((code) => {
    const record = quote[code];
    const { item, cantidad, match } = record;
    const subtotal = item.precio * cantidad;
    total += subtotal;
    const tr = document.createElement('tr');
    // Tipo de coincidencia
    let tipoTexto;
    if (record.match === 'exact' || record.match === true) {
      tipoTexto = 'Exacto';
    } else if (record.match === 'approx') {
      tipoTexto = 'Alternativa';
    } else {
      tipoTexto = 'Equivalente';
    }
    // Crear lista de opciones para cambio de producto
    const select = document.createElement('select');
    products.forEach((prod) => {
      const option = document.createElement('option');
      option.value = prod.codigo;
      option.textContent = `${prod.descripcion}`;
      if (prod.codigo === item.codigo) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    select.addEventListener('change', (e) => {
      const newCode = e.target.value;
      const newItem = products.find((p) => p.codigo === newCode);
      if (newItem) {
        // Actualizar el registro
        const originalCode = code;
        // Si se selecciona un producto diferente, marcar como alternativa; si es el mismo código, es exacto
        record.item = newItem;
        record.match = newItem.codigo === originalCode ? 'exact' : 'approx';
        // Si el código cambia, también actualizar la clave del objeto quote
        if (newItem.codigo !== originalCode) {
          delete quote[originalCode];
          quote[newItem.codigo] = record;
        }
        updateQuoteDisplay();
      }
    });
    // Crear input de cantidad
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.value = cantidad;
    qtyInput.addEventListener('change', (e) => {
      const q = parseInt(e.target.value);
      if (q > 0) {
        record.cantidad = q;
        updateQuoteDisplay();
      }
    });
    // Botón de eliminar
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-button';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      delete quote[code];
      updateQuoteDisplay();
    });
    // Insertar fila
    tr.appendChild(createCell(item.codigo));
    tr.appendChild(createCell(item.descripcion));
    tr.appendChild(createCell(item.marca));
    tr.appendChild(createCell(item.categoria));
    const qtyTd = document.createElement('td');
    qtyTd.appendChild(qtyInput);
    tr.appendChild(qtyTd);
    tr.appendChild(createCell(formatCurrency(item.precio)));
    tr.appendChild(createCell(formatCurrency(subtotal)));
    tr.appendChild(createCell(tipoTexto));
    const selectTd = document.createElement('td');
    selectTd.appendChild(select);
    tr.appendChild(selectTd);
    const removeTd = document.createElement('td');
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);
    tbody.appendChild(tr);
  });
  document.getElementById('quoteTotalAmount').textContent = formatCurrency(total);
}

// Crea una celda de tabla con texto
function createCell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

// Maneja la carga de archivos para agregar productos automáticamente por código
function handleFileUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) {
    return;
  }
  const file = files[0];
  const reader = new FileReader();
  reader.onload = function (e) {
    let contentStr = '';
    const result = e.target.result;
    // Intentar convertir el contenido a cadena de texto
    try {
      if (typeof result === 'string') {
        contentStr = result;
      } else {
        // Convertir ArrayBuffer o Blob a cadena
        const bytes = new Uint8Array(result);
        let chars = [];
        // Convertir cada byte en un carácter (esto preserva cadenas ASCII)
        for (let i = 0; i < bytes.length; i++) {
          chars.push(String.fromCharCode(bytes[i]));
        }
        contentStr = chars.join('');
      }
    } catch (err) {
      console.error('No se pudo leer el archivo como texto:', err);
      return;
    }
    // Convertir a minúsculas para comparación sin distinción de mayúsculas/minúsculas
    const lowerContent = contentStr.toLowerCase();
    // Generar un Set de códigos de producto para búsqueda rápida
    const productSet = new Set(products.map((p) => p.codigo.toLowerCase()));
    // Dividir el contenido en tokens alfanuméricos usando caracteres no alfanuméricos como separadores
    const tokens = lowerContent.split(/[^a-z0-9]+/);
    const matchedCodes = new Set();
    const unmatchedTokens = new Set();
    tokens.forEach((tok) => {
      if (!tok) return;
      if (productSet.has(tok)) {
        matchedCodes.add(tok);
      } else {
        // Considerar solo tokens con al menos un dígito y longitud razonable como posibles códigos no encontrados
        if (/\d/.test(tok) && tok.length >= 3 && tok.length <= 10) {
          unmatchedTokens.add(tok);
        }
      }
    });
    // Agregar coincidencias exactas al carrito
    matchedCodes.forEach((codeLC) => {
      const matchItem = products.find((p) => p.codigo.toLowerCase() === codeLC);
      if (matchItem) {
        if (cart[matchItem.codigo]) {
          cart[matchItem.codigo].cantidad += 1;
        } else {
          // match: 'exact' indica coincidencia exacta
          cart[matchItem.codigo] = { item: matchItem, cantidad: 1, match: 'exact' };
        }
      }
    });
    // Buscar productos similares para tokens no encontrados
    unmatchedTokens.forEach((token) => {
      // Función para calcular la distancia de Levenshtein
      function levenshteinDistance(a, b) {
        const dp = [];
        for (let i = 0; i <= a.length; i++) {
          dp[i] = new Array(b.length + 1);
          dp[i][0] = i;
        }
        for (let j = 0; j <= b.length; j++) {
          dp[0][j] = j;
        }
        for (let i = 1; i <= a.length; i++) {
          for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
              dp[i][j] = dp[i - 1][j - 1];
            } else {
              dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
            }
          }
        }
        return dp[a.length][b.length];
      }
      // Encuentra el producto con mayor similitud basado en el código
      function findSimilarProduct(tok) {
        let bestMatch = null;
        let bestSim = 0;
        const tokLower = tok.toLowerCase();
        for (const prod of products) {
          const codeLower = prod.codigo.toLowerCase();
          // Calcular similitud usando la distancia de Levenshtein
          const dist = levenshteinDistance(tokLower, codeLower);
          const maxLen = Math.max(tokLower.length, codeLower.length);
          const sim = 1 - dist / maxLen;
          if (sim > bestSim) {
            bestSim = sim;
            bestMatch = prod;
          }
        }
        // Considerar coincidencias con similitud >= 0.7 como alternativas
        return bestSim >= 0.7 ? bestMatch : null;
      }
      const similarItem = findSimilarProduct(token);
      if (similarItem) {
        // Agregar como alternativa
        if (cart[similarItem.codigo]) {
          cart[similarItem.codigo].cantidad += 1;
        } else {
          cart[similarItem.codigo] = { item: similarItem, cantidad: 1, match: 'approx' };
        }
      } else {
        // Si no se encuentra similitud suficiente, agregar como solicitado
        const placeholder = {
          codigo: token.toUpperCase(),
          descripcion: `Producto solicitado: ${token.toUpperCase()}`,
          marca: 'N/A',
          categoria: 'N/A',
          precio: 0,
        };
        const code = token.toUpperCase();
        if (cart[code]) {
          cart[code].cantidad += 1;
        } else {
          cart[code] = { item: placeholder, cantidad: 1, match: 'unmatched' };
        }
      }
    });

    // Sugerir productos basados en descripciones si no hay coincidencia de código
    try {
      // Normalizar el contenido para búsqueda por descripciones
      const descContent = lowerContent.replace(/[^a-z0-9 ]+/g, ' ');
      // Conjunto de palabras únicas en el documento de al menos 4 caracteres
      const descTokens = new Set(
        descContent.split(/\s+/).filter((w) => w.length >= 4)
      );
      const descCounts = {};
      descTokens.forEach((tok) => {
        if (descIndex[tok]) {
          descIndex[tok].forEach((prod) => {
            descCounts[prod.codigo] = (descCounts[prod.codigo] || 0) + 1;
          });
        }
      });
      // Ordenar productos candidatos por número de coincidencias desc
      const sortedCodes = Object.keys(descCounts).sort(
        (a, b) => descCounts[b] - descCounts[a]
      );
      let suggestionsAdded = 0;
      for (const c of sortedCodes) {
        if (suggestionsAdded >= 5) break;
        // Evitar añadir productos ya presentes en el carrito (coincidencia exacta o alternativa existente)
        if (!cart[c]) {
          const prod = products.find((p) => p.codigo === c);
          if (prod) {
            cart[c] = { item: prod, cantidad: 1, match: 'approx' };
            suggestionsAdded++;
          }
        }
      }
    } catch (e) {
      console.error('Error al sugerir productos por descripción:', e);
    }

    // Procesar cada línea del documento para sugerir productos basados en descripciones completas
    try {
      const lines = contentStr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      lines.forEach((line) => {
        const queryLine = line.toLowerCase();
        let res = searchProducts(queryLine);
        // Si no se encuentran resultados con la línea completa, intentar con las primeras palabras
        if (!res || res.length === 0) {
          const words = queryLine
            .replace(/[^a-z0-9 ]+/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 3);
          if (words.length > 0) {
            const phrase = words.slice(0, 3).join(' ');
            res = searchProducts(phrase);
          }
        }
        if (res && res.length > 0) {
          // Añadir solo el primer resultado como aproximado si no existe ya en el carrito
          const item = res[0];
          if (!cart[item.codigo]) {
            cart[item.codigo] = { item: item, cantidad: 1, match: 'approx' };
          } else {
            // Si ya existe en el carrito, incrementar cantidad solo si ya era aproximado
            cart[item.codigo].cantidad += 1;
          }
        }
      });
    } catch (err) {
      console.error('Error al procesar líneas del documento para coincidencias por descripción:', err);
    }
    // Actualizar la visualización del carrito tras procesar el archivo
    updateCartDisplay();
  };
  reader.onerror = function (err) {
    console.error('Error al leer el archivo:', err);
  };
  // Leer como ArrayBuffer para soportar archivos binarios (Word, Excel, PDF)
  reader.readAsArrayBuffer(file);
}