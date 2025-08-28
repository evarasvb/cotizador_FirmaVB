## Prompt para el Agente de Desarrollo: Creador de Cotizador Automático con Inteligencia de Negocio

**Objetivo del proyecto**  
Desarrollar una aplicación web (o un repositorio de GitHub) que funcione como un cotizador automático de productos. La plataforma debe ser una herramienta estratégica para el cliente, recopilando datos valiosos para inteligencia de negocio y ofreciendo una experiencia enriquecida con información detallada del producto.

### 1. Requisitos de la arquitectura y tecnología

- **Plataforma de desarrollo:** La solución debe ser una aplicación web completa, con una interfaz de usuario limpia e intuitiva (considerar un framework como React/Next.js) y un backend robusto (Node.js o Python con Django/Flask). El código debe estar bien documentado y organizado en un repositorio de GitHub.
- **Base de datos:** Se requiere una base de datos para almacenar la información de los usuarios, las cotizaciones generadas y la lista de precios. La tabla de precios debe ser escalable para permitir cargas masivas.

### 2. Lógica de negocio y flujo del usuario

El flujo de usuario debe seguir estos pasos de forma secuencial:

1. **Registro y autenticación del cliente**
   - El cliente se registrará con su correo electrónico, que será el identificador principal.
   - Se implementará un proceso de verificación de correo electrónico.
   - Una vez verificado, el cliente tendrá acceso completo a la plataforma.

2. **Carga y procesamiento de documentos**
   - El cliente podrá subir documentos en varios formatos (PDF, DOC/DOCX, XLS/XLSX, TXT).
   - La aplicación debe extraer y analizar el texto para identificar los productos.
   - El sistema debe usar la lista de precios (1 LISTA DE PRECIOS VIGENTE 2025_chat.xlsx - lista de precios.csv) y el archivo de palabras clave (1 LISTA DE PRECIOS VIGENTE 2025_chat.xlsx - palabras claves.csv) para encontrar coincidencias.

3. **Generación de la cotización**
   - **Coincidencia exacta:** Se incluirá el producto con su precio exacto de la lista.
   - **Producto equivalente:** Si no hay coincidencia exacta, el sistema sugerirá un producto similar usando el archivo de palabras clave. Se debe especificar claramente que es un “equivalente”.
   - La cotización final debe incluir una lista detallada de productos, precios y el total, y debe poder descargarse en formato PDF.

### 3. Inteligencia de negocio y valor añadido

- **Recopilación de datos:** La plataforma debe registrar cada documento que sube un usuario y los productos que solicita. Esto permitirá analizar la demanda de productos, identificar tendencias y entender las necesidades de los clientes.
- **Ficha detallada del producto:** Al generar la cotización, cada producto (tanto coincidencia exacta como equivalente) debe tener una ficha detallada. Esta ficha debe incluir:
  - Ficha técnica (especificaciones del producto).
  - Fotografías (imágenes del producto).
  - Videos (demos o videos explicativos del producto).
  - Manual de uso (instrucciones o guías sobre cómo utilizar el producto).
- **Sugerencias y ofertas:** Basándose en los datos recopilados sobre lo que los clientes cotizan, la plataforma debe poder generar ideas para ofertas personalizadas o campañas de marketing dirigidas, por ejemplo, notificando al cliente sobre productos complementarios o descuentos en productos que ha cotizado anteriormente.

### 4. Consideraciones adicionales

- **Seguridad:** La plataforma debe manejar los datos de los usuarios y los documentos de forma segura, respetando la privacidad.
- **Escalabilidad:** El diseño debe permitir un crecimiento futuro.
- **Interfaz de usuario:** La interfaz debe ser intuitiva y mostrar la información del producto de manera atractiva y clara.
