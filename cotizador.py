"""
cotizador.py

Este módulo proporciona una clase `Cotizador` que permite generar cotizaciones
a partir de una lista de productos contenida en un archivo Excel.  La clase
lee una lista de precios con columnas como código, descripción, marca,
precio y categoría, y luego utiliza esa información para crear un archivo
PDF con una cotización detallada.  Cada producto en la cotización incluye
una imagen decorativa, su descripción, la marca, la categoría, el precio
unitario y el precio total basado en la cantidad solicitada.

Además, el módulo mantiene un registro de todas las cotizaciones emitidas
guardando los datos en un archivo CSV.  Este registro facilita el
seguimiento de los presupuestos enviados y permite revisar su estado en
el futuro.

Para generar un PDF se utiliza la librería reportlab.platypus, que es
compatible con este entorno.  Las imágenes deben estar disponibles en
el sistema de archivos y se pueden vincular a productos específicos
pasando un diccionario de rutas en la llamada a `generar_cotizacion()`.
"""

from __future__ import annotations

import datetime
import os
import uuid
from dataclasses import dataclass, field
from typing import List, Dict, Optional

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Image,
                                Spacer, Table, TableStyle)


@dataclass
class ProductoCotizado:
    """Representa un producto incluido en una cotización."""

    codigo: str
    descripcion: str
    marca: str
    categoria: str
    precio_unitario: float
    cantidad: int
    imagen_path: Optional[str] = None

    @property
    def subtotal(self) -> float:
        """Calcula el subtotal del producto (precio unitario por cantidad)."""
        return self.precio_unitario * self.cantidad


