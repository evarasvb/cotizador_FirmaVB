"""
auto_cotizar_server.py
~~~~~~~~~~~~~~~~~~~~~~

Este script implementa un servidor HTTP muy sencillo que permite a los
clientes subir un archivo de Excel con una lista de productos y
cantidades a cotizar. El servidor utiliza la lista de precios
almacenada en un archivo Excel para calcular los subtotales y el
total general de la cotización y devuelve una tabla con los
resultados en formato HTML.

Requisitos y consideraciones:

* Este servidor utiliza solamente módulos de la biblioteca estándar
  (http.server y cgi) junto con pandas, que ya está disponible en
  este entorno. No depende de frameworks web externos como Flask
  o Streamlit.
* Los clientes deben subir un archivo Excel (.xlsx) con, al menos,
  dos columnas. Se asume que la primera columna contiene los
  códigos de producto y la segunda columna contiene las cantidades.
* La lista de precios debe encontrarse en la misma carpeta y tener
  una columna "CODIGO" que identifica cada producto y una columna
  "PRECIO VENTA LICI 20%" para el precio unitario. También se
  recomienda incluir "DESCRIPCION", "MARCA" y "CATEGORIA" para
  mostrar más detalles en la tabla de resultados.
* Para iniciar el servidor, ejecute este archivo con Python. Por
  defecto se escucha en el puerto 8000. Puede cambiar el puerto
  modificando la variable PORT al final del archivo.

Ejemplo de uso:

    python auto_cotizar_server.py --port 8000

Una vez en funcionamiento, abra un navegador y navegue a
http://localhost:8000/ para ver el formulario de carga.

"""

import argparse
import cgi
import io
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

import pandas as pd


def cargar_lista_precios(path: str) -> pd.DataFrame:
    """Carga la lista de precios desde un archivo Excel y normaliza las columnas.

    Args:
        path: Ruta al archivo Excel de la lista de precios.

    Returns:
        DataFrame con las columnas necesarias normalizadas.
    """
    df = pd.read_excel(path)
    # Eliminar columnas sin nombre o vacías y normalizar nombres
    df = df.rename(columns={c: c.strip() if isinstance(c, str) else c for c in df.columns})
    cols_to_drop = [c for c in df.columns if (isinstance(c, str) and (c.startswith('.') or c.strip() == ''))]
    df = df.drop(columns=cols_to_drop, errors='ignore')
    return df


