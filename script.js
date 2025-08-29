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

// Inicializa la aplicación
async function init() {
  // Cargar datos de productos
  try {
    const res = await fetch('price_list.json');
    products = await res.json();
  } catch (err) {
    console.error('Error al cargar la lista de precios:', err);
  }
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
    quote[code] = {
      item: item,
      cantidad: cantidad,
      // Usar la propiedad match del carrito si está definida, de lo contrario asumir coincidencia exacta
      match: match !== undefined ? match : true,
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
    const tipoTexto = match ? 'Exacto' : 'Equivalente';
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
        // Si se selecciona un producto diferente, marcar como equivalente
        record.item = newItem;
        record.match = newItem.codigo === originalCode;
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
    const content = e.target.result;
    // Convertir a texto y separar por líneas
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    lines.forEach((line) => {
      const code = line.toLowerCase();
      // Intentar encontrar un producto que coincida exactamente con el código
      const matchItem = products.find((p) => p.codigo.toLowerCase() === code);
      if (matchItem) {
        // Agregar coincidencia exacta al carrito
        if (cart[matchItem.codigo]) {
          cart[matchItem.codigo].cantidad += 1;
        } else {
          cart[matchItem.codigo] = { item: matchItem, cantidad: 1, match: true };
        }
      } else {
        // Crear un ítem ficticio para marcar como equivalente
        const placeholder = {
          codigo: line,
          descripcion: `Producto solicitado: ${line}`,
          marca: 'N/A',
          categoria: 'N/A',
          precio: 0,
        };
        // Si ya existe el código ficticio, incrementar cantidad
        if (cart[line]) {
          cart[line].cantidad += 1;
        } else {
          cart[line] = { item: placeholder, cantidad: 1, match: false };
        }
      }
    });
    // Actualizar la visualización del carrito tras procesar el archivo
    updateCartDisplay();
  };
  reader.onerror = function (err) {
    console.error('Error al leer el archivo:', err);
  };
  reader.readAsText(file);
}