class Cotizador:
    """Gestiona la lectura de precios y la generación de cotizaciones."""

    def __init__(self, ruta_lista_precios: str, ruta_registro: str = "cotizaciones_registro.csv"):
        self.ruta_lista_precios = ruta_lista_precios
        self.ruta_registro = ruta_registro
        self._df = self._cargar_lista_precios()

    def _cargar_lista_precios(self) -> pd.DataFrame:
        """Carga el archivo de lista de precios en un DataFrame.

        Retorna: DataFrame con las columnas normalizadas.
        """
        df = pd.read_excel(self.ruta_lista_precios)
        # Eliminar columnas sin nombre o vacías
        df = df.rename(columns={c: c.strip() if isinstance(c, str) else c for c in df.columns})
        cols_to_drop = [c for c in df.columns if c.startswith('.') or c.strip() == '']
        df = df.drop(columns=cols_to_drop, errors='ignore')
        return df

    def buscar_producto(self, codigo: str) -> Optional[Dict]:
        """Busca un producto en la lista de precios por su código.

        Retorna un diccionario con la información o None si no existe.
        """
        row = self._df.loc[self._df['CODIGO'] == codigo]
        if row.empty:
            return None
        row = row.iloc[0]
        return {
            'codigo': str(row['CODIGO']),
            'descripcion': str(row['DESCRIPCION']),
            'marca': str(row['MARCA']),
            'categoria': str(row['CATEGORIA']),
            'precio': float(row['PRECIO VENTA LICI 20%']),
        }

    def generar_cotizacion(self,
                            cliente: str,
                            productos_solicitados: List[Dict[str, int]],
                            imagenes: Optional[Dict[str, str]] = None,
                            ruta_salida: Optional[str] = None,
                            guardar_registro: bool = True) -> str:
        """Genera un documento PDF de la cotización.

        Args:
            cliente: Nombre del cliente o empresa solicitante.
            productos_solicitados: Lista de dicts con claves 'codigo' y 'cantidad'.
            imagenes: Diccionario que mapea códigos a rutas de imagen.
            ruta_salida: Ruta donde se guardará el PDF. Si es None se genera una
                ruta por defecto.
            guardar_registro: Si True, almacena información en el registro CSV.

        Retorna:
            La ruta del archivo PDF generado.
        """
        if imagenes is None:
            imagenes = {}

        # Construir lista de objetos ProductoCotizado
        productos: List[ProductoCotizado] = []
        for item in productos_solicitados:
            codigo = str(item['codigo'])
            cantidad = int(item.get('cantidad', 1))
            info = self.buscar_producto(codigo)
            if not info:
                raise ValueError(f"Código de producto no encontrado: {codigo}")
            prod = ProductoCotizado(
                codigo=info['codigo'],
                descripcion=info['descripcion'],
                marca=info['marca'],
                categoria=info['categoria'],
                precio_unitario=info['precio'],
                cantidad=cantidad,
                imagen_path=imagenes.get(codigo)
            )
            productos.append(prod)

        # Crear ruta de salida
        if ruta_salida is None:
            fecha_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            ruta_salida = f"cotizacion_{cliente.replace(' ', '_')}_{fecha_str}.pdf"

        # Generar PDF
        self._crear_pdf(cliente, productos, ruta_salida)

        # Registrar cotización
        if guardar_registro:
            self._registrar_cotizacion(cliente, productos, ruta_salida)

        return ruta_salida

    def _crear_pdf(self, cliente: str, productos: List[ProductoCotizado], ruta_salida: str) -> None:
        """Crea el archivo PDF con el detalle de la cotización."""
        # Estilos
        styles = getSampleStyleSheet()
        title_style = styles['Title']
        normal_style = styles['Normal']
        subtitle_style = ParagraphStyle(
            name='Subtitle', parent=styles['Heading2'], fontSize=14, leading=16)
        table_header_style = ParagraphStyle(
            name='TableHeader', parent=styles['Heading4'], alignment=1, fontSize=10,
            textColor=colors.white)

        # Documento
        doc = SimpleDocTemplate(
            ruta_salida, pagesize=letter, rightMargin=20, leftMargin=20, topMargin=30, bottomMargin=30
        )
        elementos: List = []

        # Título
        titulo = Paragraph("Cotización de Productos", title_style)
        elementos.append(titulo)
        elementos.append(Spacer(1, 12))

        # Información del cliente y fecha
        fecha = datetime.datetime.now().strftime("%d de %B de %Y")
        info_cliente = Paragraph(f"<b>Cliente:</b> {cliente}<br/><b>Fecha:</b> {fecha}", normal_style)
        elementos.append(info_cliente)
        elementos.append(Spacer(1, 12))

        # Tabla de productos
        datos_tabla = []
        # Encabezados
        encabezados = [
            Paragraph('<b>Imagen</b>', table_header_style),
            Paragraph('<b>Código</b>', table_header_style),
            Paragraph('<b>Descripción</b>', table_header_style),
            Paragraph('<b>Marca</b>', table_header_style),
            Paragraph('<b>Categoría</b>', table_header_style),
            Paragraph('<b>Cantidad</b>', table_header_style),
            Paragraph('<b>P. Unitario</b>', table_header_style),
            Paragraph('<b>Subtotal</b>', table_header_style)
        ]
        datos_tabla.append(encabezados)

        # Colores de filas alternados
        row_colors = [colors.whitesmoke, colors.lightgrey]

        total_general = 0.0
        for idx, prod in enumerate(productos):
            fila = []
            # Imagen (reducida)
            if prod.imagen_path and os.path.exists(prod.imagen_path):
                img = Image(prod.imagen_path, width=20*mm, height=20*mm)
            else:
                # Si no hay imagen, espacio vacío
                img = Spacer(20*mm, 20*mm)
            fila.append(img)
            # Código
            fila.append(Paragraph(prod.codigo, normal_style))
            # Descripción (cortada si es muy larga)
            descripcion = (prod.descripcion[:90] + '...') if len(prod.descripcion) > 90 else prod.descripcion
            fila.append(Paragraph(descripcion, normal_style))
            # Marca
            fila.append(Paragraph(prod.marca, normal_style))
            # Categoría
            fila.append(Paragraph(prod.categoria, normal_style))
            # Cantidad
            fila.append(Paragraph(str(prod.cantidad), normal_style))
            # Precio unitario
            fila.append(Paragraph(f"${prod.precio_unitario:,.0f}", normal_style))
            # Subtotal
            fila.append(Paragraph(f"${prod.subtotal:,.0f}", normal_style))

            datos_tabla.append(fila)
            total_general += prod.subtotal

        # Configurar estilo de la tabla
        tabla = Table(datos_tabla, colWidths=[25*mm, 22*mm, 60*mm, 25*mm, 40*mm, 20*mm, 25*mm, 25*mm])
        estilo_tabla = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.black),
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ])
        # Filas alternadas
        for i in range(1, len(datos_tabla)):
            bg_color = row_colors[(i-1) % 2]
            estilo_tabla.add('BACKGROUND', (0, i), (-1, i), bg_color)
        tabla.setStyle(estilo_tabla)

        elementos.append(tabla)
        elementos.append(Spacer(1, 12))

        # Total general
        elementos.append(Paragraph(f"<b>Total general:</b> ${total_general:,.0f}", subtitle_style))
        elementos.append(Spacer(1, 24))

        # Sección de usos principales
        elementos.append(Paragraph("Usos principales de los productos", subtitle_style))
        elementos.append(Spacer(1, 6))
        for prod in productos:
            usos = self._obtener_usos(prod.categoria, prod.descripcion)
            elementos.append(Paragraph(f"<b>{prod.descripcion}:</b> {usos}", normal_style))
            elementos.append(Spacer(1, 4))

        doc.build(elementos)

    def _obtener_usos(self, categoria: str, descripcion: str) -> str:
        """Devuelve una descripción de usos principales según la categoría o la descripción."""
        # Diccionario con descripciones generales de usos según la categoría
        usos_generales = {
            'PLASTIFICACION SEMI INDUSTRIAL ROLLOS': 'Ideal para laminar documentos con una capa protectora transparente en empresas, oficinas o centros de copiado.',
            'CORCHETE 26/6': 'Recomendado para agrupar documentos y papeles de tamaño estándar.',
            'GRIP': 'Accesorio ergonómico para mejorar el agarre y la comodidad al escribir con lápiz o pluma.',
            'LIBRETA APUNTES': 'Cuaderno compacto para tomar notas, tareas escolares o apuntes diarios.',
        }
        # Buscar categoría exacta
        for key, value in usos_generales.items():
            if key.upper() in categoria.upper() or key.upper() in descripcion.upper():
                return value
        # Genérico si no se encuentra
        return 'Producto de la categoría "{}" con usos generales de oficina o escolares.'.format(categoria)

    def _registrar_cotizacion(self, cliente: str, productos: List[ProductoCotizado], ruta_pdf: str) -> None:
        """Registra la cotización en el archivo CSV de seguimiento."""
        # Preparar los datos para registro
        quote_id = str(uuid.uuid4())
        fecha_iso = datetime.datetime.now().isoformat()
        total = sum(p.subtotal for p in productos)
        productos_lista = ";".join([f"{p.codigo}x{p.cantidad}" for p in productos])
        registro = {
            'quote_id': quote_id,
            'fecha': fecha_iso,
            'cliente': cliente,
            'productos': productos_lista,
            'total': total,
            'archivo_pdf': ruta_pdf,
            'estado': 'pendiente'
        }
        # Escribir en CSV
        df_registro = pd.DataFrame([registro])
        if os.path.exists(self.ruta_registro):
            df_registro.to_csv(self.ruta_registro, mode='a', header=False, index=False)
        else:
            df_registro.to_csv(self.ruta_registro, index=False)