class CotizarHTTPRequestHandler(BaseHTTPRequestHandler):
    """Manejador HTTP que permite subir un archivo Excel y devuelve una cotización."""

    # Ruta al archivo de lista de precios (se establece al crear el servidor)
    lista_precios_path: str = "1 LISTA DE PRECIOS VIGENTE 2025_chat.xlsx"

    def _render_form(self):
        """Envia el formulario de carga al cliente."""
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        html = """
        <!doctype html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Auto Cotización</title>
        </head>
        <body>
            <h1>Auto Cotización de Productos</h1>
            <p>Sube un archivo Excel (.xlsx) con dos columnas: el código del
            producto en la primera columna y la cantidad en la segunda columna.</p>
            <form enctype="multipart/form-data" method="post">
                <input type="file" name="archivo" accept=".xlsx" required><br><br>
                <input type="submit" value="Cotizar">
            </form>
        </body>
        </html>
        """
        self.wfile.write(html.encode('utf-8'))

    def do_GET(self):
        # Cualquier solicitud GET muestra el formulario
        self._render_form()

    def do_POST(self):
        # Procesar archivo cargado
        form = cgi.FieldStorage(fp=self.rfile,
                                headers=self.headers,
                                environ={'REQUEST_METHOD': 'POST',
                                         'CONTENT_TYPE': self.headers['Content-Type']})

        file_item = form['archivo'] if 'archivo' in form else None
        if file_item is None or not file_item.filename:
            # Si no se proporcionó archivo, mostrar formulario nuevamente
            self._render_form()
            return

        # Leer archivo subido en memoria
        uploaded_data = file_item.file.read()
        # Guardar en un buffer para pandas
        try:
            uploaded_df = pd.read_excel(io.BytesIO(uploaded_data))
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(f"Error al leer el archivo: {e}".encode('utf-8'))
            return

        # Asegurar que hay al menos dos columnas
        if uploaded_df.shape[1] < 2:
            self.send_response(400)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write("El archivo debe tener al menos dos columnas (código y cantidad).".encode('utf-8'))
            return

        # Extraer códigos y cantidades
        try:
            codigos = uploaded_df.iloc[:, 0].astype(str)
            cantidades = uploaded_df.iloc[:, 1].astype(int)
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(f"Error al interpretar códigos y cantidades: {e}".encode('utf-8'))
            return

        # Cargar lista de precios
        if not os.path.exists(self.lista_precios_path):
            self.send_response(500)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(f"Archivo de lista de precios no encontrado: {self.lista_precios_path}".encode('utf-8'))
            return

        lista_df = cargar_lista_precios(self.lista_precios_path)
        lista_df['CODIGO'] = lista_df['CODIGO'].astype(str)

        # Combinar y calcular totales
        detalles = []
        total_general = 0.0
        for codigo, cantidad in zip(codigos, cantidades):
            row = lista_df.loc[lista_df['CODIGO'] == codigo]
            if row.empty:
                detalles.append({'codigo': codigo,
                                 'descripcion': 'NO ENCONTRADO',
                                 'marca': '',
                                 'categoria': '',
                                 'precio_unitario': 0.0,
                                 'cantidad': cantidad,
                                 'subtotal': 0.0})
                continue
            info = row.iloc[0]
            precio = float(info['PRECIO VENTA LICI 20%'])
            subtotal = precio * cantidad
            total_general += subtotal
            detalles.append({'codigo': codigo,
                             'descripcion': str(info.get('DESCRIPCION', '')),
                             'marca': str(info.get('MARCA', '')),
                             'categoria': str(info.get('CATEGORIA', '')),
                             'precio_unitario': precio,
                             'cantidad': cantidad,
                             'subtotal': subtotal})

        # Construir respuesta HTML
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        salida = io.StringIO()
        salida.write("""
        <!doctype html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Resultado de la Cotización</title>
            <style>
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
                th { background-color: #003366; color: #fff; }
                tr:nth-child(even) { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h1>Resultado de la Cotización</h1>
            <table>
                <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Marca</th>
                    <th>Categoría</th>
                    <th>Cantidad</th>
                    <th>Precio Unitario</th>
                    <th>Subtotal</th>
                </tr>
        """)
        for d in detalles:
            salida.write(f"<tr>"
                         f"<td>{d['codigo']}</td>"
                         f"<td>{d['descripcion']}</td>"
                         f"<td>{d['marca']}</td>"
                         f"<td>{d['categoria']}</td>"
                         f"<td>{d['cantidad']}</td>"
                         f"<td>${d['precio_unitario']:,.0f}</td>"
                         f"<td>${d['subtotal']:,.0f}</td>"
                         f"</tr>")
        salida.write(f"""
            </table>
            <h2>Total general: ${total_general:,.0f}</h2>
            <br><a href="/">&#8592; Volver al formulario</a>
        </body>
        </html>
        """)
        self.wfile.write(salida.getvalue().encode('utf-8'))


def run_server(lista_precios_path: str, port: int):
    """Inicia el servidor de cotización en el puerto especificado."""
    handler_class = CotizarHTTPRequestHandler
    handler_class.lista_precios_path = lista_precios_path
    server_address = ('', port)
    httpd = HTTPServer(server_address, handler_class)
    print(f"Servidor iniciado en http://localhost:{port}/")
    print(f"Usando lista de precios: {lista_precios_path}")
    httpd.serve_forever()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Servidor de auto cotización de productos")
    parser.add_argument('--port', type=int, default=8000, help='Puerto en el que escuchar (por defecto 8000)')
    parser.add_argument('--precios', type=str, default='1 LISTA DE PRECIOS VIGENTE 2025_chat.xlsx',
                        help='Ruta al archivo Excel con la lista de precios')
    args = parser.parse_args()
    run_server(lista_precios_path=args.precios, port=args.port)